# chat/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message
import json
import traceback
from django.utils import timezone

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    
    connections = {}  # Class variable to track connections

    async def connect(self):
        print("=== WebSocket Connection Attempt ===")
        
        try:
            self.room_id = self.scope['url_route']['kwargs']['room_id']
            self.room_group_name = f'chat_{self.room_id}'
            self.user = self.scope.get('user')

            print(f"Room ID: {self.room_id}")
            print(f"User: {self.user}")
            print(f"Is Authenticated: {self.user.is_authenticated}")

            # Accept the connection first
            await self.accept()
            
            # Then do the authentication and group setup
            if not self.user or not self.user.is_authenticated:
                print("Authentication failed")
                await self.close(code=4001)
                return

            # Verify room participation
            is_participant = await self.verify_participant_async()
            if not is_participant:
                print(f"Access denied - Not a participant")
                await self.close(code=4003)
                return

            # Add to room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            print(f"Connection fully established for user {self.user.id}")
            
            # Store the connection
            connection_key = f"{self.user.id}_{self.room_id}"
            if connection_key in self.connections:
                old_connection = self.connections[connection_key]
                print(f"Closing existing connection for {connection_key}")
                await old_connection.close()
            self.connections[connection_key] = self

            # Broadcast user's online status
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_status': {
                        'user_id': str(self.user.id),
                        'status': 'online'
                    }
                }
            )
            print(f"Sent online status to group {self.room_group_name}")

        except Exception as e:
            print(f"Connection error: {str(e)}")
            traceback.print_exc()
            await self.close(code=4000)

    async def disconnect(self, close_code):
        try:
            print(f"Disconnecting {self.channel_name} (User: {self.user.id}, Room: {self.room_id})")
            
            # Remove from connections dict
            connection_key = f"{self.user.id}_{self.room_id}"
            if connection_key in self.connections:
                del self.connections[connection_key]
            
            # Update last seen
            await self.update_last_seen_async()
            
            # Broadcast offline status
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_status': {
                        'user_id': str(self.user.id),
                        'status': 'offline',
                        'last_seen': timezone.now().isoformat()
                    }
                }
            )
            
            # Remove from room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            print(f"Removed {self.channel_name} from group {self.room_group_name}")
        except Exception as e:
            print(f"Error in disconnect: {str(e)}")
            traceback.print_exc()

    async def receive(self, text_data):
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
                is_participant = await self.verify_participant_async()
                if not is_participant:
                    print(f"[ERROR] User {self.user.id} is not a participant in room {self.room_id}")
                    return
                    
                # Save message
                message = await self.save_message_async(content)
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
                await self.channel_layer.group_send(
                    self.room_group_name,
                    message_data
                )
                print(f"[BROADCAST] Message sent to group")
                
        except Exception as e:
            print(f"[ERROR] Error processing message: {str(e)}")
            traceback.print_exc()

    async def chat_message(self, event):
        """
        Handler for chat_message type events.
        """
        try:
            # Send message to WebSocket
            await self.send(text_data=json.dumps(event))
        except Exception as e:
            print(f"Error in chat_message handler: {str(e)}")
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
            traceback.print_exc()

    @database_sync_to_async
    def verify_participant_async(self):
        return self.verify_participant()

    def verify_participant(self):
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            return room.participants.filter(id=self.user.id).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message_async(self, content):
        return self.save_message(content)

    def save_message(self, content):
        room = ChatRoom.objects.get(id=self.room_id)
        return Message.objects.create(
            room=room,
            sender=self.user,
            content=content
        )

    @database_sync_to_async
    def update_last_seen_async(self):
        # Implementation of update_last_seen method
        pass