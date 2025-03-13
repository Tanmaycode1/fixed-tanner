import { AxiosError } from 'axios';
import { api, ApiResponse, handleApiError, cachedRequest } from './api';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  avatar?: string;
  bio?: string;
}

export interface AdminApiConfig {
  apiKey: string;
}

export interface Post {
  id: string;
  type: 'NEWS' | 'AUDIO';
  title: string;
  description: string;
  image_url?: string | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  author: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    bio: string;
    avatar: string | null;
  };
  created_at: string;
  updated_at: string;
  comments_count: number;
  likes_count: number;
  is_liked: boolean;
  is_saved: boolean;
  trending_data: {
    score: number;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
  };
}

export interface PostStats {
  total_posts: number;
  post_types: Record<string, number>;
  posts_by_day: Array<{
    day: string;
    count: number;
  }>;
  engagement: {
    total_likes: number;
    total_comments: number;
    avg_likes_per_post: number;
    avg_comments_per_post: number;
  };
  top_authors: Array<{
    author__id: string;
    author__username: string;
    author__first_name: string;
    author__last_name: string;
    post_count: number;
  }>;
  most_liked_posts: Array<{
    id: string;
    title: string;
    type: string;
    likes_count: number;
    author: string;
  }>;
  most_commented_posts: Array<{
    id: string;
    title: string;
    type: string;
    comments_count: number;
    author: string;
  }>;
}

export class AdminService {
  private apiKey: string;

  constructor(config: AdminApiConfig) {
    this.apiKey = config.apiKey;
  }

  private getHeaders() {
    if (!this.apiKey) {
      console.warn('No API key provided to AdminService');
    }
    
    // Ensure the API key only contains valid characters
    const sanitizedApiKey = (this.apiKey || '').replace(/[^\x20-\x7E]/g, '');
    
    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      // Mask the API key for security
      const maskedKey = sanitizedApiKey ? 
        sanitizedApiKey.substring(0, 4) + '...' + 
        sanitizedApiKey.substring(sanitizedApiKey.length - 4) : 
        'none';
      console.log('Using API key:', maskedKey);
    }
    
    return {
      'X-API-Key': sanitizedApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async validateApiKey(): Promise<ApiResponse<{ status: string }>> {
    try {
      const response = await api.get('/api/admin-panel/validate-key/', {
        headers: this.getHeaders(),
        withCredentials: true,
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => {
          return status >= 200 && status < 500; // Don't reject if the status code is < 500
        }
      });

      if (response.status === 403) {
        return {
          success: false,
          message: 'Invalid API key'
        };
      }

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('API Key validation error:', error);
      return handleApiError(error as any);
    }
  }

  async getUserList(page?: number, pageSize: number = 50): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      const response = await api.get('/api/admin-panel/dashboard/users/', {
        headers: this.getHeaders(),
        params: {
          page,
          page_size: pageSize
        },
        withCredentials: true,
        timeout: 10000
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get user list error:', error);
      return handleApiError(error as any);
    }
  }

  async getDashboardStats(): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/admin-panel/dashboard-stats/', {
        headers: this.getHeaders(),
        withCredentials: true
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async getLiveLogs(filters?: {
    level?: string;
    type?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/admin-panel/live-logs/', {
        headers: this.getHeaders(),
        params: filters,
        withCredentials: true
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async getSystemLogs(filters?: {
    level?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/system-logs/logs/', {
        headers: this.getHeaders(),
        params: filters,
        withCredentials: true
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async bulkRegisterUsers(csvFile: string, fileName: string = 'bulk_upload.csv'): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/api/admin-panel/bulk-upload/upload/',
        { 
          csv_file: csvFile,
          file_name: fileName
        },
        {
          headers: this.getHeaders(),
          withCredentials: true,
          timeout: 30000 // Increased timeout for large files
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Bulk register error:', error);
      return handleApiError(error);
    }
  }

  async getBulkRegisterProgress(taskId: string): Promise<ApiResponse<any>> {
    const cacheKey = `bulk-progress-${taskId}`;
    
    try {
      // Use cachedRequest to prevent redundant requests
      return await cachedRequest(
        async () => {
          // Ensure we're using the API key headers and not the bearer token
          const headers = this.getHeaders();
          
          const response = await api.get(`/api/admin-panel/bulk-upload/tasks/${taskId}/progress/`, {
            headers,
            withCredentials: true,
            timeout: 10000
          });
          return {
            success: true,
            data: response.data
          };
        },
        cacheKey,
        false,
        3000 // 3 second cache to reduce redundant requests
      );
    } catch (error: any) {
      console.error('Progress error:', error);
      return handleApiError(error);
    }
  }

  async getBulkRegisterResults(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/api/admin-panel/bulk-upload/tasks/${taskId}/users/`, {
        headers: this.getHeaders(),
        withCredentials: true,
        timeout: 10000
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Results error:', error);
      return handleApiError(error);
    }
  }

  async downloadBulkRegisterResults(taskId: string): Promise<void> {
    try {
      const response = await api.get(`/api/admin-panel/bulk-upload/tasks/${taskId}/download/`, {
        headers: this.getHeaders(),
        responseType: 'blob',
        withCredentials: true,
        timeout: 30000 // Increased timeout for downloads
      });
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bulk_upload_${taskId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async getUserDetails(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get(`/api/admin-panel/users/${userId}/details/`, {
        headers: this.getHeaders(),
        withCredentials: true
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put(`/api/admin-panel/users/${userId}/update/`,
        userData,
        {
          headers: this.getHeaders(),
          withCredentials: true
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async updateAvatar(userId: string, avatarData: string, fileName: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.post(`/api/admin-panel/users/${userId}/avatar/`,
        {
          avatar: avatarData,
          file_name: fileName
        },
        {
          headers: this.getHeaders(),
          withCredentials: true
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async removeAvatar(userId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.delete(`/api/admin-panel/users/${userId}/avatar/`, {
        headers: this.getHeaders(),
        withCredentials: true
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/admin-panel/users/${userId}/delete/`, {
        headers: this.getHeaders(),
        withCredentials: true
      });
      return {
        success: true
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async getBulkUploadTasks(page?: number): Promise<ApiResponse<PaginatedResponse<any>>> {
    try {
      // Use cachedRequest to prevent redundant requests
      return await cachedRequest(
        async () => {
          const response = await api.get('/api/admin-panel/bulk-upload/tasks/', {
            headers: this.getHeaders(),
            params: {
              page
            },
            withCredentials: true,
            timeout: 15000 // Increased timeout
          });
          
          // The API is returning an array directly, not a paginated response
          const data = response.data || [];
          
          // Check if the response is an array (direct list of tasks)
          if (Array.isArray(data)) {
            return {
              success: true,
              data: {
                count: data.length,
                next: null,
                previous: null,
                results: data
              }
            };
          }
          
          // If it's a paginated response, ensure we have valid structure
          return {
            success: true,
            data: {
              count: data.count || 0,
              next: data.next || null,
              previous: data.previous || null,
              results: data.results || []
            }
          };
        },
        `bulk-tasks-${page || 1}`,
        false,
        10000 // 10 second cache
      );
    } catch (error: any) {
      // Check if it's a network error or timeout
      if (error.code === 'ECONNABORTED' || !error.response) {
        console.error('Network error or timeout:', error);
        return {
          success: false,
          message: 'Network error or request timeout. Please try again.'
        };
      }
      
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Authentication error:', error.response?.data);
        return {
          success: false,
          message: 'Authentication failed. Please check your API key.'
        };
      }
      
      console.error('Get bulk upload tasks error:', error);
      console.error('Error response:', error.response?.data);
      return handleApiError(error);
    }
  }

  async getBulkTaskUsers(taskId: string, page: number = 1, pageSize: number = 50, signal?: AbortSignal): Promise<ApiResponse<any>> {
    const cacheKey = `bulk-users-${taskId}-${page}-${pageSize}`;
    
    try {
      // If we have an abort signal, we're in a cancellable request context
      // so we should bypass the cache to ensure we get fresh data
      const shouldBypassCache = !!signal;
      
      // Define the actual request function
      const makeRequest = async () => {
        // Ensure we're using the API key headers and not the bearer token
        const headers = this.getHeaders();
        
        // Log the headers being sent (in development only)
        if (process.env.NODE_ENV !== 'production') {
          console.log('Sending request with headers:', {
            ...headers,
            'X-API-Key': headers['X-API-Key'] ? 'PRESENT' : 'MISSING'
          });
        }
        
        try {
          const response = await api.get(`/api/admin-panel/bulk-upload/tasks/${taskId}/users/`, {
            headers,
            params: {
              page,
              page_size: pageSize
            },
            signal,
            withCredentials: true,
            timeout: 15000
          });
          
          // Format the response to match the expected structure
          const data = response.data || {};
          
          // Check if we have task data, if not try to get it from the progress endpoint
          if (!data.task) {
            try {
              const taskResponse = await this.getBulkRegisterProgress(taskId);
              if (taskResponse.success && taskResponse.data) {
                data.task = taskResponse.data;
              }
            } catch (taskError) {
              console.warn('Failed to fetch task details:', taskError);
              // Continue with the data we have
            }
          }
          
          return {
            success: true,
            data: {
              task: data.task || {},
              users: data.results || [],
              total: data.count || 0,
              page: page,
              page_size: pageSize,
              total_pages: Math.ceil((data.count || 0) / pageSize)
            }
          };
        } catch (requestError: any) {
          // Log detailed error information
          console.error('Error in getBulkTaskUsers request:', {
            message: requestError.message,
            status: requestError.response?.status,
            data: requestError.response?.data,
            headers: requestError.config?.headers ? {
              ...requestError.config.headers,
              'X-API-Key': requestError.config.headers['X-API-Key'] ? 'PRESENT' : 'MISSING',
              'Authorization': requestError.config.headers['Authorization'] ? 'PRESENT' : 'MISSING'
            } : 'No headers'
          });
          
          throw requestError;
        }
      };
      
      // Use the cached request if we don't have an abort signal
      if (!shouldBypassCache) {
        return await cachedRequest(
          makeRequest,
          cacheKey,
          false,
          5000 // 5 second cache
        );
      }
      
      // Otherwise make a direct request
      return await makeRequest();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled by user');
        return {
          success: false,
          message: 'Request was cancelled'
        };
      }
      
      // Check if it's a network error or timeout
      if (error.code === 'ECONNABORTED' || !error.response) {
        console.error('Network error or timeout:', error);
        return {
          success: false,
          message: 'Network error or request timeout. Please try again.'
        };
      }
      
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Authentication error:', error.response?.data);
        return {
          success: false,
          message: 'Authentication failed. Please check your API key.'
        };
      }
      
      console.error('Get bulk task users error:', error);
      return handleApiError(error);
    }
  }

  async deleteBulkTaskUsers(taskId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/admin-panel/bulk-upload/tasks/${taskId}/users/`, {
        headers: this.getHeaders(),
        withCredentials: true,
        timeout: 30000 // Increased timeout for bulk deletion
      });
      return {
        success: true
      };
    } catch (error: any) {
      console.error('Delete bulk task users error:', error);
      return handleApiError(error);
    }
  }

  async stopBulkTaskProcessing(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.post(`/api/admin-panel/bulk-upload/tasks/${taskId}/stop/`, 
        {},
        {
          headers: this.getHeaders(),
          withCredentials: true,
          timeout: 10000
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Stop bulk task processing error:', error);
      return handleApiError(error);
    }
  }

  async getPostList(
    page: number = 1,
    pageSize: number = 10,
    search?: string,
    type?: string,
    reported?: boolean,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<PaginatedResponse<Post>>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (search) params.append('search', search);
      if (type) params.append('type', type);
      if (reported) params.append('reported', 'true');
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await api.get('/api/posts/', {
        params,
        headers: this.getHeaders(),
        withCredentials: true
      });
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async deletePost(postId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/api/posts/${postId}/`);
      return {
        success: true,
        message: 'Post deleted successfully',
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async bulkDeletePosts(postIds: string[]): Promise<ApiResponse<void>> {
    try {
      await api.post('/api/posts/bulk-delete/', {
        post_ids: postIds
      });
      return {
        success: true
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async createPost(postData: {
    user_id: string;
    type: 'NEWS' | 'AUDIO';
    title: string;
    description: string;
    image?: string;
    audio_file?: string;
    file_name?: string;
    audio_file_name?: string;
  }): Promise<ApiResponse<Post>> {
    try {
      const response = await api.post('/api/admin-panel/create-post/', 
        postData,
        {
          headers: this.getHeaders(),
          withCredentials: true,
          timeout: 30000 // Increased timeout for file uploads
        }
      );
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('Create post error:', error);
      
      // Extract detailed error message if available
      let errorMessage = 'Failed to create post';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async searchUsers(query: string): Promise<ApiResponse<User[]>> {
    try {
      const response = await api.get('/api/admin-panel/search/', {
        headers: this.getHeaders(),
        params: {
          q: query,
          type: 'users'
        },
        withCredentials: true,
        timeout: 15000
      });
      
      if (response.data && response.data.success && response.data.data) {
        return {
          success: true,
          data: response.data.data.users || []
        };
      }
      
      return {
        success: false,
        message: 'Invalid response format',
        data: []
      };
    } catch (error) {
      console.error('Search users error:', error);
      return handleApiError(error as any);
    }
  }

  async getPostStats(startDate?: string, endDate?: string): Promise<ApiResponse<PostStats>> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await api.get('/api/admin-panel/post-stats/', {
        params,
        headers: this.getHeaders(),
        withCredentials: true
      });
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async search(query: string, type: string = 'all'): Promise<ApiResponse<{users: User[], posts: Post[]}>> {
    try {
      // Use the new admin panel search endpoint that accepts API key authentication
      const response = await api.get('/api/admin-panel/search/', {
        headers: this.getHeaders(),
        params: { 
          q: query,
          type: type
        },
        withCredentials: true,
        timeout: 15000 // Increased timeout for search
      });
      
      if (response.data && response.data.success) {
        return {
          success: true,
          data: {
            users: response.data.data.users || [],
            posts: response.data.data.posts || []
          }
        };
      }
      
      return {
        success: false,
        message: response.data.message || 'Search failed',
        data: {
          users: [],
          posts: []
        }
      };
    } catch (error: any) {
      console.error('Admin search error:', error);
      return handleApiError(error);
    }
  }
} 