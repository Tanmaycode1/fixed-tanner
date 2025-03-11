import os
from rest_framework import permissions

class APIKeyPermission(permissions.BasePermission):
    """
    Custom permission to check for valid API key in request headers
    """
    def has_permission(self, request, view):
        # Always allow OPTIONS requests for CORS
        if request.method == 'OPTIONS':
            return True
            
        api_key_header = request.headers.get('X-API-Key')
        expected_api_key = os.getenv('ADMIN_API_KEY')
        
        if not expected_api_key:
            # If ADMIN_API_KEY is not set in environment, deny all requests
            return False
            
        return api_key_header == expected_api_key

class IsSuperuserOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow superusers or admins
    """
    def has_permission(self, request, view):
        return request.user and (request.user.is_superuser or request.user.is_staff)

class IsModeratorOrAbove(permissions.BasePermission):
    """
    Custom permission to allow superusers, admins, and moderators
    """
    def has_permission(self, request, view):
        if not request.user:
            return False
            
        if request.user.is_superuser or request.user.is_staff:
            return True
            
        try:
            return request.user.role.role_type in ['SUPERUSER', 'ADMIN', 'MODERATOR']
        except:
            return False 