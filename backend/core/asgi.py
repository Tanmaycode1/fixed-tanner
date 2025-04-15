import os
import django
import logging
from django.conf import settings

# Configure logging
logger = logging.getLogger('websockets')

# Set environment variable to indicate we're running in ASGI mode
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
os.environ.setdefault('USING_CHANNELS', 'True')  # Flag for identifying ASGI environment

django.setup()  # This needs to happen before importing any Django models

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator
from chat.middleware import WebSocketJWTAuthMiddleware
from chat.routing import websocket_urlpatterns
from channels.layers import get_channel_layer
from django.core.exceptions import PermissionDenied
from django.db import DatabaseError, connection
import asyncio
import time

# Create a simpler timeout middleware for better error handling
class TimeoutMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        """
        Add timeout protection for database operations to WebSocket connections
        """
        if scope['type'] != 'websocket':
            # Non-websocket requests go straight through
            return await self.app(scope, receive, send)
        
        # Set a timeout for the database connection in WebSocket context
        try:
            # Use django.db.connection directly which is safer
            with connection.cursor() as cursor:
                timeout_ms = getattr(settings, 'WEBSOCKET_DATABASE_TIMEOUT', 3000)
                cursor.execute(f"SET LOCAL statement_timeout = '{timeout_ms}';")
                logger.info(f"Set database timeout to {timeout_ms}ms for WebSocket connection")
        except Exception as e:
            logger.warning(f"Could not set database timeout for WebSocket: {str(e)}")
        
        # Pass through to the actual application
        return await self.app(scope, receive, send)

# Allow all origins for development, but wrap with timeout middleware
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": TimeoutMiddleware(
        OriginValidator(
            WebSocketJWTAuthMiddleware(
                URLRouter(websocket_urlpatterns)
            ),
            ["*"]  # Allow all origins for development
        )
    ),
})