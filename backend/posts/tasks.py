from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, F, Q, Case, When, Value, FloatField, ExpressionWrapper
from django.db.models.functions import Cast
import logging
import random

logger = logging.getLogger(__name__)

@shared_task
def update_trending_scores(batch_size=500, max_posts=10000):
    """
    Update trending scores for all posts with an advanced algorithm
    
    Algorithm considers:
    - Recent interactions (likes, comments, views) with time decay
    - Engagement ratio (interactions per view)
    - Post age (newer posts get a boost)
    - Content type weights
    """
    try:
        from .models import Post, TrendingScore
        
        # Time windows for scoring
        now = timezone.now()
        last_day = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        last_month = now - timedelta(days=30)
        
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
                
        logger.info(f"Processed {total_processed} posts, updated {updated_count} trending scores")
        return {
            'processed': total_processed,
            'updated': updated_count
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error calculating trending scores: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'error': str(e)
        }

@shared_task
def update_user_preferences(batch_size=100, max_users=10000):
    """
    Update user content preferences based on their interactions
    This helps personalize the feed algorithm
    """
    try:
        from django.contrib.auth import get_user_model
        from .models import UserContentPreference
        
        User = get_user_model()
        
        # Get users with recent activity
        active_users = User.objects.filter(
            Q(liked_posts__created_at__gte=timezone.now() - timedelta(days=30)) |
            Q(postview__created_at__gte=timezone.now() - timedelta(days=30))
        ).distinct()[:max_users]
        
        total_processed = 0
        updated_count = 0
        
        # Process in batches
        for i in range(0, min(active_users.count(), max_users), batch_size):
            batch = active_users[i:i+batch_size]
            
            for user in batch:
                # Get or create preferences
                pref, created = UserContentPreference.objects.get_or_create(user=user)
                
                # Update preferences
                pref.update_preferences()
                updated_count += 1
                total_processed += 1
        
        logger.info(f"Processed {total_processed} users, updated {updated_count} content preferences")
        return {
            'processed': total_processed,
            'updated': updated_count
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error updating user preferences: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'error': str(e)
        }

@shared_task
def update_user_interest_graphs(batch_size=50, max_users=1000):
    """
    Update user interest graphs for personalized content and user suggestions
    More computationally intensive than preference updates, so runs less frequently
    and with smaller batches
    """
    try:
        from django.contrib.auth import get_user_model
        from .models import UserInterestGraph
        
        User = get_user_model()
        
        # Get users with social activity (following/followers)
        social_users = User.objects.annotate(
            follower_count=Count('followers'),
            following_count=Count('following')
        ).filter(
            Q(follower_count__gt=0) | Q(following_count__gt=0)
        ).order_by('-follower_count', '-following_count')[:max_users]
        
        total_processed = 0
        updated_count = 0
        
        # Process in batches
        for i in range(0, min(social_users.count(), max_users), batch_size):
            batch = social_users[i:i+batch_size]
            
            for user in batch:
                # Get or create graph
                graph, created = UserInterestGraph.objects.get_or_create(user=user)
                
                # Only update if needed (created or outdated)
                if created or (timezone.now() - graph.last_updated) > timedelta(days=1):
                    # Calculate interest graph
                    graph.calculate_interest_graph()
                    updated_count += 1
                
                total_processed += 1
        
        logger.info(f"Processed {total_processed} users, updated {updated_count} interest graphs")
        return {
            'processed': total_processed,
            'updated': updated_count
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error updating user interest graphs: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'error': str(e)
        }

@shared_task
def record_post_view(user_id, post_id, view_duration=0):
    """
    Record a post view with an optional view duration
    This is handled as a background task to avoid slowing down the API
    """
    try:
        from django.contrib.auth import get_user_model
        from .models import Post, PostView
        
        User = get_user_model()
        
        # Get user and post
        try:
            user = User.objects.get(id=user_id)
            post = Post.objects.get(id=post_id)
        except (User.DoesNotExist, Post.DoesNotExist) as e:
            logger.warning(f"Could not record view: {str(e)}")
            return False
            
        # Create or update view
        view, created = PostView.objects.get_or_create(
            user=user, 
            post=post,
            defaults={
                'view_duration': view_duration
            }
        )
        
        # If view already existed, update duration
        if not created and view_duration > 0:
            view.view_duration = view_duration
            view.save(update_fields=['view_duration'])
            
        return True
            
    except Exception as e:
        logger.error(f"Error recording post view: {str(e)}")
        return False 