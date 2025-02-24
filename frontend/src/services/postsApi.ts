// src/services/postsApi.ts

import { api } from './api';

export interface CreatePostData {
  type: 'NEWS' | 'AUDIO';
  title: string;
  description: string;
  image?: File;
  audio_file?: File;
}

export interface Author {
  id: string;
  username: string;
  profile_image: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
}

export interface TrendingData {
  score: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_rate: number;
  is_saved?: boolean;
}

export interface Post {
  id: string;
  type: 'NEWS' | 'AUDIO';
  title: string;
  description: string;
  image: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  audio_file: string | null;
  audio_url: string | null;
  author: Author;
  created_at: string;
  updated_at: string;
  comments_count: number;
  likes_count: number;
  is_liked: boolean;
  is_saved: boolean;
  trending_data: TrendingData;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  details?: any;
}

interface SearchResponse {
  posts: Post[];
  users: Author[];
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface TrendingSearch {
  query: string;
  count: number;
}

export interface HighlightsResponse {
  latest_news: Post | null;
  trending_audio: Post | null;
  featured_post: Post | null;
}

export const postsApi = {
  createPost: async (formData: FormData): Promise<ApiResponse<Post>> => {
    try {
      // Validate required fields
      const type = formData.get('type');
      const title = formData.get('title');
      
      if (!type || !title) {
        throw new Error('Missing required fields');
      }

      const response = await api.post('/api/posts/', formData, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.data) {
        throw new Error('No response data received');
      }

      return {
        success: true,
        data: response.data.data || response.data,
        status: response.status
      };

    } catch (error: any) {
      console.error('Create Post Error:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });

      return {
        success: false,
        error: error?.response?.data?.detail || 
               error?.response?.data?.message || 
               error?.message || 
               'Failed to create post',
        status: error?.response?.status || 500,
        details: error?.response?.data
      };
    }
  },

  getPosts: async (params?: {
    type?: 'NEWS' | 'AUDIO';
    following?: boolean;
    include_comments?: boolean;
    page?: number;
  }): Promise<ApiResponse<PaginatedResponse<Post>>> => {
    try {
      const response = await api.get('/api/posts/', { params });
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Posts Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch posts',
        status: error.response?.status
      };
    }
  },

  getPost: async (postId: string): Promise<ApiResponse<Post>> => {
    try {
      const response = await api.get(`/api/posts/${postId}/`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Post Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch post',
        status: error.response?.status
      };
    }
  },

  likePost: async (postId: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/posts/${postId}/like/`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Like Post Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to like post',
        status: error.response?.status
      };
    }
  },

  getFeed: async (page = 1): Promise<ApiResponse<PaginatedResponse<Post>>> => {
    try {
      const response = await api.get(`/api/posts/feed/?page=${page}`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Feed Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch feed',
        status: error.response?.status
      };
    }
  },

  getTrending: async (page = 1): Promise<ApiResponse<PaginatedResponse<Post>>> => {
    try {
      const response = await api.get(`/api/posts/trending/?page=${page}`);
      console.log('Raw API Response:', response); // Debug log
      
      if (response.data) {
        return {
          success: true,
          data: response.data.data
        };
      }
      
      throw new Error('Invalid response format');
    } catch (error: any) {
      console.error('Get Trending Posts Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch trending posts',
        data: {
          results: [],
          count: 0,
          next: null,
          previous: null
        }
      };
    }
  },

  addComment: async (postId: string, data: { content: string }): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/posts/${postId}/comments/`, data);
      return {
        success: true,
        data: response.data.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Add Comment Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to add comment',
        status: error.response?.status
      };
    }
  },

  getComments: async (postId: string): Promise<ApiResponse> => {
    try {
      const response = await api.get(`/api/posts/${postId}/comments/`);
      return {
        success: true,
        data: response.data.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Comments Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch comments',
        status: error.response?.status
      };
    }
  },

  sharePost: async (postId: string, roomId: string, message?: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/posts/${postId}/share/`, {
        room_id: roomId,
        message
      });
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Share Post Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to share post',
        status: error.response?.status
      };
    }
  },

  search: async (query: string, type: string = 'all'): Promise<ApiResponse<SearchResponse>> => {
    try {
      const response = await api.get('/api/search/', {
        params: { q: query, type }
      });
      
      return {
        success: true,
        data: {
          posts: response.data.data.posts || [],
          users: response.data.data.users || []
        },
        status: response.status
      };
    } catch (error: any) {
      console.error('Search Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to perform search',
        status: error.response?.status
      };
    }
  },

  getMyPosts: async (page = 1): Promise<ApiResponse<PaginatedResponse<Post>>> => {
    try {
      const response = await api.get(`/api/posts/my_posts/?page=${page}`);
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get My Posts Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch your posts',
        status: error.response?.status
      };
    }
  },

  editComment: async (postId: string, commentId: string, content: string): Promise<ApiResponse> => {
    try {
      const response = await api.put(`/api/posts/${postId}/edit_comment/`, {
        comment_id: commentId,
        content
      });
      return {
        success: true,
        data: response.data.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Edit Comment Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to edit comment',
        status: error.response?.status
      };
    }
  },

  deleteComment: async (postId: string, commentId: string): Promise<ApiResponse> => {
    try {
      const response = await api.delete(`/api/posts/${postId}/delete_comment/`, {
        data: { comment_id: commentId }
      });
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Delete Comment Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete comment',
        status: error.response?.status
      };
    }
  },

  replyToComment: async (commentId: string, content: string): Promise<ApiResponse> => {
    try {
      const response = await api.post(`/api/comments/${commentId}/reply/`, { content });
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Reply to Comment Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to reply to comment',
        status: error.response?.status
      };
    }
  },

  getTrendingSearches: async (): Promise<ApiResponse<TrendingSearch[]>> => {
    try {
      const response = await api.get('/api/search/trending_searches/');
      return {
        success: true,
        data: response.data.data || [],
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Trending Searches Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch trending searches',
        status: error.response?.status || 500,
        data: []
      };
    }
  },

  getUserPosts: async (userId: string, type?: string): Promise<ApiResponse<PaginatedResponse<Post>>> => {
    try {
      const params: any = { user_id: userId };
      if (type) {
        params.type = type;
      }
      
      const response = await api.get('/api/posts/user_posts/', { params });
      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get User Posts Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch user posts',
        status: error.response?.status
      };
    }
  },

  getHighlights: async (): Promise<ApiResponse<HighlightsResponse>> => {
    try {
      const response = await api.get('/api/posts/highlights/');
      return {
        success: true,
        data: response.data.data,
        status: response.status
      };
    } catch (error: any) {
      console.error('Get Highlights Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch highlights',
        status: error.response?.status,
        data: {
          latest_news: null,
          trending_audio: null,
          featured_post: null
        }
      };
    }
  }
};