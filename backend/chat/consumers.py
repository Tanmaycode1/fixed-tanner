from channels.generic.websocket import WebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message
import json
import asyncio
from rest_framework_simplejwt.tokens import AccessToken
from django.utils import timezone

User = get_user_model()

class ChatConsumer(WebsocketConsumer):
    
    connections = {}  # Class variable to track connections

    async def connect(self):
        print("=== WebSocket Connection Attempt ===")
        print(f"Scope: {self.scope}")
        
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope.get('user')

        print(f"Room ID: {self.room_id}")
        print(f"User: {self.user}")
        print(f"Channel Name: {self.channel_name}")
        print(f"Room Group Name: {self.room_group_name}")

        if not self.user or self.user.is_anonymous:
            print("Authentication failed - user not found or anonymous")
            self.close(code=4001)
            return

        try:
            # Add to room group first
            async_to_sync(self.channel_layer.group_add)(
                self.room_group_name,
                self.channel_name
            )
            print(f"Added {self.channel_name} to group {self.room_group_name}")

            # Then accept the connection
            self.accept()
            print(f"Connection accepted for user {self.user.id} in room {self.room_id}")

            # Store the connection
            connection_key = f"{self.user.id}_{self.room_id}"
            if connection_key in self.connections:
                old_connection = self.connections[connection_key]
                print(f"Closing existing connection for {connection_key}")
                old_connection.close()
            self.connections[connection_key] = self

            # Broadcast user's online status
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_status': {
                        'user_id': self.user.id,
                        'status': 'online'
                    }
                }
            )
            print(f"Sent online status to group {self.room_group_name}")

        except Exception as e:
            print(f"Error during connection setup: {e}")
            self.close(code=4003)

    async def disconnect(self, close_code):
        try:
            print(f"Disconnecting {self.channel_name} (User: {self.user.id}, Room: {self.room_id})")
            
            # Remove from connections dict
            connection_key = f"{self.user.id}_{self.room_id}"
            if connection_key in self.connections:
                del self.connections[connection_key]
            
            # Update last seen
            await self.update_last_seen()
            
            # Broadcast offline status
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_status': {
                        'user_id': self.user.id,
                        'status': 'offline',
                        'last_seen': timezone.now().isoformat()
                    }
                }
            )
            
            # Remove from room group
            async_to_sync(self.channel_layer.group_discard)(
                self.room_group_name,
                self.channel_name
            )
            print(f"Removed {self.channel_name} from group {self.room_group_name}")
        except Exception as e:
            print(f"Error in disconnect: {str(e)}")
            import traceback
            traceback.print_exc()

    def receive(self, text_data):
        print(f"[RECEIVE] Message from user {self.user.id} in channel {self.channel_name}")
        print(f"[RECEIVE] Raw message: {text_data}")
        
        message_type = None
        content = None

        # First try to parse as JSON
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            content = data.get('content')
            print(f"[INFO] Successfully parsed JSON message: {data}")
        except json.JSONDecodeError:
            # If not JSON, treat as raw text message
            print(f"[INFO] Message is not JSON, treating as raw text")
            message_type = 'chat_message'
            content = text_data

        # Process the message
        if not message_type or not content:
            print(f"[ERROR] Invalid message format: type={message_type}, content={content}")
            return

        try:
            if message_type == 'chat_message':
                # Verify participant
                if not self.verify_participant():
                    print(f"[ERROR] User {self.user.id} is not a participant in room {self.room_id}")
                    return
                    
                # Save message
                message = self.save_message(content)
                print(f"[SUCCESS] Saved message {message.id} from {self.user.id}")
                
                # Prepare message data
                message_data = {
                    'type': 'chat_message',
                    'message': {
                        'id': str(message.id),
                        'content': message.content,
                        'sender': {
                            'id': str(message.sender.id),
                            'username': message.sender.username,
                            'avatar': message.sender.avatar.url if message.sender.avatar else None
                        },
                        'created_at': message.created_at.isoformat(),
                        'is_read': message.is_read
                    }
                }
                
                print(f"[BROADCAST] Sending message to group {self.room_group_name}")
                async_to_sync(self.channel_layer.group_send)(
                    self.room_group_name,
                    message_data
                )
                print(f"[BROADCAST] Message sent to group")
                
        except Exception as e:
            print(f"[ERROR] Error processing message: {str(e)}")
            import traceback
            traceback.print_exc()

    async def user_status(self, event):
        """
        Handler for user_status type events.
        """
        try:
            print(f"user_status handler called in {self.channel_name}")
            print(f"Event data: {event}")
            
            # Send status update to WebSocket
            await self.send(text_data=json.dumps(event))
        except Exception as e:
            print(f"Error in user_status handler: {str(e)}")
            import traceback
            traceback.print_exc()

    def verify_participant(self):
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            return room.participants.filter(id=self.user.id).exists()
        except ChatRoom.DoesNotExist:
            return False

    def save_message(self, content):
        room = ChatRoom.objects.get(id=self.room_id)
        return Message.objects.create(
            room=room,
            sender=self.user,
            content=content
        )

    async def update_last_seen(self):
        # Implementation of update_last_seen method
        pass