// types/chat.ts
import { User } from './user';

export interface Message {
  id: string;
  content: string;
  sender: string;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  attachment: string | null;
  attachment_type: string | null;
  updated_at: string;
}

export interface ChatRoom {
  id: string;
  participants: User[];
  created_at: string;
  updated_at: string;
  last_message: Message | null;
  unread_count: number;
  other_participant: User;
}

export interface ChatState {
  activeRoom: ChatRoom | null;
  rooms: ChatRoom[];
  messages: Record<string, Message[]>;
  loading: boolean;
  error: string | null;
}

export interface Filters {
  start_date?: string;
  end_date?: string;
  is_read?: boolean;
  sender_id?: string;
  has_attachment?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WebSocketMessage {
  type: 'chat_message' | 'user_status';
  message?: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
      avatar: string | null;
    };
    created_at: string;
    is_read: boolean;
  };
  user_id?: string;
  status?: 'online' | 'offline';
}
