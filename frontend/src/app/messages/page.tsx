"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { chatApi, userApi } from '@/services/api';
import { User } from 'lucide-react';
import { ChatList } from '@/components/chat/ChatList';
import ChatArea from '../../components/chat/ChatArea';
import { ChatFiltersDialog } from '@/components/chat/ChatFiltersDialog';
import { Message, ChatRoom, Filters} from '@/types/chat';
import { SearchUser } from '@/types/user';
import axios from 'axios';

interface WebSocketMessage {
  type: string;
  message?: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
      avatar_url: string | null;
    };
    created_at: string;
    is_read: boolean;
  };
  user_status?: {
    user_id: string;
    status: 'online' | 'offline';
  };
}

interface LocalSearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  first_name?: string;
  last_name?: string;
}

export default function MessagesPage() {
  const [loading, setLoading] = useState(true);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchResults, setSearchResults] = useState<LocalSearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastSeenTimes, setLastSeenTimes] = useState<Map<string, string>>(new Map());

  // Load messages for a specific room
  const loadMessages = useCallback(async (roomId: string, pageNum = 1, append = false) => {
    try {
      setLoadingMore(true);
      const response = await chatApi.getMessages(roomId, pageNum);
      
      if (response.success && response.data?.results) {
        // Reverse the messages since we want oldest first in the UI
        const newMessages = [...response.data.results].reverse();
        setHasMore(!!response.data.next);
        
        setMessages(prev => {
          if (append) {
            // When loading older messages, deduplicate by message ID
            const uniqueMessages = [...newMessages, ...prev].reduce((acc, message) => {
              acc.set(message.id, message);
              return acc;
            }, new Map());
            
            return Array.from(uniqueMessages.values());
          } else {
            // Initial load - just use the new messages
            return newMessages;
          }
        });

        // Only scroll to bottom on initial load
        if (!append) {
          requestAnimationFrame(() => {
            const chatContainer = document.querySelector('.chat-messages-container');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // Load chat rooms
  const loadChatRooms = useCallback(async () => {
    try {
      const response = await chatApi.getRooms();
      console.log('Chat rooms response:', response);
      
      if (response.success && response.data?.results) {
        // Sort chat rooms by latest message, newest first
        const sortedRooms = [...response.data.results].sort((a: ChatRoom, b: ChatRoom) => {
          const dateA = a.last_message ? new Date(a.last_message.created_at) : new Date(0);
          const dateB = b.last_message ? new Date(b.last_message.created_at) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        console.log('Sorted chat rooms:', sortedRooms);
        setChatRooms(sortedRooms);
      } else {
        console.error('Failed to load chat rooms:', response);
        toast.error(response.message || 'Failed to load chat rooms');
      }
    } catch (error) {
      console.error('Error loading chat rooms:', error);
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search for users to start a conversation with
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      // Add simple=true and refresh=true query params to API call
      const url = `/api/users/search/?q=${encodeURIComponent(query)}&simple=true&refresh=true`;
      const response = await axios.get(url);
      
      if (response.data.success) {
        setSearchResults(response.data.data || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Create new chat room
  const createChatRoom = useCallback(async (userId: string) => {
    try {
      const response = await chatApi.createRoom(userId);
      if (response.success) {
        // Add new room at the beginning of the list
        setChatRooms(prev => [response.data, ...prev]);
        setSelectedRoom(response.data);
      } else {
        toast.error(response.message || 'Failed to create chat room');
      }
    } catch (error) {
      console.error('Error creating chat room:', error);
      toast.error('Failed to create chat room');
    }
  }, []);

  // First, set up WebSocket
  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const wsUrl = useMemo(() => {
    if (!selectedRoom) return '';
    const token = localStorage.getItem('access_token');
    if (!token) return '';
    
    // Remove trailing slash from wsBaseUrl to prevent double slashes
    const baseUrl = wsBaseUrl.endsWith('/') ? wsBaseUrl.slice(0, -1) : wsBaseUrl;
    return `${baseUrl}/chat/${selectedRoom.id}/?token=${token}`;
  }, [wsBaseUrl, selectedRoom]);

  const { sendMessage, isConnected, socket: wsSocket } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback((data: WebSocketMessage) => {
      console.log('WebSocket message received:', data);
      
      if (data.type === 'chat_message' && data.message) {
        const newMessage: Message = {
          id: data.message.id,
          content: data.message.content,
          sender: {
            id: data.message.sender.id,
            username: data.message.sender.username,
            avatar_url: data.message.sender.avatar_url
          },
          created_at: data.message.created_at,
          is_read: data.message.is_read,
          read_at: null,
          attachment: null,
          attachment_type: null,
          updated_at: data.message.created_at
        };
        
        // Add new message while deduplicating
        setMessages(prev => {
          // Check if message already exists
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });

        // Update chat room order
        if (selectedRoom) {
          setChatRooms(prev => {
            const updatedRooms = prev.map(room => {
              if (room.id === selectedRoom.id) {
                return {
                  ...room,
                  last_message: newMessage,
                  updated_at: newMessage.created_at
                };
              }
              return room;
            });
            
            return updatedRooms.sort((a, b) => {
              const dateA = a.last_message ? new Date(a.last_message.created_at) : new Date(0);
              const dateB = b.last_message ? new Date(b.last_message.created_at) : new Date(0);
              return dateB.getTime() - dateA.getTime();
            });
          });
        }
      } 
      else if (data.type === 'user_status' && data.user_status) {
        const userId = data.user_status.user_id;
        const status = data.user_status.status;
        
        // Only update if we have a selected room and this status is for the other participant
        if (selectedRoom && userId === selectedRoom.other_participant.id) {
          console.log(`Updating status for other participant: ${userId} to ${status}`);
          
          setOnlineUsers(prev => {
            if (status === 'online') {
              if (!prev.includes(userId)) {
                console.log('Adding user to online users');
                return [...prev, userId];
              }
            } else {
              console.log('Removing user from online users');
              // Update last seen time when user goes offline
              setLastSeenTimes(prev => {
                const newMap = new Map(prev);
                newMap.set(userId, new Date().toISOString());
                return newMap;
              });
              return prev.filter(id => id !== userId);
            }
            return prev;
          });
        }
      }
    }, [selectedRoom]),
    onConnect: useCallback(() => {
      console.log('Connected to chat room:', selectedRoom?.id);
      if (selectedRoom) {
        // Reload messages when WebSocket connects
        loadMessages(selectedRoom.id);
      }
    }, [selectedRoom, loadMessages]),
  });

  // Update socket reference when WebSocket connection changes
  useEffect(() => {
    if (wsSocket) {
      setSocket(wsSocket);
    }
  }, [wsSocket]);

  // Then define handleSendMessage using the sendMessage function
  const handleSendMessage = useCallback(() => {
    if (!selectedRoom || !newMessage.trim()) return;

    try {
      console.log('Sending message:', {
        type: 'chat_message',
        content: newMessage,
        room_id: selectedRoom.id
      });
      
      sendMessage({
        type: 'chat_message',
        content: newMessage,
        room_id: selectedRoom.id
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [selectedRoom, newMessage, sendMessage]);

  // Load initial chat rooms
  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  // Load messages when room is selected
  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
      // Mark room as read when selected
      chatApi.markRoomAsRead(selectedRoom.id);
    }
  }, [selectedRoom, loadMessages]);

  // Update scroll handler
  const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // Prevent multiple simultaneous loads
    if (loadingMore || !hasMore || !selectedRoom) return;
    
    // Check if we're at the top
    if (target.scrollTop <= 100) {
      console.log('Loading more messages...');
      const nextPage = page + 1;
      setPage(nextPage);
      
      // Save current scroll position and height
      const scrollHeight = target.scrollHeight;
      const scrollTop = target.scrollTop;
      
      try {
        await loadMessages(selectedRoom.id, nextPage, true);
        
        // Restore scroll position after new messages are loaded
        requestAnimationFrame(() => {
          const newScrollHeight = target.scrollHeight;
          const heightDifference = newScrollHeight - scrollHeight;
          target.scrollTop = scrollTop + heightDifference;
        });
      } catch (error) {
        console.error('Error loading more messages:', error);
      }
    }
  }, [page, hasMore, loadingMore, selectedRoom, loadMessages]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex bg-white dark:bg-gray-900 overflow-hidden">
      {/* Chat List */}
      <div className={`
        ${selectedRoom ? 'hidden md:flex' : 'flex'} 
        w-full md:w-80 border-r border-gray-200 dark:border-gray-800
        flex-col
      `}>
        <ChatList
          chatRooms={chatRooms}
          onSelectRoom={(room) => {
            setSelectedRoom(room);
            if (window.innerWidth < 768) {
              setTimeout(() => {
                const chatContainer = document.querySelector('.chat-messages-container');
                if (chatContainer) {
                  chatContainer.scrollTop = chatContainer.scrollHeight;
                }
              }, 100);
            }
          }}
          selectedRoom={selectedRoom}
          onSearch={searchUsers}
          searchResults={searchResults}
          searching={searching}
          onCreateRoom={createChatRoom}
        />
      </div>

      {/* Chat Area */}
      <div className={`
        ${selectedRoom ? 'block' : 'hidden md:block'} 
        flex-1 relative
        ${selectedRoom ? 'fixed md:relative inset-0 md:inset-auto' : ''}
      `}>
        {selectedRoom ? (
          <ChatArea
            room={selectedRoom}
            messages={messages}
            isOnline={onlineUsers.includes(selectedRoom.other_participant.id)}
            lastSeen={lastSeenTimes.get(selectedRoom.other_participant.id) || null}
            isConnected={isConnected}
            onBack={() => {
              setSelectedRoom(null);
              setPage(1);
            }}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            onScroll={handleScroll}
            loadingMore={loadingMore}
            socket={socket}
          />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Select a chat</h2>
              <p className="text-gray-500">Choose a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      <ChatFiltersDialog
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={async () => {
          if (selectedRoom) {
            const response = await chatApi.filterMessages(selectedRoom.id, filters);
            if (response.success) {
              setMessages(response.data || []);
              setShowFilters(false);
            }
          }
        }}
        onReset={() => {
          setFilters({});
          if (selectedRoom) {
            loadMessages(selectedRoom.id);
          }
          setShowFilters(false);
        }}
      />
    </div>
  );
}