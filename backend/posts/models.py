from django.db import models
import uuid
from django.core.files.storage import default_storage
from django.contrib.auth.models import User
from django.conf import settings
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from datetime import timedelta

class Post(models.Model):
    POST_TYPES = (
        ('NEWS', 'News'),
        ('AUDIO', 'Audio'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    type = models.CharField(max_length=5, choices=POST_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(
        upload_to='posts/images/',
        storage=default_storage,
        null=True,
        blank=True
    )
    audio_file = models.FileField(
        upload_to='audio/',
        storage=default_storage,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes = models.ManyToManyField(
        'users.User',
        related_name='liked_posts',
        blank=True
    )
    
    # Fields for improved feed algorithm
    tags = models.ManyToManyField('Tag', related_name='posts', blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['author']),
            models.Index(fields=['type']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        
        if self.type == 'AUDIO' and not self.image:
            raise ValidationError('Image is required for audio posts')  

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey('users.User', on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['author']),
            models.Index(fields=['created_at']),
        ]

class PostInteraction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='interactions')
    interaction_type = models.CharField(
        max_length=10,
        choices=[
            ('LIKE', 'Like'),
            ('SHARE', 'Share'),
            ('SAVE', 'Save')
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post', 'interaction_type')
        indexes = [
            models.Index(fields=['user', 'interaction_type']),
            models.Index(fields=['post', 'interaction_type']),
            models.Index(fields=['created_at']),
        ]

class TrendingScore(models.Model):
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='trending_score')
    score = models.FloatField(default=0)
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    share_count = models.IntegerField(default=0)
    last_calculated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-score']
        indexes = [
            models.Index(fields=['-score']),
        ]

class PostView(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    view_duration = models.PositiveIntegerField(default=0)  # Duration in seconds

    class Meta:
        unique_together = ('post', 'user')
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
        ]

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return self.name

class UserContentPreference(models.Model):
    """Store user content preferences for personalized feed"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='content_preferences')
    
    # Content type preferences (0-100 scale)
    news_preference = models.IntegerField(default=50)
    audio_preference = models.IntegerField(default=50)
    
    # Content recency preference
    recency_preference = models.IntegerField(default=50)  # 0=older content OK, 100=only new content
    
    # Diversity preference
    diversity_preference = models.IntegerField(default=50)  # 0=similar content, 100=diverse content
    
    # Auto-calculated tag preferences as JSON
    tag_preferences = models.JSONField(default=dict)
    
    # Last time preferences were updated
    last_updated = models.DateTimeField(auto_now=True)
    
    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create preferences for a user"""
        pref, created = cls.objects.get_or_create(user=user)
        
        # If new or hasn't been updated in a while, update
        if created or (timezone.now() - pref.last_updated) > timedelta(days=7):
            pref.update_preferences()
            
        return pref
    
    def update_preferences(self):
        """Update preferences based on user activity"""
        user = self.user
        
        # Calculate content type preferences based on views, interactions, etc.
        post_interactions = PostInteraction.objects.filter(user=user)
        post_views = PostView.objects.filter(user=user)
        
        if post_interactions.exists() or post_views.exists():
            # Count interactions by post type
            type_interactions = post_interactions.filter(
                post__type='NEWS'
            ).count()
            
            audio_interactions = post_interactions.filter(
                post__type='AUDIO'
            ).count()
            
            # Count views by post type
            news_views = post_views.filter(post__type='NEWS').count()
            audio_views = post_views.filter(post__type='AUDIO').count()
            
            # Calculate preferences based on interaction and view ratios
            total_interactions = type_interactions + audio_interactions
            total_views = news_views + audio_views
            
            if total_interactions > 0:
                self.news_preference = int((type_interactions / total_interactions) * 100)
                self.audio_preference = int((audio_interactions / total_interactions) * 100)
            elif total_views > 0:
                self.news_preference = int((news_views / total_views) * 100)
                self.audio_preference = int((audio_views / total_views) * 100)
            
            # Calculate tag preferences
            tag_counts = {}
            for interaction in post_interactions:
                for tag in interaction.post.tags.all():
                    tag_counts[tag.name] = tag_counts.get(tag.name, 0) + 1
            
            # Normalize to 0-100 scale
            if tag_counts:
                max_count = max(tag_counts.values())
                for tag, count in tag_counts.items():
                    tag_counts[tag] = int((count / max_count) * 100)
                
                self.tag_preferences = tag_counts
            
            self.save()

class UserInterestGraph(models.Model):
    """
    Track user relationships and interests for improved suggestions and feed algorithms
    This model uses a weighted graph approach to calculate user similarities
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interest_graph')
    
    # Store interest graph as JSON
    # Format: {
    #   "user_id_1": weight_1,
    #   "user_id_2": weight_2,
    #   ...
    # }
    interest_graph = models.JSONField(default=dict)
    
    # Last updated
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['last_updated']),
        ]
    
    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create interest graph for user"""
        graph, created = cls.objects.get_or_create(user=user)
        
        # If new or hasn't been updated in a while, recalculate
        if created or (timezone.now() - graph.last_updated) > timedelta(days=1):
            graph.calculate_interest_graph()
            
        return graph
    
    def calculate_interest_graph(self):
        """
        Calculate interest graph by analyzing:
        1. Direct connections (following/followers)
        2. Common interactions (posts liked by both users)
        3. Content similarity (similar content engagement)
        4. Second-degree connections
        """
        user = self.user
        interest_graph = {}
        
        # 1. Direct connections
        # Following gets high weight (direct interest from user)
        for followed_user in user.following.all():
            interest_graph[str(followed_user.id)] = interest_graph.get(str(followed_user.id), 0) + 10
        
        # Followers get medium weight (interest from others)
        for follower in user.followers.all():
            interest_graph[str(follower.id)] = interest_graph.get(str(follower.id), 0) + 5
        
        # 2. Common interactions
        # Get posts liked by user
        liked_posts = user.liked_posts.all()
        
        # For each liked post, find other users who liked it
        for post in liked_posts:
            for liker in post.likes.all():
                if liker.id != user.id:
                    interest_graph[str(liker.id)] = interest_graph.get(str(liker.id), 0) + 2
        
        # 3. Content similarity
        # Get post interactions (likes, saves)
        post_interactions = PostInteraction.objects.filter(
            user=user
        ).values_list('post_id', flat=True)
        
        # Find users with similar interactions
        similar_users = PostInteraction.objects.filter(
            post_id__in=post_interactions
        ).exclude(
            user=user
        ).values('user').annotate(
            common_count=Count('user')
        ).order_by('-common_count')[:50]
        
        # Add to graph with weight based on common count
        for similar_user in similar_users:
            user_id = str(similar_user['user'])
            interest_graph[user_id] = interest_graph.get(user_id, 0) + similar_user['common_count']
        
        # 4. Second-degree connections (friends of friends)
        # For efficiency, limit to top connections
        top_connections = sorted(
            interest_graph.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:20]
        
        for user_id, _ in top_connections:
            try:
                connected_user = type(user).objects.get(id=user_id)
                for followed_user in connected_user.following.all():
                    if str(followed_user.id) != str(user.id):
                        interest_graph[str(followed_user.id)] = interest_graph.get(str(followed_user.id), 0) + 1
            except:
                pass
        
        # Remove any connection to self
        if str(user.id) in interest_graph:
            del interest_graph[str(user.id)]
        
        # Save the updated graph
        self.interest_graph = interest_graph
        self.save()
        
        return interest_graph
        
    def get_suggested_users(self, limit=10):
        """Get suggested users based on interest graph"""
        user = self.user
        
        # Get interest graph
        graph = self.interest_graph
        
        # Filter out users already followed
        following_ids = set(str(uid) for uid in user.following.values_list('id', flat=True))
        
        # Sort by weight
        suggested_users = [
            (user_id, weight) 
            for user_id, weight in graph.items() 
            if user_id not in following_ids
        ]
        
        suggested_users.sort(key=lambda x: x[1], reverse=True)
        
        # Return suggested user IDs and weights
        return suggested_users[:limit]
