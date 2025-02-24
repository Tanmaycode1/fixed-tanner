import axios from 'axios';
import { toast } from 'react-hot-toast';
import { UserProfileUpdate } from '@/types/user';

// Create base API client
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  withCredentials: true,
});

// Add request interceptor to include credentials
apiClient.interceptors.request.use((config) => {
  config.withCredentials = true;
  return config;
});

// Error handler utility
export const handleApiError = (error: any) => {
  console.error('API Error:', error);
  
  if (error.response?.data) {
    const { data } = error.response;
    const status = error.response.status;

    // Handle specific status codes
    if (status === 404) {
      return { 
        success: false, 
        message: 'User not found',
        errors: {
          non_field_errors: ['No account found with this email address. Please check your email or sign up.']
        },
        status
      };
    }

    if (status === 401) {
      return { 
        success: false, 
        message: 'Incorrect password',
        errors: {
          non_field_errors: ['The password you entered is incorrect. Please try again.']
        },
        status
      };
    }

    return { 
      success: false, 
      message: data.message || 'An error occurred',
      errors: data.errors || {},
      status
    };
  }
  
  if (error.request) {
    return { 
      success: false, 
      message: 'Network error. Please check your internet connection.',
      errors: {},
      status: 0
    };
  }
  
  return { 
    success: false, 
    message: 'An unexpected error occurred',
    errors: {},
    status: 500
  };
};

// Export the base api instance
export const api = apiClient;

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const BASE_URL = API_URL.replace('/api', '');

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && !config.url?.includes('token/refresh')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error?.response?.status === 401 && !originalRequest?._retry && !originalRequest?.url?.includes('token/refresh')) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await api.post('/api/auth/token/refresh/', { refresh: refreshToken });
        localStorage.setItem('access_token', response.data.access);
        
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  constructor(
    message: string,
    public errorCode?: string,
    public status?: number,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(error: any): ApiError {
    if (error.response) {
      const { data, status } = error.response;
      if (data.detail) {
        return new ApiError(data.detail, 'API_ERROR', status);
      }
      if (typeof data === 'object' && !Array.isArray(data)) {
        const firstErrorKey = Object.keys(data)[0];
        const firstError = data[firstErrorKey];
        const message = Array.isArray(firstError) ? firstError[0] : firstError;
        return new ApiError(message, 'VALIDATION_ERROR', status, data);
      }
      return new ApiError(data.message || 'An error occurred', 'API_ERROR', status);
    }
    if (error.request) {
      return new ApiError('Network error', 'NETWORK_ERROR');
    }
    return new ApiError('An unexpected error occurred', 'UNKNOWN_ERROR');
  }

  get userMessage(): string {
    const errorMessages: Record<string, string> = {
      'API_ERROR': 'An error occurred while processing your request.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NETWORK_ERROR': 'Unable to connect to server. Please check your internet connection.',
      'UNKNOWN_ERROR': 'Something went wrong. Please try again later.',
    };
    return errorMessages[this.errorCode || ''] || this.message;
  }
}

export const getFullImageUrl = (path: string | null): string => {
  if (!path) return '/images/default-avatar.png';  // Return a default image path
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
};

// Add ApiResponse interface
export type ApiResponse<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  error?: string;
  status?: number;
  email_verified?: boolean;
};

// Define and export API services
export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<ApiResponse> => {
    try {
      localStorage.clear();
      const response = await api.post('/api/auth/login/', credentials);
      if (response.data.success) {
        const { tokens } = response.data.data;
        if (tokens) {
          localStorage.setItem('access_token', tokens.access);
          localStorage.setItem('refresh_token', tokens.refresh);
        }
        return response.data;
      }
      return {
        success: false,
        message: response.data.message || 'Login failed',
        errors: response.data.errors
      };
    } catch (error: any) {
      localStorage.clear();
      const status = error.response?.status;
      const errorMessage = status === 404 
        ? 'User not found' 
        : status === 401 
        ? 'Incorrect password'
        : 'An error occurred';

      const errorDetail = status === 404
        ? 'No account found with this email address. Please check your email or sign up.'
        : status === 401
        ? 'The password you entered is incorrect. Please try again.'
        : 'Please try again later.';

      return {
        success: false,
        message: errorMessage,
        errors: {
          non_field_errors: [errorDetail]
        },
        status
      };
    }
  },

  register: async (data: {
    email: string;
    password: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<ApiResponse> => {
    try {
      // If username is not provided, use email prefix
      const formattedData = {
        ...data,
        username: data.username || data.email.split('@')[0]
      };

      const response = await api.post('/api/auth/register/', formattedData);
      
      if (response.data.success) {
        const { tokens } = response.data.data;
        if (tokens) {
          localStorage.setItem('access_token', tokens.access);
          localStorage.setItem('refresh_token', tokens.refresh);
        }
        return response.data;
      }
      
      return {
        success: false,
        message: response.data.message || 'Registration failed',
        errors: response.data.errors
      };
    } catch (error: any) {
      return handleApiError(error);
    }
  },

  checkEmail: async (email: string): Promise<ApiResponse> => {
    try {
      const response = await api.get(`/api/users/check-email/${email}/`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error);
    }
  },

  logout: async (): Promise<ApiResponse> => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      
      // First clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      if (!refresh_token) {
        return { 
          success: true, 
          message: 'Logged out successfully' 
        };
      }

      // Then try to logout from backend
      try {
        await api.post('/api/auth/logout/', { refresh_token });
      } catch (error) {
        // Even if backend logout fails, we consider it successful since local storage is cleared
        console.log('Backend logout failed, but user is logged out locally');
      }

      return { 
        success: true, 
        message: 'Logged out successfully' 
      };
    } catch (error) {
      // If any error occurs, ensure local storage is cleared
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      return {
        success: false,
        message: 'Error during logout, but you have been logged out locally',
        errors: {
          non_field_errors: ['An error occurred during logout, but your session has been cleared locally']
        }
      };
    }
  },

  refreshToken: async (refresh: string) => {
    try {
      const response = await api.post('/api/auth/token/refresh/', { refresh });
      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  },

  verifyEmail: async (token: string) => {
    try {
      const response = await api.post('/api/auth/verify-email/', { token });
      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  },

  sendVerificationOtp: async (email: string) => {
    try {
      const response = await api.post('/api/users/send-verification-otp/', { email });
      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  },

  verifyEmailOtp: async (email: string, otp: string) => {
    try {
      const response = await api.post('/api/users/verify-email-otp/', { email, otp });
      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  }
};

export const userApi = {
  getProfile: async () => {
    try {
      const response = await api.get('/api/users/me/');
      if (response.data.success && response.data.data.avatar_url) {
        response.data.data.avatar_url = getFullImageUrl(response.data.data.avatar_url);
      }
      return response.data;
    } catch (error) {
      handleApiError(error);
      return { success: false };
    }
  },

  updateProfile: async (data: UserProfileUpdate) => {
    try {
      const response = await api.patch('/api/users/me/profile/', data);
      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  },

  updateAvatar: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await api.put('/api/users/me/avatar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success && response.data.data?.avatar_url) {
        response.data.data.avatar_url = getFullImageUrl(response.data.data.avatar_url);
      }

      return response.data;
    } catch (error: any) {
      handleApiError(error);
    }
  },

  getUserProfile: async (userId: string) => {
    try {
      const response = await api.get(`/api/users/profile/${userId}/`);
      if (response.data.success && response.data.data.avatar) {
        response.data.data.avatar_url = getFullImageUrl(response.data.data.avatar);
      }
      return response.data;
    } catch (error) {
      handleApiError(error);
      return { success: false };
    }
  },

  followUser: async (userId: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/users/${userId}/follow/`);
      return response.data;
    } catch (error) {
      return handleApiError(error); // Return the error response instead of undefined
    }
  },

  unfollowUser: async (userId: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/users/${userId}/unfollow/`);
      return response.data;
    } catch (error) {
      return handleApiError(error); // Return the error response instead of undefined
    }
  },

  getFollowers: async () => {
    try {
      const response = await api.get('/api/users/followers/');
      if (response.data && response.data.success) {
        return {
          success: true,
          data: {
            results: response.data.data.results.map((user: any) => ({
              ...user,
              avatar: user.avatar ? getFullImageUrl(user.avatar) : null
            }))
          }
        };
      }
      throw new Error(response.data.message || 'Failed to fetch followers');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  getFollowing: async () => {
    try {
      const response = await api.get('/api/users/following/');
      if (response.data && response.data.success) {
        return {
          success: true,
          data: {
            results: response.data.data.results.map((user: any) => ({
              ...user,
              avatar: user.avatar ? getFullImageUrl(user.avatar) : null
            }))
          }
        };
      }
      throw new Error(response.data.message || 'Failed to fetch following');
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  searchUsers: async (query: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/api/search/', {
        params: { 
          q: query,
          type: 'users'  // Specify we want users
        }
      });
      
      return {
        success: true,
        data: response.data.data.users || []
      };
    } catch (error: any) {
      console.error('Search Users Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to search users',
        data: []
      };
    }
  },

  getSuggestions: async () => {
    try {
      const response = await api.get('/api/users/suggestions/');
      // Convert avatar URLs in the response
      if (response.data.success && Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map((user: any) => ({
          ...user,
          avatar_url: getFullImageUrl(user.avatar_url)
        }));
      }
      return response.data;  // Return the whole response
    } catch (error: any) {
      console.error('Suggestions error:', error);
      return { success: false, data: [] };  // Return a properly structured error response
    }
  },
};

export const searchApi = {
  search: async (query: string, type: string = 'all', bypassCache: boolean = false) => {
    try {
      const response = await api.get('/api/search/', {
        params: { 
          q: query, 
          type,
          bypass_cache: bypassCache
        }
      });
      return { success: true, data: response.data.data };
    } catch (error: any) {
      console.error('Search error:', error);
      return { success: false, data: { posts: [], users: [] } };
    }
  },

  getTrending: async () => {
    try {
      const response = await api.get('/api/search/trending/');
      return response.data;
    } catch (error) {
      // Only log the error, don't throw
      console.error('Trending search error:', error);
      return {
        success: false,
        data: []
      };
    }
  }
};

export const chatApi = {
  getRooms: async () => {
    try {
      const response = await api.get('/api/chat/rooms/');
      return {
        success: true,
        data: response.data,  // This will be a paginated response with results array
        message: 'Chat rooms retrieved successfully'
      };
    } catch (error: unknown) {  // Add proper error typing
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Error fetching chat rooms:', error);
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch chat rooms',
        data: { results: [] }
      };
    }
  },

  createRoom: async (participantId: string) => {
    try {
      const response = await api.post('/api/chat/rooms/', {
        participant_id: participantId
      });
      
      if (response.data?.success) {
        // Transform avatar URL in response
        const roomData = response.data.data;
        if (roomData.other_participant?.avatar_url) {
          roomData.other_participant.avatar_url = getFullImageUrl(roomData.other_participant.avatar_url);
        }
        return {
          success: true,
          data: roomData,
          message: response.data.message || 'Chat room created successfully'
        };
      }
      
      return {
        success: false,
        message: response.data?.message || 'Failed to create chat room'
      };
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create chat room'
      };
    }
  },

  getMessages: async (roomId: string, page = 1) => {
    try {
      const response = await api.get(`/api/chat/rooms/${roomId}/messages/`, {
        params: { page }
      });
      return {
        success: true,
        data: response.data,
        message: 'Messages retrieved successfully'
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        return {
          success: false,
          message: (error.response as any)?.data?.message || 'Failed to fetch messages',
          data: { results: [], next: null, previous: null }
        };
      }
      return {
        success: false,
        message: 'Failed to fetch messages',
        data: { results: [], next: null, previous: null }
      };
    }
  },

  sendMessage: async (roomId: string, data: FormData | { content: string }): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/chat/rooms/${roomId}/messages/`, data, {
        headers: data instanceof FormData ? {
          'Content-Type': 'multipart/form-data'
        } : undefined
      });
      
      if (response.data?.success) {
        // Transform avatar URL in response
        const messageData = response.data.data;
        if (messageData.sender?.avatar_url) {
          messageData.sender.avatar_url = getFullImageUrl(messageData.sender.avatar_url);
        }
        return {
          success: true,
          data: messageData,
          message: 'Message sent successfully'
        };
      }
      
      return {
        success: false,
        message: response.data?.message || 'Failed to send message'
      };
    } catch (error: any) {
      console.error('Error sending message:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send message'
      };
    }
  },

  markRoomAsRead: async (roomId: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/chat/rooms/${roomId}/messages/mark-all-read/`);
      return {
        success: response.data?.success ?? false,
        message: response.data?.message || 'Room marked as read',
        data: response.data?.data
      };
    } catch (error: any) {
      console.error('Error marking room as read:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to mark room as read',
        error: error.message
      };
    }
  },

  markMessageAsRead: async (roomId: string, messageId: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/chat/rooms/${roomId}/messages/${messageId}/mark-read/`);
      return {
        success: response.data?.success || false,
        message: response.data?.message || 'Message marked as read'
      };
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to mark message as read'
      };
    }
  },

  deleteAllMessages: async (roomId: string): Promise<ApiResponse> => {
    try {
      const response = await api.delete(`/api/chat/rooms/${roomId}/messages/delete_all/`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting messages:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete messages',
        errors: {
          non_field_errors: ['Failed to delete messages']
        }
      };
    }
  },

  filterMessages: async (
    roomId: string, 
    filters: {
      start_date?: string;
      end_date?: string;
      is_read?: boolean;
      sender_id?: string;
      has_attachment?: boolean;
    }
  ): Promise<ApiResponse> => {
    try {
      const response = await api.get(`/api/chat/rooms/${roomId}/messages/filter/`, {
        params: filters
      });
      
      if (response.data?.success) {
        // Transform avatar URLs for all messages
        const transformedMessages = response.data.data.map((message: any) => ({
          ...message,
          sender: {
            ...message.sender,
            avatar_url: message.sender.avatar_url ? 
              getFullImageUrl(message.sender.avatar_url) : null
          }
        }));
        return {
          success: true,
          data: transformedMessages
        };
      }
      return response.data;
    } catch (error: any) {
      console.error('Error filtering messages:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to filter messages',
        errors: {
          non_field_errors: ['Failed to filter messages']
        }
      };
    }
  },
};

// Add this to your api configuration
api.interceptors.request.use(request => {
  // Log outgoing requests with safe error handling
  const requestInfo = {
    url: request?.url || 'unknown',
    method: request?.method || 'unknown',
    data: request?.data || {},
    headers: request?.headers || {}
  };
  
  return request;
}, error => {
  // Log request errors with safe error handling
  const errorInfo = {
    url: error?.config?.url || 'unknown',
    status: error?.response?.status || 'no status',
    data: error?.response?.data || {},
    message: error?.message || 'Unknown error'
  };
  console.error('API Error:', errorInfo);
  return Promise.reject(error);
});

export const notificationApi = {
  getNotifications: async (page: number = 1, filters: { unread_only?: boolean; type?: string | null } = {}) => {
    try {
      const response = await api.get('/api/users/notifications/', {
        params: {
          page,
          ...filters,
          mark_as_read: true
        }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const response = await api.post(`/api/users/notifications/${notificationId}/mark-read/`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await api.post('/api/users/notifications/mark-all-read/');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  clearAll: async () => {
    try {
      const response = await api.delete('/api/users/notifications/clear-all/');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await api.get('/api/users/notifications/unread/');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }
};

// Import and re-export postsApi
import { postsApi } from './postsApi';
export { postsApi };