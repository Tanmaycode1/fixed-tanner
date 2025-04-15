from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import ValidationError
from django.db.models import F, Count, ExpressionWrapper, FloatField, Case, When, Exists, OuterRef, Q
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import json
from rest_framework.exceptions import PermissionDenied
from django.db import models

from .models import Post, Comment, PostInteraction, TrendingScore
from .serializers import PostSerializer, CommentSerializer, PostInteractionSerializer
from users.serializers import UserSerializer
# from chat.models import ChatRoom, Message
from core.decorators import handle_exceptions, cache_response
from core.utils import handle_uploaded_file
from core.views import BaseViewSet
from core.db.decorators import use_primary_database, UsePrimaryDatabaseMixin

class PostViewSet(UsePrimaryDatabaseMixin, BaseViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'author']
    ordering_fields = ['created_at', 'likes_count', 'comments_count']
    model_name = 'post'

    def get_permissions(self):
        """
        Override to set custom permissions per action
        """
        if self.action in ['list', 'retrieve', 'feed', 'trending']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Post.objects.select_related('author', 'trending_score')\
            .prefetch_related('likes', 'comments')\
            .annotate(
                likes_count=Count('likes', distinct=True),
                comments_count=Count('comments', distinct=True)
            ).order_by('-created_at')  # Add default ordering
        
        if self.request.user.is_authenticated:
            queryset = queryset.annotate(
                is_liked=Exists(
                    Post.likes.through.objects.filter(
                        post_id=OuterRef('pk'),
                        user_id=self.request.user.id
                    )
                )
            )
        else:
            # For unauthenticated users, set is_liked to False
            queryset = queryset.annotate(
                is_liked=Case(
                    When(pk__isnull=False, then=False),
                    default=False,
                    output_field=models.BooleanField(),
                )
            )
        
        following = self.request.query_params.get('following', None)
        if following == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(author__in=self.request.user.following.all())
            
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            post = self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            
            # Re-serialize the post to include all fields
            response_serializer = self.get_serializer(post)
            
            return Response({
                'success': True,
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED, headers=headers)
            
        except ValidationError as e:
            return Response({
                'success': False,
                'error': str(e),
                'errors': e.detail if hasattr(e, 'detail') else None
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @handle_exceptions
    def perform_create(self, serializer):
        """Create a new post with media handling"""
        try:
            # Get files and post type
            image = self.request.FILES.get('image')
            audio_file = self.request.FILES.get('audio_file')
            post_type = self.request.data.get('type')

            # Handle image file
            image_path = None
            if image:
                try:
                    if not image.content_type.startswith('image/'):
                        raise ValidationError('Invalid image file type')
                    image_path = handle_uploaded_file(
                        image, 
                        directory='posts/images',
                        is_image=True
                    )
                except Exception as e:
                    raise ValidationError(f'Error processing image: {str(e)}')

            # Handle audio file
            audio_path = None
            if audio_file:
                try:
                    if not audio_file.content_type.startswith('audio/'):
                        raise ValidationError('Invalid audio file type')
                    audio_path = handle_uploaded_file(
                        audio_file, 
                        directory='posts/audio',
                        is_image=False
                    )
                except Exception as e:
                    # Cleanup image if audio fails
                    if image_path:
                        default_storage.delete(image_path)
                    raise ValidationError(f'Error processing audio: {str(e)}')

            # Create post with media paths
            post = serializer.save(
                author=self.request.user,
                image=image_path,
                audio_file=audio_path
            )
            
            # Create trending score
            TrendingScore.objects.create(post=post)
            
            return post

        except Exception as e:
            # Cleanup any uploaded files on error
            if image_path:
                default_storage.delete(image_path)
            if audio_path:
                default_storage.delete(audio_path)
            raise ValidationError(str(e))
        
    @handle_exceptions
    def perform_update(self, serializer):
        """Update post with media handling"""
        instance = self.get_object()
        image = self.request.FILES.get('image')
        audio_file = self.request.FILES.get('audio_file')

        # Handle image update
        if image:
            if instance.image:
                default_storage.delete(instance.image.name)
            image_path = handle_uploaded_file(image, 'posts/images')
            serializer.save(image=image_path)

        # Handle audio update
        if audio_file:
            if instance.audio_file:
                default_storage.delete(instance.audio_file.name)
            audio_path = handle_uploaded_file(audio_file, 'posts/audio')
            serializer.save(audio_file=audio_path)

        serializer.save()
        self._invalidate_post_caches(instance.id)

    @handle_exceptions
    def perform_destroy(self, instance):
        """Delete post and associated media"""
        if instance.image:
            default_storage.delete(instance.image.name)
        if instance.audio_file:
            default_storage.delete(instance.audio_file.name)
            
        self._invalidate_post_caches(instance.id)
        instance.delete()

    @action(detail=False, methods=['get'])
    def feed(self, request):
        """
        Advanced personalized feed with multiple sections and infinite scrolling support.
        
        Query parameters:
        - page: Page number (default: 1)
        - section: One of 'following', 'recommended', 'trending', 'discover', 'all' (default: 'all')
        - limit: Number of posts per section (default: 10)
        - personalize: Whether to apply user preferences (default: True)
        """
        try:
            # Get query parameters
            page = int(request.query_params.get('page', 1))
            section = request.query_params.get('section', 'all').lower()
            limit_per_section = min(int(request.query_params.get('limit', 10)), 50)  # Cap at 50
            personalize = request.query_params.get('personalize', 'true').lower() == 'true'
            
            # Determine if we need debug info
            debug_mode = request.query_params.get('debug', 'false').lower() == 'true'

            # Base queryset
            queryset = self.get_queryset()
            
            # Initialize result sections and metadata
            result_data = {
                'success': True,
                'data': {
                    'sections': {},
                    'metadata': {
                        'has_more': False,
                        'current_page': page,
                        'sections_included': []
                    }
                }
            }
            
            # Get user content preferences if authenticated and personalization is enabled
            user_preferences = None
            interest_graph = None
            if request.user.is_authenticated and personalize:
                from .models import UserContentPreference, UserInterestGraph
                user_preferences = UserContentPreference.get_or_create_for_user(request.user)
                interest_graph = UserInterestGraph.get_or_create_for_user(request.user)
            
            # Calculate offsets for pagination
            offset = (page - 1) * limit_per_section
            
            # Add sections based on request
            sections_to_include = []
            if section == 'all':
                if request.user.is_authenticated:
                    sections_to_include = ['following', 'recommended', 'trending', 'discover']
                else:
                    sections_to_include = ['trending', 'discover']
            else:
                sections_to_include = [section]
            
            # Keep track of seen post IDs to avoid duplicates across sections
            seen_post_ids = set()
            
            # Add posts for each requested section
            for current_section in sections_to_include:
                # Skip sections that don't apply to unauthenticated users
                if not request.user.is_authenticated and current_section in ['following', 'recommended']:
                    continue
                
                section_posts, has_more = self._get_section_posts(
                    request=request,
                    queryset=queryset,
                    section=current_section,
                    limit=limit_per_section,
                    offset=offset,
                    user_preferences=user_preferences,
                    interest_graph=interest_graph,
                    seen_post_ids=seen_post_ids,
                    debug_mode=debug_mode
                )
                
                if section_posts:
                    serializer = self.get_serializer(section_posts, many=True)
                    result_data['data']['sections'][current_section] = serializer.data
                    result_data['data']['metadata']['sections_included'].append(current_section)
                    result_data['data']['metadata']['has_more'] = result_data['data']['metadata']['has_more'] or has_more
                    
                    # Add seen posts to avoid duplicates
                    seen_post_ids.update([post.id for post in section_posts])
            
            # For backward compatibility with frontend expecting a paginated format
            if page == 1 and 'trending' in result_data['data']['sections']:
                trending_posts = result_data['data']['sections']['trending']
                result_data['data']['results'] = trending_posts
                result_data['data']['count'] = len(trending_posts)
                result_data['data']['next'] = result_data['data']['metadata']['has_more']
                result_data['data']['previous'] = None
            
            # Add total counts by section to metadata
            if request.user.is_authenticated:
                result_data['data']['metadata']['counts'] = {
                    'following': queryset.filter(author__in=request.user.following.all()).count() if 'following' in sections_to_include else 0,
                    'recommended': min(500, queryset.count()) if 'recommended' in sections_to_include else 0,  # Estimate
                    'trending': queryset.filter(trending_score__score__gt=0).count() if 'trending' in sections_to_include else 0,
                    'discover': queryset.count() if 'discover' in sections_to_include else 0,
                }
            else:
                result_data['data']['metadata']['counts'] = {
                    'trending': queryset.filter(trending_score__score__gt=0).count() if 'trending' in sections_to_include else 0,
                    'discover': queryset.count() if 'discover' in sections_to_include else 0,
                }
            
            return Response(result_data)
            
        except Exception as e:
            import traceback
            print(f"Feed Error: {str(e)}")
            print(traceback.format_exc())
            # Ultimate fallback: Get any recent posts
            try:
                fallback_posts = self.get_queryset().order_by('-created_at')[:10]
                serializer = self.get_serializer(fallback_posts, many=True)
                # Return in a format compatible with the old and new frontend
                response_data = {
                    'success': True,
                    'data': {
                        'sections': {
                            'fallback': serializer.data
                        },
                        'metadata': {
                            'has_more': fallback_posts.count() > 0,
                            'current_page': 1,
                            'sections_included': ['fallback']
                        },
                        # For backward compatibility
                        'results': serializer.data,
                        'count': fallback_posts.count(),
                        'next': fallback_posts.count() > 0,
                        'previous': None
                    }
                }
                return Response(response_data)
            except Exception as inner_e:
                return Response({
                    'success': False,
                    'error': str(inner_e)
                }, status=status.HTTP_400_BAD_REQUEST)
    
    def _get_section_posts(self, request, queryset, section, limit, offset, 
                          user_preferences=None, interest_graph=None, 
                          seen_post_ids=None, debug_mode=False):
        """Helper method to get posts for a specific feed section with scoring"""
        from django.db.models import Case, When, Value, FloatField, F, ExpressionWrapper
        from django.db.models.functions import Cast
        from django.utils import timezone
        from datetime import timedelta
        import random
        
        if seen_post_ids is None:
            seen_post_ids = set()
        
        # Exclude posts already seen in other sections
        if seen_post_ids:
            queryset = queryset.exclude(id__in=seen_post_ids)
        
        # Add debug fields if requested
        debug_fields = {}
        if debug_mode:
            debug_fields = {
                'base_score': 0.0,
                'recency_score': 0.0,
                'interaction_score': 0.0,
                'relevance_score': 0.0,
                'personalization_score': 0.0,
                'final_score': 0.0,
            }
        
        # Different scoring logic based on section
        if section == 'following':
            # Posts from users the current user follows
            if not request.user.is_authenticated:
                return [], False
                
            # Base queryset: posts from followed users
            section_queryset = queryset.filter(author__in=request.user.following.all())
            
            # Apply personalization if available
            personalization_expr = Value(1.0, output_field=FloatField())
            if user_preferences:
                # Boost posts matching user tag preferences
                personalization_expr = Case(
                    *[
                        When(
                            tags__name=tag_name, 
                            then=Value(tag_weight / 100.0)
                        ) 
                        for tag_name, tag_weight in user_preferences.tag_preferences.items()
                    ],
                    default=Value(0.5),
                    output_field=FloatField()
                )
                
                # Boost post types based on preferences
                personalization_expr = ExpressionWrapper(
                    personalization_expr * Case(
                        When(type='NEWS', then=Value(user_preferences.news_preference / 50.0)),
                        When(type='AUDIO', then=Value(user_preferences.audio_preference / 50.0)),
                        default=Value(1.0),
                        output_field=FloatField()
                    ),
                    output_field=FloatField()
                )
            
            # Prepare annotations
            section_queryset = section_queryset.annotate(
                # Base score (interactions)
                base_score=ExpressionWrapper(
                    (Cast('likes_count', FloatField()) * 1.0) +
                    (Cast('comments_count', FloatField()) * 2.0),
                    output_field=FloatField()
                ),
                
                # Recency score
                recency_score=Case(
                    When(created_at__gte=timezone.now() - timedelta(hours=24), then=Value(20.0)),
                    When(created_at__gte=timezone.now() - timedelta(hours=48), then=Value(15.0)),
                    When(created_at__gte=timezone.now() - timedelta(days=7), then=Value(10.0)),
                    When(created_at__gte=timezone.now() - timedelta(days=30), then=Value(5.0)),
                    default=Value(1.0),
                    output_field=FloatField()
                ),
                
                # Interaction score
                interaction_score=ExpressionWrapper(
                    F('trending_score__score') * 2.0,
                    output_field=FloatField()
                ),
                
                # Personalization score
                personalization_score=personalization_expr
            )
            
            # Combine all scores for final ranking
            section_queryset = section_queryset.annotate(
                final_score=ExpressionWrapper(
                    (F('base_score') * 0.3) +
                    (F('recency_score') * 0.4) +
                    (F('interaction_score') * 0.2) +
                    (F('personalization_score') * 0.1),
                    output_field=FloatField()
                )
            )
            
            # Order by final score
            section_queryset = section_queryset.order_by('-final_score', '-created_at')
        
        elif section == 'recommended':
            # Personalized recommendations based on user interest graph
            if not request.user.is_authenticated:
                return [], False
                
            # Base posts from users in the interest graph
            related_user_ids = []
            if interest_graph and interest_graph.interest_graph:
                # Sort by weight and take top 50
                sorted_interests = sorted(
                    interest_graph.interest_graph.items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:50]
                related_user_ids = [uid for uid, _ in sorted_interests]
            
            # If we have related users, prioritize their content
            if related_user_ids:
                # Create a Case expression for boosting posts from interested users
                interest_boosts = []
                for i, user_id in enumerate(related_user_ids):
                    weight = 1.0 - (i / len(related_user_ids))  # Declining weight based on position
                    interest_boosts.append(
                        When(author_id=user_id, then=Value(weight * 10.0))
                    )
                
                interest_boost_expr = Case(
                    *interest_boosts,
                    default=Value(0.1),
                    output_field=FloatField()
                )
                
                # Prepare annotations with interest boost
                section_queryset = queryset.exclude(author=request.user).annotate(
                    # Base score (interactions)
                    base_score=ExpressionWrapper(
                        (Cast('likes_count', FloatField()) * 1.0) +
                        (Cast('comments_count', FloatField()) * 2.0),
                        output_field=FloatField()
                    ),
                    
                    # Recency score
                    recency_score=Case(
                        When(created_at__gte=timezone.now() - timedelta(hours=24), then=Value(15.0)),
                        When(created_at__gte=timezone.now() - timedelta(hours=48), then=Value(10.0)),
                        When(created_at__gte=timezone.now() - timedelta(days=7), then=Value(5.0)),
                        default=Value(1.0),
                        output_field=FloatField()
                    ),
                    
                    # Interest graph score
                    interest_score=interest_boost_expr,
                    
                    # Trending score
                    trending_boost=ExpressionWrapper(
                        F('trending_score__score') * 2.0,
                        output_field=FloatField()
                    ),
                    
                    # Combine for final score
                    final_score=ExpressionWrapper(
                        (F('base_score') * 0.2) +
                        (F('recency_score') * 0.2) +
                        (F('interest_score') * 0.5) +
                        (F('trending_boost') * 0.1),
                        output_field=FloatField()
                    )
                )
                
                # Order by final score
                section_queryset = section_queryset.order_by('-final_score', '-created_at')
            else:
                # Fallback to trending if no interest graph
                section_queryset = queryset.exclude(author=request.user).order_by('-trending_score__score', '-created_at')
                
        elif section == 'trending':
            # Top trending posts
            section_queryset = queryset.filter(trending_score__score__gt=0).order_by('-trending_score__score', '-created_at')
            
        elif section == 'discover':
            # Discovery: random blend with slight recency bias
            # Exclude posts from followed users if authenticated
            if request.user.is_authenticated:
                followed_user_ids = request.user.following.values_list('id', flat=True)
                section_queryset = queryset.exclude(author_id__in=followed_user_ids)
            else:
                section_queryset = queryset
                
            # Add randomness factor while keeping some recency bias
            section_queryset = section_queryset.annotate(
                random_factor=Value(random.random(), output_field=FloatField()),
                recency_score=Case(
                    When(created_at__gte=timezone.now() - timedelta(days=7), then=Value(0.7)),
                    When(created_at__gte=timezone.now() - timedelta(days=30), then=Value(0.5)),
                    default=Value(0.3),
                    output_field=FloatField()
                ),
                final_score=ExpressionWrapper(
                    (F('random_factor') * 0.7) + (F('recency_score') * 0.3),
                    output_field=FloatField()
                )
            ).order_by('-final_score')
            
        else:
            # Invalid section, return empty list
            return [], False
        
        # Apply pagination
        total_count = section_queryset.count()
        section_queryset = section_queryset[offset:offset + limit]
        
        # Check if there are more posts
        has_more = total_count > (offset + limit)
        
        return list(section_queryset), has_more

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
     """Like/unlike a post"""
     post = self.get_object()
     user = request.user
    
     if user in post.likes.all():
        post.likes.remove(user)
        return Response({
            'success': True, 
            'message': 'Post unliked',
            'liked': False
        })
     else:
        post.likes.add(user)
        # Create notification if post is not by the liker
        if post.author != user:
            post.author.create_like_notification(
                liker=user,
                post=post
            )
        return Response({
            'success': True, 
            'message': 'Post liked',
            'liked': True
        })

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        """Get or add comments for a post"""
        try:
            post = self.get_object()
            
            if request.method == 'GET':
                # Allow anyone to view comments
                comments = Comment.objects.filter(post=post)\
                    .select_related('author')\
                    .order_by('-created_at')

                serializer = CommentSerializer(
                    comments,
                    many=True,
                    context={'request': request}
                )
                
                return Response({
                    'success': True,
                    'data': serializer.data
                })
            else:  # POST
                # Require authentication for posting comments
                if not request.user.is_authenticated:
                    return Response({
                        'success': False,
                        'error': 'Authentication required'
                    }, status=status.HTTP_401_UNAUTHORIZED)
                
                # Get content from request data
                content = request.data.get('content')
                if not content:
                    return Response({
                        'success': False,
                        'error': 'Content is required'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Create the comment
                comment = Comment.objects.create(
                    post=post,
                    author=request.user,
                    content=content
                )
                
                # Return the serialized comment
                serializer = CommentSerializer(
                    comment,
                    context={'request': request}
                )
                
                return Response({
                    'success': True,
                    'data': serializer.data
                })
                
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def likers(self, request, pk=None):
        """Get users who liked the post"""
        post = self.get_object()
        page = self.paginate_queryset(post.likes.all())
        
        if page is not None:
            serializer = UserSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
            
        serializer = UserSerializer(post.likes.all(), many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def record_view(self, request, pk=None):
        """
        Record a view of a post asynchronously.
        Accepts optional view_duration parameter for engagement metrics.
        """
        try:
            post = self.get_object()
            
            # Get duration if provided
            view_duration = request.data.get('view_duration', 0)
            try:
                view_duration = int(view_duration)
            except (ValueError, TypeError):
                view_duration = 0
                
            # Use task to record view asynchronously (reduces API response time)
            from .tasks import record_post_view
            
            if request.user.is_authenticated:
                # For authenticated users, we'll use their ID
                record_post_view.delay(
                    user_id=str(request.user.id), 
                    post_id=str(post.id),
                    view_duration=view_duration
                )
                
                return Response({
                    'success': True,
                    'message': 'View recorded'
                })
            else:
                # For anonymous users, we still count the view but not linked to a user
                # This updates global metrics but not personalization
                try:
                    post.trending_score.view_count += 1
                    post.trending_score.save(update_fields=['view_count'])
                except:
                    pass
                    
                return Response({
                    'success': True,
                    'message': 'Anonymous view recorded'
                })
                
        except Exception as e:
            logger.error(f"Error recording view: {str(e)}")
            return Response({
                'success': False,
                'message': 'Failed to record view'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def user_interaction(self, request, pk=None):
        """Get current user's interaction with the post"""
        post = self.get_object()
        interactions = PostInteraction.objects.filter(
            post=post,
            user=request.user
        ).values_list('interaction_type', flat=True)
        
        return Response({
            'is_liked': request.user in post.likes.all(),
            'has_commented': post.comments.filter(author=request.user).exists(),
            'interactions': list(interactions)
        })

    @action(detail=False, methods=['get'])
    def trending(self, request):
        """Get trending posts or recent posts"""
        try:
            # Get all NEWS posts, ordered by created_at as a fallback
            posts = self.get_queryset().filter(type='NEWS').order_by('-created_at')
            print(f"Found {posts.count()} NEWS posts")  # Debug log
            
            # Try to get posts with trending scores first
            trending_posts = posts.exclude(trending_score=None)\
                .order_by('-trending_score__score')[:10]
            print(f"Found {trending_posts.count()} trending posts")  # Debug log
            
            # If no trending posts, get recent posts
            if not trending_posts.exists():
                print("No trending posts found, using recent posts")  # Debug log
                trending_posts = posts[:10]
            
            serializer = self.get_serializer(trending_posts, many=True)
            response_data = {
                'success': True,
                'data': {
                    'results': serializer.data,
                    'count': len(serializer.data)
                }
            }
            print(f"Returning {len(serializer.data)} posts")  # Debug log
            return Response(response_data)
        except Exception as e:
            print(f"Error in trending endpoint: {str(e)}")  # Debug log
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'])
    def my_posts(self, request):
        """Get posts created by the current user"""
        try:
            # Get posts by current user
            posts = self.get_queryset().filter(author=request.user)
            
            # Apply pagination
            page = self.paginate_queryset(posts)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            serializer = self.get_serializer(posts, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['PUT'])
    def edit_comment(self, request, pk=None):
        """Edit a comment on the post"""
        try:
            comment_id = request.data.get('comment_id')
            content = request.data.get('content')
            
            if not comment_id or not content:
                return Response({
                    'success': False,
                    'error': 'comment_id and content are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            comment = Comment.objects.get(id=comment_id, post_id=pk)
            
            # Check if user is the author of the comment
            if comment.author != request.user:
                return Response({
                    'success': False,
                    'error': 'You can only edit your own comments'
                }, status=status.HTTP_403_FORBIDDEN)

            comment.content = content
            comment.save()

            serializer = CommentSerializer(
                comment,
                context={'request': request}
            )
            
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Comment.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Comment not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['DELETE'])
    def delete_comment(self, request, pk=None):
        """Delete a comment from the post"""
        try:
            comment_id = request.data.get('comment_id')
            
            if not comment_id:
                return Response({
                    'success': False,
                    'error': 'comment_id is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            comment = Comment.objects.get(id=comment_id, post_id=pk)
            
            # Check if user is the author of the comment
            if comment.author != request.user:
                return Response({
                    'success': False,
                    'error': 'You can only delete your own comments'
                }, status=status.HTTP_403_FORBIDDEN)

            comment.delete()
            
            return Response({
                'success': True,
                'message': 'Comment deleted successfully'
            })
        except Comment.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Comment not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def _update_trending_score(self, post):
        """Update post's trending score"""
        try:
            trending_score = post.trending_score
        except TrendingScore.DoesNotExist:
            trending_score = TrendingScore.objects.create(post=post)

        # Update counts
        trending_score.like_count = post.likes.count()
        trending_score.comment_count = post.comments.count()
        trending_score.share_count = PostInteraction.objects.filter(
            post=post,
            interaction_type='SHARE'
        ).count()

        # Calculate score based on time decay
        time_diff = timezone.now() - post.created_at
        hours_since_posted = time_diff.total_seconds() / 3600

        # Enhanced trending score formula
        score = (
            trending_score.like_count * 1.5 +
            trending_score.comment_count * 2.0 +
            trending_score.share_count * 2.5
        ) / (hours_since_posted + 2) ** 1.8

        trending_score.score = score
        trending_score.save()

    def _invalidate_post_caches(self, post_id=None):
        """Invalidate relevant caches"""
        if post_id:
            cache.delete(f'post:{post_id}')
        cache.delete_pattern('*feed*')
        cache.delete_pattern('*trending*')
        cache.delete('trending_posts')

    @action(detail=False, methods=['GET'])
    def user_posts(self, request):
        """Get all posts by a specific user"""
        try:
            user_id = request.query_params.get('user_id')
            post_type = request.query_params.get('type')  # Optional filter by post type
            
            if not user_id:
                return Response({
                    'success': False,
                    'error': 'user_id is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get base queryset for the user
            queryset = self.get_queryset().filter(author_id=user_id)
            
            # Apply type filter if provided
            if post_type:
                queryset = queryset.filter(type=post_type.upper())

            # Apply pagination
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'success': True,
                'data': {
                    'results': serializer.data,
                    'count': len(serializer.data)
                }
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'])
    @method_decorator(cache_page(300))  # Cache for 5 minutes
    @use_primary_database
    def highlights(self, request):
        """Get highlights: latest news, trending audio, and a random post"""
        try:
            # Get latest news post
            latest_news = self.get_queryset().filter(type='NEWS').order_by('-created_at').first()
            
            # Get trending audio post
            trending_audio = self.get_queryset().filter(type='AUDIO')\
                .exclude(trending_score=None)\
                .order_by('-trending_score__score', '-created_at').first()
            
            # If no trending audio, get latest audio
            if not trending_audio:
                trending_audio = self.get_queryset().filter(type='AUDIO')\
                    .order_by('-created_at').first()
            
            # Get a random post (excluding the ones already selected)
            excluded_ids = [p.id for p in [latest_news, trending_audio] if p]
            random_post = self.get_queryset().exclude(id__in=excluded_ids)\
                .order_by('?').first()
            
            # Serialize the posts
            serializer = self.get_serializer([
                post for post in [latest_news, trending_audio, random_post] 
                if post is not None
            ], many=True)
            
            # Format response with categories
            response_data = {
                'success': True,
                'data': {
                    'latest_news': serializer.data[0] if latest_news else None,
                    'trending_audio': serializer.data[1] if trending_audio else None,
                    'featured_post': serializer.data[2] if random_post else None
                }
            }
            
            return Response(response_data)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    @permission_classes([IsAdminUser])
    def calculate_trending_scores(self, request):
        """
        Admin action to calculate trending scores for all posts.
        This would typically be run by a scheduled task (e.g. celery beat)
        but can also be triggered manually by admins.
        """
        from django.db.models import Count, F, ExpressionWrapper, FloatField
        from django.utils import timezone
        from datetime import timedelta
        from .models import Post, TrendingScore
        
        try:
            # Time windows for scoring
            now = timezone.now()
            last_day = now - timedelta(days=1)
            last_week = now - timedelta(days=7)
            last_month = now - timedelta(days=30)
            
            # Process each post in batches
            batch_size = int(request.data.get('batch_size', 500))
            max_posts = int(request.data.get('max_posts', 10000))
            
            # Get posts ordered by recent interactions first
            posts = Post.objects.annotate(
                recent_likes=Count(
                    'likes', 
                    filter=Q(likes__created_at__gte=last_week)
                ),
                recent_comments=Count(
                    'comments', 
                    filter=Q(comments__created_at__gte=last_week)
                ),
                recent_views=Count(
                    'views', 
                    filter=Q(views__created_at__gte=last_week)
                )
            ).order_by(
                '-recent_likes', 
                '-recent_comments',
                '-recent_views',
                '-created_at'
            )[:max_posts]
            
            # Process in batches
            total_processed = 0
            updated_count = 0
            
            for i in range(0, min(posts.count(), max_posts), batch_size):
                batch = posts[i:i+batch_size]
                
                for post in batch:
                    # Get interaction counts for different time periods
                    day_likes = post.likes.filter(created_at__gte=last_day).count()
                    week_likes = post.likes.filter(created_at__gte=last_week).count()
                    month_likes = post.likes.filter(created_at__gte=last_month).count()
                    
                    day_comments = post.comments.filter(created_at__gte=last_day).count()
                    week_comments = post.comments.filter(created_at__gte=last_week).count()
                    month_comments = post.comments.filter(created_at__gte=last_month).count()
                    
                    day_views = post.views.filter(created_at__gte=last_day).count()
                    week_views = post.views.filter(created_at__gte=last_week).count()
                    month_views = post.views.filter(created_at__gte=last_month).count()
                    
                    # Calculate base interaction scores with time decay
                    likes_score = (day_likes * 10) + (week_likes * 5) + (month_likes * 1)
                    comments_score = (day_comments * 15) + (week_comments * 7) + (month_comments * 2)
                    views_score = (day_views * 1) + (week_views * 0.5) + (month_views * 0.1)
                    
                    # Engagement ratio (interactions per view)
                    total_views = post.views.count() or 1  # Avoid division by zero
                    engagement_ratio = (post.likes.count() + post.comments.count()) / total_views
                    
                    # Account for post age (newer posts get a boost)
                    age_factor = 1.0
                    post_age_days = (now - post.created_at).days + 1  # Avoid division by zero
                    
                    if post_age_days <= 1:
                        age_factor = 1.5
                    elif post_age_days <= 3:
                        age_factor = 1.2
                    elif post_age_days <= 7:
                        age_factor = 1.0
                    elif post_age_days <= 14:
                        age_factor = 0.8
                    elif post_age_days <= 30:
                        age_factor = 0.6
                    else:
                        age_factor = 0.4
                    
                    # Calculate final score
                    final_score = (
                        (likes_score * 1.0) +
                        (comments_score * 1.5) +
                        (views_score * 0.8)
                    ) * engagement_ratio * age_factor
                    
                    # Update or create trending score
                    trending_score, created = TrendingScore.objects.update_or_create(
                        post=post,
                        defaults={
                            'score': final_score,
                            'view_count': post.views.count(),
                            'like_count': post.likes.count(),
                            'comment_count': post.comments.count(),
                            'share_count': post.interactions.filter(interaction_type='SHARE').count(),
                            'last_calculated': now
                        }
                    )
                    
                    if created or trending_score.score != final_score:
                        updated_count += 1
                    
                    total_processed += 1
            
            return Response({
                'success': True,
                'data': {
                    'total_processed': total_processed,
                    'updated_count': updated_count
                },
                'message': f'Processed {total_processed} posts, updated {updated_count} trending scores'
            })
            
        except Exception as e:
            import traceback
            logger.error(f"Error calculating trending scores: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CommentViewSet(UsePrimaryDatabaseMixin, BaseViewSet):
    queryset = Comment.objects.select_related('author', 'post').order_by('-created_at')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    model_name = 'comment'

    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        return Comment.objects.select_related('author', 'post').order_by('-created_at')

    def perform_create(self, serializer):
        """Create a new comment"""
        comment = serializer.save(author=self.request.user)
        # Return the serialized comment with context
        return self.get_serializer(comment, context={'request': self.request}).data

    @action(detail=True, methods=['PUT'])
    def edit(self, request, pk=None):
        """Edit a comment"""
        comment = self.get_object()
        
        if comment.author != request.user:
            raise PermissionDenied("You can't edit this comment")
            
        serializer = self.get_serializer(
            comment, 
            data=request.data, 
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        
        # Return the updated comment with proper context
        return Response({
            'success': True,
            'data': self.get_serializer(comment, context={'request': request}).data
        })

    @action(detail=True, methods=['DELETE'])
    def delete(self, request, pk=None):
        """Delete a comment"""
        comment = self.get_object()
        
        if comment.author != request.user:
            raise PermissionDenied("You can't delete this comment")
            
        comment.delete()
        
        # Update post's comment count
        post = comment.post
        post.comments_count = F('comments_count') - 1
        post.save()
        
        return Response({
            'success': True,
            'message': 'Comment deleted successfully'
        })

    @action(detail=True, methods=['POST'])
    def like(self, request, pk=None):
        """Like/Unlike a comment"""
        comment = self.get_object()
        
        if request.user in comment.likes.all():
            comment.likes.remove(request.user)
            liked = False
        else:
            comment.likes.add(request.user)
            liked = True
            
        return Response({
            'success': True,
            'data': {
                'liked': liked,
                'likes_count': comment.likes.count()
            }
        })

    @action(detail=True, methods=['get'])
    def replies(self, request, pk=None):
        """Get replies to a comment"""
        comment = self.get_object()
        replies = comment.replies.select_related('author').order_by('-created_at')
        
        page = self.paginate_queryset(replies)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(replies, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """Add a reply to a comment"""
        parent_comment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            reply = serializer.save(
                author=request.user,
                parent_comment=parent_comment,
                post=parent_comment.post
            )
            
            # Update post's trending score
            post_viewset = PostViewSet()
            post_viewset._update_trending_score(parent_comment.post)
            
            return Response(self.get_serializer(reply).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def thread(self, request, pk=None):
        """Get full comment thread including parent and all replies"""
        comment = self.get_object()
        
        # If this is a reply, get its parent comment
        if comment.parent_comment:
            parent = comment.parent_comment
        else:
            parent = comment
            
        # Get all replies in thread
        replies = parent.replies.select_related('author').order_by('created_at')
        
        thread_data = {
            'parent': self.get_serializer(parent).data,
            'replies': self.get_serializer(replies, many=True).data
        }
        
        return Response(thread_data)

    @action(detail=False, methods=['GET'])
    def post_comments(self, request):
        """Get comments for a post"""
        post_id = request.query_params.get('post_id')
        if not post_id:
            return Response({
                'success': False,
                'error': 'post_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        comments = self.get_queryset().filter(post_id=post_id)
        serializer = self.get_serializer(
            comments, 
            many=True,
            context={'request': request}
        )
        
        return Response({
            'success': True,
            'data': serializer.data
        })

class PostInteractionViewSet(UsePrimaryDatabaseMixin, BaseViewSet):
    queryset = PostInteraction.objects.select_related('user', 'post')
    serializer_class = PostInteractionSerializer
    permission_classes = [IsAuthenticated]
    model_name = 'postinteraction'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['post', 'interaction_type']

    def get_queryset(self):
        return PostInteraction.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create a new interaction"""
        # Check if interaction already exists
        existing = PostInteraction.objects.filter(
            user=self.request.user,
            post=serializer.validated_data['post'],
            interaction_type=serializer.validated_data['interaction_type']
        ).first()
        
        if existing:
            raise ValidationError('Interaction already exists')
            
        serializer.save(user=self.request.user)
        
        # Update post's trending score
        post = serializer.validated_data['post']
        post_viewset = PostViewSet()
        post_viewset._update_trending_score(post)

    def perform_destroy(self, instance):
        """Remove an interaction"""
        if instance.user != self.request.user:
            raise ValidationError("Cannot delete another user's interaction")
            
        post = instance.post
        instance.delete()
        
        # Update post's trending score
        post_viewset = PostViewSet()
        post_viewset._update_trending_score(post)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get interaction statistics for the current user"""
        stats = {
            'likes_given': PostInteraction.objects.filter(
                user=request.user,
                interaction_type='LIKE'
            ).count(),
            'posts_shared': PostInteraction.objects.filter(
                user=request.user,
                interaction_type='SHARE'
            ).count(),
            'posts_saved': PostInteraction.objects.filter(
                user=request.user,
                interaction_type='SAVE'
            ).count(),
            'total_interactions': PostInteraction.objects.filter(
                user=request.user
            ).count(),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def saved_posts(self, request):
        """Get all posts saved by the current user"""
        saved_interactions = self.get_queryset().filter(
            interaction_type='SAVE'
        ).select_related('post', 'post__author')
        
        posts = [interaction.post for interaction in saved_interactions]
        
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = PostSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
            
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get user's recent interactions"""
        recent_interactions = self.get_queryset()\
            .select_related('post', 'post__author')\
            .order_by('-created_at')[:10]
            
        serializer = self.get_serializer(recent_interactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def post_stats(self, request, pk=None):
        """Get interaction statistics for a specific post"""
        interaction = self.get_object()
        post = interaction.post
        
        # Get interaction counts by type
        interaction_counts = PostInteraction.objects\
            .filter(post=post)\
            .values('interaction_type')\
            .annotate(count=Count('id'))
            
        stats = {
            item['interaction_type']: item['count'] 
            for item in interaction_counts
        }
        
        # Add additional stats
        stats.update({
            'total_interactions': sum(stats.values()),
            'unique_users': PostInteraction.objects\
                .filter(post=post)\
                .values('user')\
                .distinct()\
                .count()
        })
        
        return Response(stats)