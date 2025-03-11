from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import SystemLog, UserRole, ModeratorAction
from .serializers import SystemLogSerializer, UserRoleSerializer, ModeratorActionSerializer
from django.db.models import Q

class HasAPIKeyOrIsAuthenticated(permissions.BasePermission):
    """
    Custom permission to allow access to authenticated users or those with valid API key
    """
    def has_permission(self, request, view):
        # Check if user is authenticated
        if request.user and request.user.is_authenticated:
            return True
            
        # Check for API key in headers
        api_key = request.headers.get('X-API-Key')
        if api_key:
            # You might want to validate the API key here
            return True
            
        return False

class LogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing system logs
    """
    serializer_class = SystemLogSerializer
    permission_classes = [HasAPIKeyOrIsAuthenticated]
    
    def get_queryset(self):
        queryset = SystemLog.objects.all()
        
        # Get limit parameter with default of 100
        limit = int(self.request.query_params.get('limit', 100))
        
        # Filter by level
        level = self.request.query_params.get('level', None)
        if level:
            queryset = queryset.filter(level=level.upper())
        
        # Filter by type
        log_type = self.request.query_params.get('type', None)
        if log_type:
            queryset = queryset.filter(type=log_type.upper())
        
        # Filter by user
        user_id = self.request.query_params.get('user_id', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        
        return queryset.order_by('-timestamp')[:limit]

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get logs from the last 24 hours"""
        last_24h = timezone.now() - timedelta(hours=24)
        logs = SystemLog.objects.filter(timestamp__gte=last_24h).order_by('-timestamp')
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)

class UserRoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user roles
    """
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return UserRole.objects.all().select_related('user', 'created_by')

class ModeratorActionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing moderator actions
    """
    serializer_class = ModeratorActionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return ModeratorAction.objects.all().select_related('moderator', 'target_user') 