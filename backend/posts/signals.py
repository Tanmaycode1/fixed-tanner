from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings

import logging
logger = logging.getLogger(__name__)

# Try/except blocks to handle cases where migrations haven't been run yet
try:
    from .models import Post, PostInteraction, UserContentPreference, UserInterestGraph, PostView
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    @receiver(post_save, sender=PostInteraction)
    def update_user_preferences_on_interaction(sender, instance, created, **kwargs):
        """
        When a user interacts with a post, update their content preferences
        """
        if created:
            try:
                # Get or create user preferences
                user_prefs, _ = UserContentPreference.objects.get_or_create(user=instance.user)
                
                # If the preference hasn't been updated in the last day, update it now
                if (timezone.now() - user_prefs.last_updated).days >= 1:
                    user_prefs.update_preferences()
                    logger.debug(f"Updated content preferences for user {instance.user.id} based on interaction")
            except Exception as e:
                logger.error(f"Error updating user preferences: {str(e)}")
    
    @receiver(post_save, sender=PostView)
    def update_user_preferences_on_view(sender, instance, created, **kwargs):
        """
        When a user views a post, update their content preferences
        but with a lower frequency than for direct interactions
        """
        if created:
            try:
                # Only update preferences occasionally for views (1 in 10 chance)
                import random
                if random.random() < 0.1:  # 10% chance to update
                    # Get or create user preferences
                    user_prefs, _ = UserContentPreference.objects.get_or_create(user=instance.user)
                    
                    # If the preference hasn't been updated in the last 3 days, update it now
                    if (timezone.now() - user_prefs.last_updated).days >= 3:
                        user_prefs.update_preferences()
                        logger.debug(f"Updated content preferences for user {instance.user.id} based on view")
            except Exception as e:
                logger.error(f"Error updating user preferences on view: {str(e)}")
    
    @receiver(m2m_changed, sender=User.following.through)
    def update_interest_graph_on_follow(sender, instance, action, reverse, model, pk_set, **kwargs):
        """
        When a user follows or unfollows another user, update their interest graph
        """
        try:
            if action in ['post_add', 'post_remove']:
                # Only proceed if the instance is a User (could be called from either side of the relationship)
                if isinstance(instance, User):
                    # Get or create interest graph
                    graph, _ = UserInterestGraph.objects.get_or_create(user=instance)
                    
                    # Recalculate the graph
                    graph.calculate_interest_graph()
                    logger.debug(f"Updated interest graph for user {instance.id} after follow/unfollow")
        except Exception as e:
            logger.error(f"Error updating interest graph: {str(e)}")
    
    @receiver(m2m_changed, sender=Post.likes.through)
    def update_interest_graph_on_like(sender, instance, action, reverse, model, pk_set, **kwargs):
        """
        When a user likes a post, update their interest graph
        The interest graph depends on like data to determine user similarity
        """
        try:
            if action == 'post_add':
                if reverse:
                    # The 'instance' is a User, and pk_set contains Post IDs
                    user = instance
                else:
                    # The 'instance' is a Post, and pk_set contains User IDs
                    # We need to process each user who liked the post
                    for user_id in pk_set:
                        try:
                            user = User.objects.get(id=user_id)
                            
                            # Get or create interest graph
                            graph, _ = UserInterestGraph.objects.get_or_create(user=user)
                            
                            # Only update occasionally to save resources (1 in 5 likes)
                            import random
                            if random.random() < 0.2:  # 20% chance
                                # Recalculate the graph
                                graph.calculate_interest_graph()
                                logger.debug(f"Updated interest graph for user {user.id} after like")
                        except User.DoesNotExist:
                            continue
        except Exception as e:
            logger.error(f"Error updating interest graph on like: {str(e)}")
            
except (ImportError, RuntimeError):
    # Models may not be available yet (during migrations)
    logger.warning("Could not register post app signals - models may not be available yet.") 