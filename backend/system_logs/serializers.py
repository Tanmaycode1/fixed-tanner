from rest_framework import serializers
from .models import SystemLog, UserRole, ModeratorAction
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class SystemLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = SystemLog
        fields = ['id', 'timestamp', 'level', 'type', 'user', 'action', 'details', 'ip_address', 'user_agent']
        read_only_fields = ['timestamp']

class UserRoleSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role_type', 'permissions', 'created_at', 'updated_at', 'created_by']
        read_only_fields = ['created_at', 'updated_at']

class ModeratorActionSerializer(serializers.ModelSerializer):
    moderator = UserSerializer(read_only=True)
    target_user = UserSerializer(read_only=True)
    
    class Meta:
        model = ModeratorAction
        fields = ['id', 'moderator', 'action_type', 'target_user', 'reason', 'details', 'created_at']
        read_only_fields = ['created_at'] 