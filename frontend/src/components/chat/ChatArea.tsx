import { useRef, useEffect, useState } from 'react';
import { User, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ChatRoom, Message } from '@/types/chat';

interface ChatAreaProps {
  room: ChatRoom;
  messages: Message[];
  isOnline: boolean;
  lastSeen: string | null;
  isConnected: boolean;
  onBack: () => void;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  loadingMore: boolean;
}

function getDateLabel(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'MMMM d, yyyy');
}

export default function ChatArea({
  room,
  messages,
  isOnline,
  lastSeen,
  isConnected,
  onBack,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onScroll,
  loadingMore
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    const isBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setIsAtBottom(isBottom);
    
    const isNearTop = target.scrollTop <= 100;
    if (isNearTop && !loadingMore) {
      console.log('Near top, loading more messages...');
      onScroll(e);
    }
  };

  // Format last seen time
  const getLastSeen = () => {
    if (!lastSeen) return '';
    const date = new Date(lastSeen);
    if (isToday(date)) {
      return `Last seen today at ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `Last seen yesterday at ${format(date, 'HH:mm')}`;
    }
    return `Last seen ${format(date, 'MMM d')} at ${format(date, 'HH:mm')}`;
  };

  return (
    <div className="flex flex-col fixed md:relative inset-0 md:inset-auto bg-white dark:bg-gray-900 h-[100dvh] md:h-full mt-16 mb-20 md:my-0">
      {/* Fixed Header - Higher z-index and proper positioning */}
      <div className="sticky top-16 md:top-0 flex-none p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {room.other_participant.avatar_url ? (
                <img 
                  src={room.other_participant.avatar_url} 
                  alt={room.other_participant.username} 
                  className="w-full h-full rounded-full" 
                />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="font-medium">{room.other_participant.username}</h2>
              <p className="text-sm text-gray-500">
                {isOnline ? (
                  <span className="flex items-center text-green-500">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Online
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    Offline
                    {lastSeen && ` • ${getLastSeen()}`}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Messages - Adjust padding for fixed elements */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-2 chat-messages-container"
        onScroll={handleScroll}
        style={{
          height: 'calc(100dvh - 216px)', // Account for top header (64px) + chat header (64px) + input (64px) + mobile nav (24px)
          paddingBottom: '24px' // Increase bottom padding
        }}
      >
        {loadingMore && (
          <div className="sticky top-0 flex justify-center py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        )}
        
        <div className="flex flex-col space-y-4">
          {messages.map((message, index) => {
            const messageDate = new Date(message.created_at);
            const previousMessage = messages[index - 1];
            
            // Show date label if first message or date changes from previous message
            const showDateLabel = index === 0 || 
              !isSameDay(messageDate, new Date(previousMessage?.created_at || ''));
            
            // Message is from the other participant if sender ID matches their ID
            const isFromOtherUser = message.sender === room.other_participant.id;
            
            return (
              <div key={message.id}>
                {showDateLabel && (
                  <div className="flex justify-center my-4">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getDateLabel(messageDate)}
                      </span>
                    </div>
                  </div>
                )}
                
                <div 
                  className={`flex ${isFromOtherUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isFromOtherUser
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <div className={`text-xs mt-1 ${
                      isFromOtherUser 
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-blue-100'
                    }`}>
                      {format(messageDate, 'HH:mm')}
                      {!isFromOtherUser && (
                        <span className="ml-2">
                          {message.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Input Area - Higher z-index and proper positioning */}
      <div className="sticky bottom-20 md:bottom-0 left-0 right-0 flex-none bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-20">
        <div className="p-4 max-w-[100%] mx-auto">
          <div className="flex items-center space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button
              onClick={onSendMessage}
              disabled={!newMessage.trim()}
              size="icon"
              className="flex-none"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 