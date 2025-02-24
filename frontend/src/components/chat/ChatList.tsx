import { useState } from 'react';
import { Search, User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { ChatRoom } from '@/types/chat';

interface ChatListProps {
  chatRooms: ChatRoom[];
  onSelectRoom: (room: ChatRoom) => void;
  selectedRoom: ChatRoom | null;
  onSearch: (query: string) => void;
  searchResults: any[];
  searching: boolean;
  onCreateRoom: (userId: string) => void;
}

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface SearchResultsProps {
  searching: boolean;
  results: SearchResult[];
  onCreateRoom: (userId: string) => void;
}

interface RoomListProps {
  rooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  onSelectRoom: (room: ChatRoom) => void;
}

interface UserAvatarProps {
  user: {
    username: string;
    avatar_url: string | null;
  };
}

function SearchResults({ searching, results, onCreateRoom }: SearchResultsProps) {
  if (searching) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {results.map((user: SearchResult) => (
        <button
          key={user.id}
          onClick={() => onCreateRoom(user.id)}
          className="w-full p-4 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <UserAvatar user={user} />
          <div className="text-left">
            <p className="font-medium">{user.username}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function RoomList({ rooms, selectedRoom, onSelectRoom }: RoomListProps) {
  // Helper function to format message time
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show date without year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show date with year
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {rooms.map((room: ChatRoom) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room)}
          className={`w-full p-4 hover:bg-gray-100 dark:hover:bg-gray-800 
            ${selectedRoom?.id === room.id ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
        >
          <div className="flex items-start space-x-3">
            <UserAvatar user={room.other_participant} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <p className="font-medium truncate">
                  {room.other_participant.username}
                </p>
                {room.last_message && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatMessageTime(room.last_message.created_at)}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                {room.last_message ? (
                  <p className="text-sm text-gray-500 truncate max-w-[180px]">
                    {room.last_message.content}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No messages yet
                  </p>
                )}
                {room.unread_count > 0 && (
                  <span className="ml-2 bg-primary text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                    {room.unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function UserAvatar({ user }: UserAvatarProps) {
  return (
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full" />
      ) : (
        <User className="h-5 w-5 text-primary" />
      )}
    </div>
  );
}

export function ChatList({
  chatRooms,
  onSelectRoom,
  selectedRoom,
  onSearch,
  searchResults,
  searching,
  onCreateRoom
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <>
      {/* Fixed Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Scrollable Chat/Search List */}
      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          <SearchResults
            searching={searching}
            results={searchResults}
            onCreateRoom={onCreateRoom}
          />
        ) : (
          <RoomList
            rooms={chatRooms}
            selectedRoom={selectedRoom}
            onSelectRoom={onSelectRoom}
          />
        )}
      </div>
    </>
  );
} 