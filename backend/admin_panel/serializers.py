from rest_framework import serializers
from django.contrib.auth import get_user_model
from system_logs.models import SystemLog, UserRole, ModeratorAction
from posts.models import Post
from .models import BulkUploadTask, BulkUploadUser

User = get_user_model()

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'is_superuser', 'date_joined',
            'last_login', 'bio', 'avatar', 'account_privacy',
            'social_links', 'notification_preferences'
        ]
        read_only_fields = ['date_joined', 'last_login']
        extra_kwargs = {
            'avatar': {'required': False},
            'bio': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'account_privacy': {'required': False},
            'social_links': {'required': False},
            'notification_preferences': {'required': False},
            'is_active': {'required': False},
            'is_staff': {'required': False},
            'is_superuser': {'required': False}
        }

class BulkUploadUserSerializer(serializers.ModelSerializer):
    """Serializer for users created or identified during bulk upload"""
    class Meta:
        model = BulkUploadUser
        fields = ['id', 'username', 'email', 'name', 'password', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']

class BulkUploadTaskSerializer(serializers.ModelSerializer):
    """Serializer for bulk upload tasks"""
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = BulkUploadTask
        fields = ['id', 'status', 'file_name', 'total_rows', 'processed_rows', 
                  'progress', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_progress(self, obj):
        """Get the progress percentage of the task"""
        return obj.progress_percentage

class SystemLogSerializer(serializers.ModelSerializer):
    user = AdminUserSerializer(read_only=True)
    
    class Meta:
        model = SystemLog
        fields = ['id', 'timestamp', 'level', 'type', 'user', 'action', 'details', 'ip_address', 'user_agent']
        read_only_fields = ['timestamp']

class UserRoleSerializer(serializers.ModelSerializer):
    user = AdminUserSerializer(read_only=True)
    created_by = AdminUserSerializer(read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role_type', 'permissions', 'created_at', 'updated_at', 'created_by']
        read_only_fields = ['created_at', 'updated_at']

class ModeratorActionSerializer(serializers.ModelSerializer):
    moderator = AdminUserSerializer(read_only=True)
    target_user = AdminUserSerializer(read_only=True)
    
    class Meta:
        model = ModeratorAction
        fields = ['id', 'moderator', 'action_type', 'target_user', 'reason', 'details', 'created_at']
        read_only_fields = ['created_at']

class AdminPostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    trending_data = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'type', 'title', 'description', 'image_url',
            'cover_image_url', 'audio_url', 'author', 'created_at',
            'updated_at', 'comments_count', 'likes_count', 'is_liked',
            'is_saved', 'trending_data'
        ]

    def get_image_url(self, obj):
        """Return image URL only for NEWS posts"""
        request = self.context.get('request')
        if obj.type == 'NEWS' and obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_cover_image_url(self, obj):
        """Return image URL for AUDIO posts as cover image"""
        request = self.context.get('request')
        if obj.type == 'AUDIO' and obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_audio_url(self, obj):
        """Return audio file URL"""
        request = self.context.get('request')
        if obj.audio_file and hasattr(obj.audio_file, 'url'):
            return request.build_absolute_uri(obj.audio_file.url) if request else obj.audio_file.url
        return None

    def get_author(self, obj):
        return {
            'id': str(obj.author.id),
            'username': obj.author.username,
            'first_name': obj.author.first_name,
            'last_name': obj.author.last_name,
            'email': obj.author.email,
            'bio': obj.author.bio,
            'avatar': obj.author.avatar.url if obj.author.avatar else None
        }

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saved_by.filter(user=request.user).exists()
        return False

    def get_trending_data(self, obj):
        return {
            'score': obj.trending_score if hasattr(obj, 'trending_score') else 0.0,
            'view_count': obj.views.count() if hasattr(obj, 'views') else 0,
            'like_count': obj.likes.count(),
            'comment_count': obj.comments.count(),
            'share_count': obj.shares.count() if hasattr(obj, 'shares') else 0
        } 