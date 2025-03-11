from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminPanelViewSet, StaffManagementViewSet, validate_api_key

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'', AdminPanelViewSet, basename='admin-panel')

urlpatterns = [
    path('validate-key/', validate_api_key, name='validate-api-key'),
    
    # Dashboard endpoints
    path('dashboard-stats/', AdminPanelViewSet.as_view({'get': 'dashboard_stats'}), name='dashboard-stats'),
    path('dashboard/users/', AdminPanelViewSet.as_view({'get': 'user_list'}), name='user-list'),
    path('live-logs/', AdminPanelViewSet.as_view({'get': 'live_logs'}), name='live-logs'),
    
    # Bulk upload endpoints
    path('bulk-register-users/', AdminPanelViewSet.as_view({'post': 'bulk_register_users'}), name='bulk-register-users'),
    path('bulk-register-progress/', AdminPanelViewSet.as_view({'get': 'bulk_register_progress'}), name='bulk-register-progress'),
    path('bulk-register-results/', AdminPanelViewSet.as_view({'get': 'bulk_register_results'}), name='bulk-register-results'),
    path('bulk-register-download/', AdminPanelViewSet.as_view({'get': 'bulk_register_download'}), name='bulk-register-download'),
    path('bulk-upload-tasks/', AdminPanelViewSet.as_view({'get': 'bulk_upload_tasks'}), name='bulk-upload-tasks'),
    path('bulk-task-users/', AdminPanelViewSet.as_view({'get': 'bulk_task_users'}), name='bulk-task-users'),
    path('delete-bulk-task-users/', AdminPanelViewSet.as_view({'delete': 'delete_bulk_task_users'}), name='delete-bulk-task-users'),
    path('stop-bulk-task-processing/', AdminPanelViewSet.as_view({'post': 'stop_bulk_task_processing'}), name='stop-bulk-task-processing'),
    
    # User management endpoints
    path('users/<str:pk>/details/', AdminPanelViewSet.as_view({'get': 'user_details'}), name='user-details'),
    path('users/<str:pk>/update/', AdminPanelViewSet.as_view({'put': 'update_user', 'patch': 'update_user'}), name='update-user'),
    path('users/<str:pk>/avatar/', AdminPanelViewSet.as_view({'post': 'update_avatar', 'delete': 'remove_avatar'}), name='user-avatar'),
    path('users/<str:pk>/delete/', AdminPanelViewSet.as_view({'delete': 'delete_user'}), name='delete-user'),
    
    # Post management endpoints
    path('post-stats/', AdminPanelViewSet.as_view({'get': 'post_stats'}), name='post-stats'),
    
    # Staff management endpoints
    path('staff/', include(router.urls)),
] 