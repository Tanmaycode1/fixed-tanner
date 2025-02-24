from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
import logging

logger = logging.getLogger(__name__)

class WebSocketJWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Import here to avoid app registry issues
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken, TokenError
        
        User = get_user_model()
        
        print("=== WebSocket Authentication ===")
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        print(f"Query string: {query_string}")
        print(f"Token found: {'Yes' if token else 'No'}")

        try:
            if token:
                access_token = AccessToken(token)
                user = await self.get_user(access_token['user_id'], User)
                if user:
                    print(f"Authenticated user: {user.id}")
                    scope['user'] = user
                    return await super().__call__(scope, receive, send)
                else:
                    print("User not found")
            else:
                print("No token provided")
            
            return await send({
                "type": "websocket.close",
                "code": 4001,
            })
            
        except TokenError as e:
            print(f"Token validation error: {str(e)}")
            return await send({
                "type": "websocket.close",
                "code": 4001,
            })
        except Exception as e:
            print(f"Unexpected error during authentication: {str(e)}")
            return await send({
                "type": "websocket.close",
                "code": 4001,
            })

    @database_sync_to_async
    def get_user(self, user_id, User):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            print(f"User {user_id} not found")
            return None