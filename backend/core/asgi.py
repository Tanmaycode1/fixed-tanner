import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()  # This needs to happen before importing any Django models

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator, OriginValidator
from chat.middleware import WebSocketJWTAuthMiddleware
from chat.routing import websocket_urlpatterns

# Allow all origins for development
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": OriginValidator(
        WebSocketJWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        ),
        ["*"]  # Allow all origins for development
    ),
})