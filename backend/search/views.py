from django.shortcuts import render
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.postgres.search import (
    SearchVector, SearchQuery, SearchRank, TrigramSimilarity
)
from django.db.models import Q, F, Value, Case, When, Exists, OuterRef, Count, Sum, FloatField, Func, TextField
from django.db.models.functions import Greatest, Lower, Cast
from posts.models import Post, PostInteraction, PostView, Tag, Comment
from users.models import User
from posts.serializers import PostSerializer
from users.serializers import UserSerializer
from django.core.cache import cache
from .models import SearchLog, SearchQuery as SearchQueryModel
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import action, api_view, permission_classes
import logging
from django.db.models import Prefetch
import re
from django.db import connection
from django.conf import settings
import jellyfish  # Make sure to add jellyfish to requirements.txt
import nltk
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from functools import lru_cache
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
import time
from django.contrib.auth import get_user_model

# Initialize NLTK components (you'll need to download these in your entrypoint.sh)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

logger = logging.getLogger(__name__)

# Custom PostgreSQL functions
class Metaphone(Func):
    """PostgreSQL metaphone function for phonetic matching"""
    function = 'metaphone'
    output_field = TextField()

class LevenshteinDistance(Func):
    """PostgreSQL levenshtein distance function"""
    function = 'levenshtein'
    output_field = FloatField()

@lru_cache(maxsize=1000)
def preprocess_query(query_text):
    """
    Preprocess search query with NLP techniques:
    - tokenization
    - stopword removal
    - stemming/lemmatization
    - synonym expansion
    """
    # Tokenize and lowercase
    tokens = word_tokenize(query_text.lower())
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [t for t in tokens if t not in stop_words and len(t) > 1]
    
    # Stem and lemmatize
    stemmer = PorterStemmer()
    lemmatizer = WordNetLemmatizer()
    processed_tokens = [lemmatizer.lemmatize(stemmer.stem(token)) for token in tokens]
    
    # Return both original and processed tokens for query flexibility
    return {
        'original': query_text,
        'processed': processed_tokens,
        'original_tokens': tokens
    }

# Simple function to calculate string similarity score (0-1)
def get_string_similarity(str1, str2):
    """Calculate string similarity between two strings ignoring case."""
    if not str1 or not str2:
        return 0
    
    str1 = str1.lower()
    str2 = str2.lower()
    
    # Direct match
    if str1 == str2:
        return 1.0
    
    # Contains match
    if str1 in str2 or str2 in str1:
        return 0.8
    
    # Levenshtein distance (normalized)
    lev_score = 1 - (jellyfish.levenshtein_distance(str1, str2) / max(len(str1), len(str2)))
    
    # Metaphone match (phonetic similarity)
    if jellyfish.metaphone(str1) == jellyfish.metaphone(str2):
        return max(0.7, lev_score)
    
    return lev_score

# Perform a simple search when advanced search fails
def simple_search(query, model, fields, limit=20):
    """
    Simple search function with basic string similarity
    - Ignores case
    - Handles simple spelling mistakes
    - No caching, always fresh results
    """
    logger.info(f"Using simple search for '{query}' on {model.__name__}")
    query = query.lower().strip()
    results = []
    
    if model == User:
        # For users, search in username, first_name, last_name, email, bio
        queryset = model.objects.all()
        fields_to_check = fields
        
        # First grab exact matches
        exact_matches = queryset.filter(
            Q(username__iexact=query) |
            Q(first_name__iexact=query) |
            Q(last_name__iexact=query) |
            Q(email__iexact=query)
        )
        
        # Then partial matches
        partial_matches = queryset.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(email__icontains=query) |
            Q(bio__icontains=query)
        ).exclude(id__in=[user.id for user in exact_matches])
        
        # Combine results
        all_matches = list(exact_matches) + list(partial_matches)
        
        # If we don't have enough results, do a more relaxed search with string similarity
        if len(all_matches) < limit:
            # Get all users (limit this in production to a reasonable number)
            remaining_needed = limit - len(all_matches)
            potential_matches = queryset.exclude(
                id__in=[user.id for user in all_matches]
            )[:500]  # Limit to 500 for performance
            
            # Score based on string similarity
            similar_matches = []
            for user in potential_matches:
                max_score = 0
                for field in fields_to_check:
                    field_value = getattr(user, field, "")
                    if field_value:
                        similarity = get_string_similarity(query, str(field_value))
                        max_score = max(max_score, similarity)
                
                if max_score > 0.6:  # Threshold for similarity
                    similar_matches.append((user, max_score))
            
            # Sort by similarity score and take the top N
            similar_matches.sort(key=lambda x: x[1], reverse=True)
            all_matches.extend([match[0] for match in similar_matches[:remaining_needed]])
        
        return all_matches[:limit]
        
    elif model == Post:
        # For posts, search in title, description, content
        queryset = model.objects.all()
        fields_to_check = fields
        
        # First grab exact matches
        exact_matches = queryset.filter(
            Q(title__iexact=query) |
            Q(description__iexact=query)
        )
        
        # Then partial matches
        partial_matches = queryset.filter(
            Q(title__icontains=query) |
            Q(description__icontains=query) |
            Q(content__icontains=query)
        ).exclude(id__in=[post.id for post in exact_matches])
        
        # Combine results
        all_matches = list(exact_matches) + list(partial_matches)
        
        # If we don't have enough results, do a more relaxed search with string similarity
        if len(all_matches) < limit:
            # Get remaining posts
            remaining_needed = limit - len(all_matches)
            potential_matches = queryset.exclude(
                id__in=[post.id for post in all_matches]
            ).order_by('-created_at')[:500]  # Limit to 500 for performance
            
            # Score based on string similarity
            similar_matches = []
            for post in potential_matches:
                max_score = 0
                for field in fields_to_check:
                    field_value = getattr(post, field, "")
                    if field_value:
                        similarity = get_string_similarity(query, str(field_value))
                        max_score = max(max_score, similarity)
                
                if max_score > 0.6:  # Threshold for similarity
                    similar_matches.append((post, max_score))
            
            # Sort by similarity score and take the top N
            similar_matches.sort(key=lambda x: x[1], reverse=True)
            all_matches.extend([match[0] for match in similar_matches[:remaining_needed]])
        
        return all_matches[:limit]
    
    return []

class SearchViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _log_search(self, user, query, results_count, search_type='ALL', ip_address=None):
        # Create search log asynchronously to avoid impacting response time
        try:
            SearchLog.objects.create(
                user=user,
                query=query,
                results_count=results_count,
                search_type=search_type,
                ip_address=ip_address
            )
        except Exception as e:
            logger.error(f"Error logging search: {str(e)}")

    def _normalize_query(self, query):
        """
        Normalize query by removing special characters, excess whitespace,
        and converting to lowercase for more consistent matching
        """
        # Remove special characters except spaces
        query = re.sub(r'[^\w\s]', '', query)
        # Convert multiple spaces to single space
        query = re.sub(r'\s+', ' ', query)
        return query.strip().lower()
    
    def _get_cache_key(self, query, search_type, user_id):
        """
        Generate a cache key for search results
        """
        normalized_query = self._normalize_query(query)
        return f"search_{search_type}_{normalized_query}_{user_id}"

    def _get_phonetic_matches(self, query, field, model):
        """
        Find phonetically similar matches using Metaphone algorithm
        """
        # Split query into terms
        terms = query.split()
        phonetic_queries = []
        
        # Create phonetic query for each term
        for term in terms:
            phonetic_queries.append(
                Q(**{f"{field}__iregex": jellyfish.metaphone(term)})
            )
        
        # Combine queries with OR
        if phonetic_queries:
            combined_query = phonetic_queries.pop()
            for query in phonetic_queries:
                combined_query |= query
                
            return model.objects.filter(combined_query)
        
        return model.objects.none()

    def _search_users(self, query):
        """
        Enhanced user search with advanced relevance scoring, phonetic matching,
        and contextual boosting
        """
        try:
            if not query:
                logger.info("Empty query in _search_users, returning default users")
                # Return active users ordered by followers instead of empty results
                default_users = User.objects.annotate(
                    followers_count=Count('followers')
                ).order_by('-followers_count')[:10]
                return UserSerializer(
                    default_users,
                    many=True,
                    context={'request': self.request}
                ).data
                
            normalized_query = self._normalize_query(query)
            cache_key = self._get_cache_key(query, 'users', self.request.user.id)
            
            # Try to get from cache first unless bypass_cache is set
            bypass_cache = self.request.GET.get('refresh', '').lower() == 'true'
            if not bypass_cache:
                cached_results = cache.get(cache_key)
                if cached_results:
                    logger.info(f"Using cached user search results for '{query}'")
                    return cached_results
            
            # Get NLP processed query 
            processed_query = preprocess_query(query)
            query_terms = processed_query['original_tokens']
            processed_terms = processed_query['processed']
            
            # Create search vectors
            username_vector = SearchVector('username', weight='A')
            first_name_vector = SearchVector('first_name', weight='B')
            last_name_vector = SearchVector('last_name', weight='B')
            bio_vector = SearchVector('bio', weight='C')
            
            # Create combined search vector
            search_vector = username_vector + first_name_vector + last_name_vector + bio_vector
            
            # Create search query with multiple terms and stemming
            search_queries = []
            for term in query_terms:
                search_queries.append(SearchQuery(term, search_type='plain'))
            
            combined_query = search_queries[0] if search_queries else None
            for sq in search_queries[1:]:
                combined_query = combined_query | sq
            
            # Calculate similarities for more complex matching
            username_similarity = TrigramSimilarity('username', query)
            first_name_similarity = TrigramSimilarity('first_name', query)
            last_name_similarity = TrigramSimilarity('last_name', query)
            
            # Phonetic matching
            phonetic_score = Case(
                *[When(username__iendswith=term, then=Value(0.7)) for term in query_terms],
                *[When(first_name__iendswith=term, then=Value(0.6)) for term in query_terms],
                *[When(last_name__iendswith=term, then=Value(0.6)) for term in query_terms],
                default=Value(0.0)
            )
            
            # Get current user's following
            user_following = self.request.user.following.all()
            
            # Start building query
            users = User.objects.exclude(
                id=self.request.user.id  # Exclude current user
            )
            
            # Add search rank if we have a combined query
            if combined_query:
                users = users.annotate(
                    search_rank=SearchRank(search_vector, combined_query)
                )
            else:
                users = users.annotate(search_rank=Value(0.0, output_field=FloatField()))
            
            # Annotate with all relevance factors
            users = users.annotate(
                # Exact match score - highest priority
                exact_match=Case(
                    When(username__iexact=query, then=Value(3.0)),
                    When(first_name__iexact=query, then=Value(2.5)),
                    When(last_name__iexact=query, then=Value(2.5)),
                    When(Q(first_name__iexact=query_terms[0], last_name__iexact=query_terms[-1]) if len(query_terms) > 1 else Q(), then=Value(3.0)),
                    default=Value(0.0)
                ),
                # Starts with score - high priority
                starts_with_score=Case(
                    When(username__istartswith=query, then=Value(2.2)),
                    When(first_name__istartswith=query, then=Value(1.8)),
                    When(last_name__istartswith=query, then=Value(1.8)),
                    *[When(username__istartswith=term, then=Value(1.5)) for term in query_terms],
                    *[When(first_name__istartswith=term, then=Value(1.3)) for term in query_terms],
                    *[When(last_name__istartswith=term, then=Value(1.3)) for term in query_terms],
                    default=Value(0.0)
                ),
                # Contains score - medium priority
                contains_score=Case(
                    When(username__icontains=query, then=Value(1.2)),
                    When(first_name__icontains=query, then=Value(1.0)),
                    When(last_name__icontains=query, then=Value(1.0)),
                    When(bio__icontains=query, then=Value(0.7)),
                    *[When(username__icontains=term, then=Value(0.8)) for term in query_terms],
                    *[When(first_name__icontains=term, then=Value(0.7)) for term in query_terms],
                    *[When(last_name__icontains=term, then=Value(0.7)) for term in query_terms],
                    *[When(bio__icontains=term, then=Value(0.4)) for term in query_terms],
                    default=Value(0.0)
                ),
                # Trigram similarity score
                similarity=Greatest(
                    username_similarity * 0.6,
                    first_name_similarity * 0.5,
                    last_name_similarity * 0.5
                ),
                # Phonetic matching score
                phonetic_score=phonetic_score,
                # Following status - boost users that the current user follows
                is_followed=Exists(
                    user_following.filter(id=OuterRef('id'))
                ),
                # Activity score - boost more active users
                activity_score=Cast(
                    (Count('posts') * 0.5) +
                    (Count('comments') * 0.3),
                    FloatField()
                ),
                # Popularity factor
                popularity=Count('followers') * 0.02,
                # Final composite relevance score
                relevance=Greatest(
                    F('exact_match'),
                    F('starts_with_score'),
                    F('contains_score'),
                    F('similarity'),
                    F('phonetic_score'),
                    F('search_rank') * 1.5  # Weight the full-text search rank highly
                )
            ).select_related(
                'profile'
            ).filter(
                # Make filtering MUCH less restrictive to ensure results are returned
                Q(relevance__gt=0.01) |  # Lower the relevance threshold significantly
                Q(search_rank__gt=0.01) |
                Q(username__icontains=normalized_query) |
                Q(first_name__icontains=normalized_query) |
                Q(last_name__icontains=normalized_query) |
                Q(bio__icontains=normalized_query)
            ).order_by(
                '-is_followed',   # Sort followed users first
                '-relevance',     # Then by relevance score
                '-popularity',    # Then by popularity
                '-activity_score' # Then by activity
            )
            
            # For performance, limit to a reasonable number but ensure we get results
            users = users[:40]

            # Create result with user data and debug info
            serialized_data = UserSerializer(
                users,
                many=True,
                context={'request': self.request}
            ).data

            # Add relevance debugging if requested
            if 'debug' in self.request.query_params:
                for i, user in enumerate(users[:20]):  # Limit debug info to top 20
                    if i < len(serialized_data):
                        serialized_data[i]['_debug'] = {
                            'exact_match': float(user.exact_match),
                            'starts_with': float(user.starts_with_score),
                            'contains': float(user.contains_score),
                            'similarity': float(user.similarity),
                            'phonetic': float(user.phonetic_score),
                            'search_rank': float(user.search_rank),
                            'relevance': float(user.relevance),
                            'is_followed': bool(user.is_followed)
                        }

            # Cache for 2 minutes
            cache.set(cache_key, serialized_data, 120)

            logger.info(f"Advanced search found {len(serialized_data)} users matching '{query}'")
            return serialized_data

        except Exception as e:
            logger.error(f"Advanced user search error: {str(e)}", exc_info=True)
            return []

    def _prepare_post_queryset(self, queryset):
        """Common method to prepare post queryset with user interactions"""
        user = self.request.user
        
        # Prefetch related data to reduce database queries
        queryset = queryset.select_related(
            'author',
            'author__profile'
        ).prefetch_related(
            Prefetch('comments', to_attr='prefetched_comments'),
            Prefetch(
                'interactions',
                queryset=PostInteraction.objects.filter(user=user),
                to_attr='prefetched_interactions'
            )
        )

        # Annotate user interactions
        queryset = queryset.annotate(
            is_liked=Exists(
                PostInteraction.objects.filter(
                    user=user,
                    post_id=OuterRef('id'),
                    interaction_type='LIKE'
                )
            ),
            is_saved=Exists(
                PostInteraction.objects.filter(
                    user=user,
                    post_id=OuterRef('id'),
                    interaction_type='SAVE'
                )
            ),
            engagement_score=Cast(
                (F('view_count') * 0.1) + 
                (F('like_count') * 0.5) + 
                (F('comment_count') * 0.4),
                FloatField()
            )
        )

        return queryset

    def _search_posts(self, query):
        """Google-like post search with advanced ranking and relevance scoring"""
        try:
            if not query:
                logger.info("Empty query in _search_posts, returning default posts")
                # Return trending posts instead of empty results
                default_posts = Post.objects.order_by('-trending_score__score', '-created_at')[:10]
                default_posts = self._prepare_post_queryset(default_posts)
                return PostSerializer(
                    default_posts,
                    many=True,
                    context={'request': self.request}
                ).data
                
            normalized_query = self._normalize_query(query)
            cache_key = self._get_cache_key(query, 'posts', self.request.user.id)
            
            # Try to get from cache first unless bypass_cache is set
            bypass_cache = self.request.GET.get('refresh', '').lower() == 'true'
            if not bypass_cache:
                cached_results = cache.get(cache_key)
                if cached_results:
                    logger.info(f"Using cached post search results for '{query}'")
                    return cached_results
            
            # Get NLP processed query
            processed_query = preprocess_query(query)
            query_terms = processed_query['original_tokens']
            processed_terms = processed_query['processed']
            
            # Check for search intent signals
            search_type = 'general'
            if re.search(r'audio|podcast|listen', query, re.IGNORECASE):
                search_type = 'audio'
            elif re.search(r'news|article|read', query, re.IGNORECASE):
                search_type = 'news'
            
            # Create search vectors with appropriate weights
            title_vector = SearchVector('title', weight='A')
            description_vector = SearchVector('description', weight='B')
            content_vector = SearchVector('content', weight='C')
            tags_vector = SearchVector('tags__name', weight='A')
            
            # Create combined search vector
            search_vector = title_vector + description_vector + content_vector + tags_vector
            
            # Create search query with multiple terms
            search_queries = []
            for term in query_terms:
                search_queries.append(SearchQuery(term, search_type='plain'))
            
            combined_query = search_queries[0] if search_queries else None
            for sq in search_queries[1:]:
                combined_query = combined_query | sq
            
            # Calculate similarities
            title_similarity = TrigramSimilarity('title', query)
            desc_similarity = TrigramSimilarity('description', query)
            
            # Date recency boost - newer content gets higher scores
            recency_boost = Case(
                When(created_at__gte=timezone.now() - timedelta(days=1), then=Value(2.0)),  # Last day
                When(created_at__gte=timezone.now() - timedelta(days=7), then=Value(1.5)),  # Last week
                When(created_at__gte=timezone.now() - timedelta(days=30), then=Value(1.0)), # Last month
                default=Value(0.5)  # Older content
            )
            
            # Phonetic matching for title
            phonetic_title_score = Case(
                *[When(title__icontains=term, then=Value(0.8)) for term in query_terms],
                default=Value(0.0)
            )
            
            # Popular content boost (TF-IDF like weighting)
            popularity_boost = Cast(
                (F('view_count') * 0.005) +  # Views have small influence
                (F('like_count') * 0.01) +   # Likes have medium influence
                (F('comment_count') * 0.02), # Comments have strong influence
                FloatField()
            )
            
            # Start building query
            posts = Post.objects.all()
            
            # Add search rank if we have a combined query
            if combined_query:
                posts = posts.annotate(
                    search_rank=SearchRank(search_vector, combined_query)
                )
            else:
                posts = posts.annotate(search_rank=Value(0.0, output_field=FloatField()))
            
            # Apply type-based filtering if intent detected
            if search_type == 'audio':
                posts = posts.filter(type='AUDIO')
            elif search_type == 'news':
                posts = posts.filter(type='NEWS')
            
            # Apply all annotations for comprehensive relevance scoring
            posts = posts.annotate(
                # Exact match scores
                exact_title_match=Case(
                    When(title__iexact=query, then=Value(5.0)),
                    *[When(title__iexact=term, then=Value(3.0)) for term in query_terms],
                    default=Value(0.0)
                ),
                exact_desc_match=Case(
                    When(description__iexact=query, then=Value(3.0)),
                    *[When(description__iexact=term, then=Value(1.5)) for term in query_terms],
                    default=Value(0.0)
                ),
                # Starts with scores
                title_starts_with=Case(
                    When(title__istartswith=query, then=Value(4.0)),
                    *[When(title__istartswith=term, then=Value(2.0)) for term in query_terms],
                    default=Value(0.0)
                ),
                # Contains scores
                title_contains=Case(
                    When(title__icontains=query, then=Value(2.5)),
                    *[When(title__icontains=term, then=Value(1.5)) for term in query_terms],
                    default=Value(0.0)
                ),
                desc_contains=Case(
                    When(description__icontains=query, then=Value(1.8)),
                    *[When(description__icontains=term, then=Value(1.0)) for term in query_terms],
                    default=Value(0.0)
                ),
                content_contains=Case(
                    When(content__icontains=query, then=Value(1.0)),
                    *[When(content__icontains=term, then=Value(0.5)) for term in query_terms],
                    default=Value(0.0)
                ),
                # Trigram similarity scores
                title_similarity=title_similarity * 2.0,
                desc_similarity=desc_similarity * 1.0,
                # Phonetic matching score
                phonetic_score=phonetic_title_score,
                # Date recency multiplier
                recency_score=recency_boost,
                # Popularity factor (engagement based)
                popularity_score=popularity_boost,
                # Final composite relevance score - combines all factors
                relevance=Cast(
                    (Greatest(
                        F('exact_title_match'),
                        F('exact_desc_match'),
                        F('title_starts_with'),
                        F('title_contains'),
                        F('desc_contains'),
                        F('content_contains'),
                        F('title_similarity'),
                        F('desc_similarity'),
                        F('phonetic_score'),
                        F('search_rank') * 2.0  # Full-text search gets high weight
                    ) * F('recency_score')) + F('popularity_score'),  # Apply recency and popularity
                    FloatField()
                )
            )
            
            # Store original, non-filtered query
            original_posts = posts
            
            # First try with stricter relevance filter
            filtered_posts = posts.filter(
                # Comprehensive filtering for high recall
                Q(relevance__gt=0.2) |
                Q(search_rank__gt=0.1) |
                Q(title__icontains=normalized_query) |
                Q(description__icontains=normalized_query) |
                Q(content__icontains=normalized_query) |
                Q(title__in=[term for term in query_terms]) |
                Q(tags__name__in=[term for term in query_terms])
            ).order_by(
                '-relevance'  # Single order by most relevant first
            ).distinct()  # Ensure no duplicates from joins
            
            # If we have very few results, try a more relaxed filter
            if filtered_posts.count() < 5:
                logger.info(f"Few results ({filtered_posts.count()}) for '{query}', trying relaxed filter")
                filtered_posts = posts.filter(
                    Q(relevance__gt=0.1) |  # Lower relevance threshold
                    Q(search_rank__gt=0.05) |  # Lower search rank threshold
                    Q(title__icontains=query) |
                    Q(description__icontains=query) |
                    Q(content__icontains=query) |
                    Q(author__username__icontains=query) |  # Add author search
                    Q(tags__name__icontains=query)
                ).order_by('-relevance').distinct()
            
            # If still no results, add some trending posts as fallback
            if filtered_posts.count() == 0:
                logger.info(f"No results for '{query}', adding trending posts as fallback")
                trending_posts = Post.objects.order_by('-trending_score__score', '-created_at')[:5]
                filtered_posts = trending_posts
            
            # Apply common post preparations
            posts = self._prepare_post_queryset(filtered_posts)
            
            # For performance, limit to a reasonable number but ensure we get results
            posts = posts[:40]
            
            # Fall back to a simpler query if no results
            if not posts:
                logger.info(f"No posts found with complex query for '{query}', falling back to simpler search")
                simple_posts = Post.objects.filter(
                    Q(title__icontains=normalized_query) |
                    Q(description__icontains=normalized_query) |
                    Q(content__icontains=normalized_query)
                ).order_by('-created_at')[:40]
                
                posts = self._prepare_post_queryset(simple_posts)
            
            # Serialize results
            serialized_data = PostSerializer(
                posts,
                many=True,
                context={'request': self.request}
            ).data

            # Add relevance debugging if requested
            if 'debug' in self.request.query_params:
                for i, post in enumerate(posts[:20]):  # Limit debug info to top 20
                    if i < len(serialized_data):
                        serialized_data[i]['_debug'] = {
                            'exact_title': float(post.exact_title_match),
                            'exact_desc': float(post.exact_desc_match), 
                            'title_starts': float(post.title_starts_with),
                            'title_contains': float(post.title_contains),
                            'desc_contains': float(post.desc_contains),
                            'title_similarity': float(post.title_similarity),
                            'desc_similarity': float(post.desc_similarity),
                            'phonetic': float(post.phonetic_score),
                            'search_rank': float(post.search_rank),
                            'recency': float(post.recency_score),
                            'popularity': float(post.popularity_score),
                            'relevance': float(post.relevance),
                            'search_type': search_type
                        }

            # Cache results for 5 minutes
            cache.set(cache_key, serialized_data, 300)

            logger.info(f"Advanced search found {len(serialized_data)} posts matching '{query}'")
            return serialized_data

        except Exception as e:
            logger.error(f"Advanced post search error: {str(e)}", exc_info=True)
            # Return trending posts if an error occurs
            try:
                fallback_posts = Post.objects.order_by('-trending_score__score', '-created_at')[:10]
                fallback_posts = self._prepare_post_queryset(fallback_posts)
                fallback_results = PostSerializer(
                    fallback_posts,
                    many=True,
                    context={'request': self.request}
                ).data
                logger.info(f"Returning {len(fallback_results)} fallback posts after search error")
                return fallback_results
            except Exception as fallback_error:
                logger.error(f"Fallback post query error: {str(fallback_error)}")
                return []

    def list(self, request):
        """Main search endpoint with performance optimizations"""
        try:
            self.request = request
            query = request.GET.get('q', '').strip()
            search_type = request.GET.get('type', 'all').lower()
            page = int(request.GET.get('page', '1'))
            page_size = int(request.GET.get('page_size', '20'))
            bypass_cache = request.GET.get('refresh', '').lower() == 'true'
            # Add a flag to use the simple search directly
            use_simple_search = request.GET.get('simple', '').lower() == 'true'
            
            # Get client IP for logging
            ip_address = request.META.get('REMOTE_ADDR')

            logger.info(f"Search request - query: {query}, type: {search_type}, page: {page}, bypass_cache: {bypass_cache}, use_simple_search: {use_simple_search}")

            results = {
                'posts': [],
                'users': []
            }
            
            # Set up pagination metadata
            pagination = {
                'page': page,
                'page_size': page_size,
                'has_more_posts': False,
                'has_more_users': False,
                'total_posts': 0,
                'total_users': 0
            }

            # Track the search query asynchronously to avoid performance impact
            if query:
                try:
                    # Use a thread to log search asynchronously
                    SearchQueryModel.objects.create(
                        query=query,
                        user=request.user
                    )
                except Exception as e:
                    logger.error(f"Error logging search query: {str(e)}")
            
            # If empty query, return trending content instead of empty results
            if not query:
                logger.info("Empty query, returning trending content")
                
                if search_type in ['all', 'posts']:
                    trending_posts = Post.objects.select_related('author').order_by('-trending_score__score', '-created_at')
                    trending_posts = self._prepare_post_queryset(trending_posts)
                    # Paginate
                    start = (page - 1) * page_size
                    end = start + page_size
                    paginated_posts = trending_posts[start:end]
                    total_posts = trending_posts.count()
                    
                    results['posts'] = PostSerializer(
                        paginated_posts, 
                        many=True, 
                        context={'request': request}
                    ).data
                    
                    pagination['has_more_posts'] = total_posts > end
                    pagination['total_posts'] = total_posts
                
                if search_type in ['all', 'users']:
                    # Return users with most followers
                    trending_users = User.objects.annotate(
                        followers_count=Count('followers')
                    ).order_by('-followers_count')
                    # Paginate
                    start = (page - 1) * page_size
                    end = start + page_size
                    paginated_users = trending_users[start:end]
                    total_users = trending_users.count()
                    
                    results['users'] = UserSerializer(
                        paginated_users,
                        many=True,
                        context={'request': request}
                    ).data
                    
                    pagination['has_more_users'] = total_users > end
                    pagination['total_users'] = total_users
                
                return Response({
                    'success': True,
                    'data': results,
                    'pagination': pagination
                })

            # Get posts if requested
            if search_type in ['all', 'posts']:
                try:
                    # Determine whether to use simple search
                    if use_simple_search:
                        # Use simple search directly
                        simple_post_results = simple_search(query, Post, ['title', 'description', 'content'], 40)
                        all_posts = PostSerializer(
                            self._prepare_post_queryset(simple_post_results),
                            many=True,
                            context={'request': request}
                        ).data
                    else:
                        # Try advanced search first
                        all_posts = self._search_posts(query)
                        
                        # If no results, try simple search as fallback
                        if not all_posts:
                            logger.info(f"Advanced search returned no results for '{query}', trying simple search")
                            simple_post_results = simple_search(query, Post, ['title', 'description', 'content'], 40)
                            all_posts = PostSerializer(
                                self._prepare_post_queryset(simple_post_results),
                                many=True,
                                context={'request': request}
                            ).data
                    
                    total_posts = len(all_posts)
                    
                    # Paginate
                    start = (page - 1) * page_size
                    end = start + page_size
                    results['posts'] = all_posts[start:end] if start < total_posts else []
                    
                    pagination['has_more_posts'] = total_posts > end
                    pagination['total_posts'] = total_posts
                    
                    logger.info(f"Found {total_posts} posts, returning {len(results['posts'])} for page {page}")
                    
                    # Log search asynchronously
                    self._log_search(
                        request.user, 
                        query, 
                        total_posts, 
                        'POSTS',
                        ip_address
                    )
                except Exception as e:
                    logger.error(f"Error searching posts: {str(e)}", exc_info=True)

            # Get users if requested
            if search_type in ['all', 'users']:
                try:
                    # Determine whether to use simple search
                    if use_simple_search:
                        # Use simple search directly
                        simple_user_results = simple_search(query, User, ['username', 'first_name', 'last_name', 'email', 'bio'], 40)
                        all_users = UserSerializer(
                            simple_user_results,
                            many=True,
                            context={'request': request}
                        ).data
                    else:
                        # Try advanced search first
                        all_users = self._search_users(query)
                        
                        # If no results, try simple search as fallback
                        if not all_users:
                            logger.info(f"Advanced search returned no results for '{query}', trying simple search")
                            simple_user_results = simple_search(query, User, ['username', 'first_name', 'last_name', 'email', 'bio'], 40)
                            all_users = UserSerializer(
                                simple_user_results,
                                many=True,
                                context={'request': request}
                            ).data
                    
                    total_users = len(all_users)
                    
                    # Paginate
                    start = (page - 1) * page_size
                    end = start + page_size
                    results['users'] = all_users[start:end] if start < total_users else []
                    
                    pagination['has_more_users'] = total_users > end
                    pagination['total_users'] = total_users
                    
                    logger.info(f"Found {total_users} users, returning {len(results['users'])} for page {page}")
                    
                    # Log search asynchronously if not already logged for posts
                    if search_type != 'all':
                        self._log_search(
                            request.user, 
                            query, 
                            total_users, 
                            'USERS',
                            ip_address
                        )
                except Exception as e:
                    logger.error(f"Error searching users: {str(e)}", exc_info=True)

            return Response({
                'success': True,
                'data': results,
                'pagination': pagination
            })

        except Exception as e:
            logger.error(f"Search error: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': "An error occurred while searching",
                'data': {
                    'posts': [],
                    'users': []
                }
            }, status=500)

    @action(detail=False, methods=['get'])
    def trending_searches(self, request):
        """Get trending searches from the last 7 days"""
        # Try to get from cache first
        cache_key = 'trending_searches'
        trending = cache.get(cache_key)
        
        if not trending:
            # Get trending searches from the last 7 days
            trending = SearchQueryModel.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=7)
            ).values('query').annotate(
                count=Count('id')
            ).order_by('-count')[:10]
            
            # Format the response
            trending = [
                {
                    'query': item['query'],
                    'count': item['count']
                } for item in trending
            ]
            
            # Cache for 1 hour
            cache.set(cache_key, trending, 60 * 60)
        
        return Response({
            'success': True,
            'data': trending
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search(request):
    query = request.GET.get('q', '').strip()
    if query:
        try:
            # Track the search query
            SearchQueryModel.objects.create(
                query=query,
                user=request.user
            )
        except Exception as e:
            logger.error(f"Error logging search query: {str(e)}")
            
    # Use the ViewSet for actual search
    viewset = SearchViewSet()
    viewset.request = request
    return viewset.list(request)
