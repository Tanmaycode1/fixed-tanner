import axios, { AxiosResponse, AxiosError } from 'axios';
import { ChatRoom, Message } from '@/types/chat';
import { User, SearchUser } from '@/types/user';

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Simplified interceptor without queue
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest: any = error.config;

        // Only try refresh once
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                const response = await apiClient.post('/api/auth/token/refresh/', {
                    refresh: refreshToken
                });

                if (response.data.access) {
                    localStorage.setItem('token', response.data.access);
                    originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

export const authApi = {
    login: (credentials: { email: string; password: string }): Promise<AxiosResponse> =>
        apiClient.post('/api/auth/token/', credentials),
    
    refresh: (refresh: string): Promise<AxiosResponse> =>
        apiClient.post('/api/auth/token/refresh/', { refresh }),
    
    me: (): Promise<AxiosResponse<ApiResponse<User>>> =>
        apiClient.get('/api/users/me/'),
};

export const chatApi = {
    getChatRooms: (): Promise<AxiosResponse<ApiResponse<ChatRoom[]>>> => 
        apiClient.get('/api/chat/rooms/'),
    
    createChatRoom: (participantId: string): Promise<AxiosResponse<ApiResponse<ChatRoom>>> => 
        apiClient.post('/api/chat/rooms/', { participant_id: participantId }),
    
    getRoomMessages: (roomId: string): Promise<AxiosResponse<ApiResponse<Message[]>>> => 
        apiClient.get(`/api/chat/rooms/${roomId}/messages/`),
    
    sendMessage: (roomId: string, content: string): Promise<AxiosResponse<ApiResponse<Message>>> => 
        apiClient.post(`/api/chat/rooms/${roomId}/messages/`, { content })
};

export const userApi = {
    searchUsers: (query: string): Promise<AxiosResponse<ApiResponse<SearchUser[]>>> =>
        apiClient.get('/api/explore/users/search/', { params: { q: query } })
};

export { apiClient }; 