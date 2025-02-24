import React, { useEffect, useState } from 'react';
import ChatService from '../services/chatService';
import chatApi from '../services/apiService';

function ChatRoom({ roomId }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatService, setChatService] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        // Load existing messages
        const loadMessages = async () => {
            try {
                const response = await chatApi.getRoomMessages(roomId);
                if (response.data.success) {
                    setMessages(response.data.data);
                }
            } catch (error) {
                console.error('Error loading messages:', error);
            }
        };

        // Initialize WebSocket connection
        const chat = new ChatService(roomId);
        
        chat.setOnMessageCallback((message) => {
            setMessages(prev => [...prev, message]);
        });

        chat.setOnStatusCallback((statusUpdate) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                if (statusUpdate.status === 'online') {
                    newSet.add(statusUpdate.user_id);
                } else {
                    newSet.delete(statusUpdate.user_id);
                }
                return newSet;
            });
        });

        setChatService(chat);
        loadMessages();

        return () => {
            if (chat) {
                chat.disconnect();
            }
        };
    }, [roomId]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && chatService) {
            chatService.sendMessage(newMessage);
            setNewMessage('');
        }
    };

    return (
        <div className="chat-room">
            <div className="online-users">
                <h3>Online Users</h3>
                {Array.from(onlineUsers).map(userId => (
                    <div key={userId} className="online-user">
                        {/* Replace with actual username from your user data */}
                        User {userId} 🟢
                    </div>
                ))}
            </div>
            <div className="messages">
                {messages.map((msg) => (
                    <div key={msg.id} className="message">
                        <strong>{msg.username}:</strong> {msg.message}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
}

export default ChatRoom; 