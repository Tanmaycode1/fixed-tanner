# chat/middleware.py
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
import logging
import traceback

logger = logging.getLogger(__name__)

class WebSocketJWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken, TokenError
        
        User = get_user_model()
        
        print("=== WebSocket Authentication ===")
        print(f"Scope type: {scope['type']}")
        print(f"Headers: {dict(scope.get('headers', []))}")
        
        # Get token from headers or query params
        token = None
        
        # Try headers first
        headers = dict(scope.get('headers', []))
        auth_header = headers.get(b'authorization', b'').decode()
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        # Try query params if no token in headers
        if not token:
            query_string = scope.get("query_string", b"").decode()
            query_params = parse_qs(query_string)
            token = query_params.get('token', [None])[0]

        print(f"Token found: {'Yes' if token else 'No'}")

        try:
            if token:
                try:
                    access_token = AccessToken(token)
                    user_id = access_token['user_id']
                    print(f"Token decoded for user_id: {user_id}")
                    
                    user = await self.get_user(user_id, User)
                    if user:
                        print(f"Authenticated user: {user.username} (ID: {user.id})")
                        scope['user'] = user
                    else:
                        print(f"User not found for ID: {user_id}")
                        scope['user'] = AnonymousUser()
                except Exception as e:
                    print(f"Token validation error: {str(e)}")
                    scope['user'] = AnonymousUser()
            else:
                print("No token provided")
                scope['user'] = AnonymousUser()
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id, User):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None