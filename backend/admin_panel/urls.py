from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminPanelViewSet, StaffManagementViewSet, validate_api_key, BulkUploadViewSet

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'', AdminPanelViewSet, basename='admin-panel')

# Create a router for the bulk upload viewset
bulk_upload_router = DefaultRouter()
bulk_upload_router.register(r'bulk-upload', BulkUploadViewSet, basename='bulk-upload')

urlpatterns = [
    path('validate-key/', validate_api_key, name='validate-api-key'),
    
    # Dashboard endpoints
    path('dashboard-stats/', AdminPanelViewSet.as_view({'get': 'dashboard_stats'}), name='dashboard-stats'),
    path('dashboard/users/', AdminPanelViewSet.as_view({'get': 'user_list'}), name='user-list'),
    path('live-logs/', AdminPanelViewSet.as_view({'get': 'live_logs'}), name='live-logs'),
    
    # User management endpoints
    path('users/<str:pk>/details/', AdminPanelViewSet.as_view({'get': 'user_details'}), name='user-details'),
    path('users/<str:pk>/update/', AdminPanelViewSet.as_view({'put': 'update_user', 'patch': 'update_user'}), name='update-user'),
    path('users/<str:pk>/avatar/', AdminPanelViewSet.as_view({'post': 'update_avatar', 'delete': 'remove_avatar'}), name='user-avatar'),
    path('users/<str:pk>/delete/', AdminPanelViewSet.as_view({'delete': 'delete_user'}), name='delete-user'),
    
    # Post management
    path('post-list/', AdminPanelViewSet.as_view({'get': 'post_list'}), name='admin-post-list'),
    path('posts/<uuid:pk>/details/', AdminPanelViewSet.as_view({'get': 'post_details'}), name='admin-post-details'),
    path('posts/<uuid:pk>/delete/', AdminPanelViewSet.as_view({'delete': 'delete_post'}), name='admin-delete-post'),
    path('bulk-delete-posts/', AdminPanelViewSet.as_view({'post': 'bulk_delete_posts'}), name='admin-bulk-delete-posts'),
    path('post-stats/', AdminPanelViewSet.as_view({'get': 'post_stats'}), name='admin-post-stats'),
    path('create-post/', AdminPanelViewSet.as_view({'post': 'create_post'}), name='admin-create-post'),
    
    # Search endpoint
    path('search/', AdminPanelViewSet.as_view({'get': 'search'}), name='admin-search'),
    
    # Staff management endpoints
    path('staff/', include(router.urls)),
    
    # Bulk upload endpoints
    path('bulk-upload/upload/', BulkUploadViewSet.as_view({'post': 'upload_users'}), name='bulk-upload-users'),
    path('bulk-upload/tasks/', BulkUploadViewSet.as_view({'get': 'tasks'}), name='bulk-upload-tasks'),
    path('bulk-upload/tasks/<int:pk>/progress/', BulkUploadViewSet.as_view({'get': 'progress'}), name='bulk-upload-progress'),
    path('bulk-upload/tasks/<int:pk>/users/', BulkUploadViewSet.as_view({'get': 'users'}), name='bulk-upload-users'),
] 