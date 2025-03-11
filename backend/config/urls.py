from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from django.contrib import admin

urlpatterns = [
    # API routes
    path('api/', include([
        path('chat/', include('chat.urls')),
        path('explore/', include('explore.urls')),  # For user search
        path('users/', include('users.urls')),
        path('admin-panel/', include('admin_panel.urls')),  # Admin panel URLs
        path('system-logs/', include('system_logs.urls')),  # System logs
    ])),
    
    # Websocket routes
    path('ws/', include('chat.routing')),
    
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)