import { AxiosError } from 'axios';
import { api, ApiResponse, handleApiError } from './api';

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
    // Ensure the API key only contains valid characters
    const sanitizedApiKey = this.apiKey.replace(/[^\x20-\x7E]/g, '');
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
      const response = await api.post('/api/admin-panel/bulk-register-users/',
        { 
          csv_file: csvFile,
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

  async getBulkRegisterProgress(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/admin-panel/bulk-register-progress/', {
        headers: this.getHeaders(),
        params: {
          task_id: taskId
        },
        withCredentials: true,
        timeout: 10000
      });
      console.log('Progress Response:', response);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Progress Error:', error);
      return handleApiError(error as any);
    }
  }

  async getBulkRegisterResults(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/admin-panel/bulk-register-results/', {
        headers: this.getHeaders(),
        params: {
          task_id: taskId
        },
        withCredentials: true,
        timeout: 10000
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return handleApiError(error as any);
    }
  }

  async downloadBulkRegisterResults(taskId: string): Promise<void> {
    try {
      const response = await api.get('/api/admin-panel/bulk-register-download/', {
        headers: this.getHeaders(),
        params: {
          task_id: taskId
        },
        responseType: 'blob',
        withCredentials: true,
        timeout: 10000
      });

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bulk_registration_results_${taskId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download Error:', error);
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
      const response = await api.get('/api/admin-panel/bulk-upload-tasks/', {
        headers: this.getHeaders(),
        params: page ? { page } : undefined,
        withCredentials: true,
        timeout: 10000
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get bulk upload tasks error:', error);
      return handleApiError(error as any);
    }
  }

  async getBulkTaskUsers(taskId: string, page: number = 1, pageSize: number = 50, signal?: AbortSignal): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/api/admin-panel/bulk-task-users/', {
        headers: this.getHeaders(),
        params: {
          task_id: taskId,
          page,
          page_size: pageSize
        },
        withCredentials: true,
        timeout: 30000, // Increased timeout for large files
        signal: signal // Use the provided abort signal
      });
      
      // Format the response to match the expected structure
      const data = response.data;
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      // Don't log abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Get bulk task users error:', error);
      }
      return handleApiError(error as any);
    }
  }

  async deleteBulkTaskUsers(taskId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete('/api/admin-panel/delete-bulk-task-users/', {
        headers: this.getHeaders(),
        params: {
          task_id: taskId
        },
        withCredentials: true,
        timeout: 30000 // Increased timeout for bulk deletion
      });
      return {
        success: true
      };
    } catch (error) {
      console.error('Delete bulk task users error:', error);
      return handleApiError(error as any);
    }
  }

  async stopBulkTaskProcessing(taskId: string): Promise<ApiResponse<any>> {
    try {
      const response = await api.post('/api/admin-panel/stop-bulk-task-processing/', null, {
        headers: this.getHeaders(),
        params: {
          task_id: taskId
        },
        withCredentials: true,
        timeout: 10000
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Stop bulk task processing error:', error);
      return handleApiError(error as any);
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
      await api.post('/api/posts/bulk-delete/', { post_ids: postIds });
      return {
        success: true,
        message: 'Posts deleted successfully',
      };
    } catch (error) {
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
} 