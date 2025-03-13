'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { useAdminService } from '@/hooks/useAdminService';
import { Post, PaginatedResponse, User } from '@/services/adminService';
import { FiSearch, FiFilter, FiTrash2, FiEye, FiCalendar, FiFlag, FiX, FiPlus, FiUser } from 'react-icons/fi';
import Link from 'next/link';
import { format } from 'date-fns';
import debounce from 'lodash/debounce';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (postData: any) => Promise<void>;
}

const CreatePostModal = ({ isOpen, onClose, onSubmit }: CreatePostModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'NEWS' | 'AUDIO'>('NEWS');
  const [image, setImage] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adminService = useAdminService();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset form when modal is opened
    if (isOpen) {
      setTitle('');
      setDescription('');
      setType('NEWS');
      setImage(null);
      setAudioFile(null);
      setImagePreview(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setError(null);
    }
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for search
    if (query.length > 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers(query);
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      const response = await adminService.searchUsers(query);
      if (response.success && response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    
    if (type === 'AUDIO' && !audioFile) {
      setError('Audio file is required for audio posts');
      return;
    }
    
    // Prepare post data
    const postData: any = {
      user_id: selectedUser.id,
      type,
      title,
      description
    };
    
    // Add image if available
    if (image) {
      const reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onload = async () => {
        postData.image = reader.result;
        postData.file_name = image.name;
        
        // Add audio file if available
        if (audioFile) {
          const audioReader = new FileReader();
          audioReader.readAsDataURL(audioFile);
          audioReader.onload = async () => {
            postData.audio_file = audioReader.result;
            postData.audio_file_name = audioFile.name;
            
            // Submit form
            await onSubmit(postData);
          };
        } else {
          // Submit form without audio
          await onSubmit(postData);
        }
      };
    } else if (audioFile) {
      // Only audio file without image
      const audioReader = new FileReader();
      audioReader.readAsDataURL(audioFile);
      audioReader.onload = async () => {
        postData.audio_file = audioReader.result;
        postData.audio_file_name = audioFile.name;
        
        // Submit form
        await onSubmit(postData);
      };
    } else {
      // No files
      await onSubmit(postData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create New Post</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <FiX size={24} />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* User Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select User
            </label>
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-md">
                <span className="pl-3 text-gray-500">
                  <FiUser />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search for a user..."
                  className="w-full p-2 pl-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Search Results Dropdown */}
              {searchQuery.length > 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                  {isSearching ? (
                    <div className="p-3 text-center text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <ul>
                      {searchResults.map((user) => (
                        <li
                          key={user.id}
                          onClick={() => selectUser(user)}
                          className="p-3 hover:bg-gray-100 cursor-pointer flex items-center"
                        >
                          {user.avatar && (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-8 h-8 rounded-full mr-2"
                            />
                          )}
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 text-center text-gray-500">No users found</div>
                  )}
                </div>
              )}
              
              {/* Selected User */}
              {selectedUser && (
                <div className="mt-2 p-2 bg-gray-100 rounded-md flex items-center justify-between">
                  <div className="flex items-center">
                    {selectedUser.avatar && (
                      <img
                        src={selectedUser.avatar}
                        alt={selectedUser.username}
                        className="w-6 h-6 rounded-full mr-2"
                      />
                    )}
                    <span>{selectedUser.username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <FiX />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Post Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'NEWS' | 'AUDIO')}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NEWS">News</option>
              <option value="AUDIO">Audio</option>
            </select>
          </div>
          
          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter post title"
            />
          </div>
          
          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter post description"
              rows={4}
            />
          </div>
          
          {/* Image Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'AUDIO' ? 'Cover Image' : 'Image'} {type === 'AUDIO' && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-40 rounded-md"
                />
              </div>
            )}
          </div>
          
          {/* Audio Upload (for AUDIO posts) */}
          {type === 'AUDIO' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audio File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {audioFile && (
                <div className="mt-2 text-sm text-gray-500">
                  Selected file: {audioFile.name}
                </div>
              )}
            </div>
          )}
          
          {/* Submit Button */}
          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function PostManagement() {
  const { apiKey } = useAdmin();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const adminService = useAdminService();
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [filterType, setFilterType] = useState<'all' | 'NEWS' | 'AUDIO'>('all');
  const [filterReported, setFilterReported] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  const fetchPosts = async (page: number = currentPage) => {
    if (!apiKey) {
      setError('API key is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // If there's a search query, use the search endpoint
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        const response = await adminService.search(searchQuery, 'posts');
        if (response.success && response.data) {
          // Directly set the posts array with search results
          setPosts(response.data.posts);
          setTotalCount(response.data.posts.length);
        } else {
          setError(response.message || 'Failed to search posts');
          // Don't clear posts if search fails
          if (!posts.length) {
            setPosts([]);
            setTotalCount(0);
          }
        }
      } else {
        // Otherwise use the regular post list endpoint
        setIsSearching(false);
        const response = await adminService.getPostList(
          page,
          pageSize,
          searchQuery,
          filterType === 'all' ? undefined : filterType,
          filterReported,
          startDate,
          endDate
        );
        
        if (response.success && response.data) {
          const paginatedData = response.data as PaginatedResponse<Post>;
          setPosts(paginatedData.results);
          setTotalCount(paginatedData.count);
        } else {
          setError(response.message || 'Failed to fetch posts');
        }
      }
    } catch (err) {
      setError('An error occurred while fetching posts');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(() => {
      fetchPosts(1);
    }, 500),
    [searchQuery]
  );

  useEffect(() => {
    debouncedSearch();
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (!isSearching) {
      fetchPosts();
    }
  }, [currentPage, pageSize, filterType, filterReported, startDate, endDate]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDeleteClick = (postId: string) => {
    setPostToDelete(postId);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;

    try {
      const response = await adminService.deletePost(postToDelete);
      if (response.success) {
        setPosts(posts.filter(post => post.id !== postToDelete));
        setShowDeleteConfirmation(false);
        setPostToDelete(null);
      } else {
        setError(response.message || 'Failed to delete post');
      }
    } catch (error) {
      setError('Error deleting post');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedPosts.size} posts?`)) return;

    try {
      const response = await adminService.bulkDeletePosts(Array.from(selectedPosts));
      if (response.success) {
        fetchPosts();
        setSelectedPosts(new Set());
      } else {
        setError(response.message || 'Failed to delete posts');
      }
    } catch (error) {
      setError('Error performing bulk delete');
    }
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(post => post.id)));
    }
  };

  const toggleSelectPost = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  const handleCreatePost = async (postData: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.createPost(postData);
      if (response.success && response.data) {
        // Add the new post to the list
        setPosts([response.data, ...posts]);
        setShowCreatePostModal(false);
        // Show success message
        alert('Post created successfully');
      } else {
        setError(response.message || 'Failed to create post');
        console.error('Create post error:', response);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Error creating post. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  if (error && !posts.length) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Post Management</h1>
          <button
            onClick={() => setShowCreatePostModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
          >
            <FiPlus className="mr-2" /> Create Post
          </button>
          {selectedPosts.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
            >
              <FiTrash2 className="mr-2" />
              Delete Selected ({selectedPosts.size})
            </button>
          )}
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {loading && searchQuery ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-1"></div>
                ) : (
                  <FiSearch className="text-gray-400" />
                )}
              </div>
              <input
                type="text"
                placeholder="Search posts by title, description, author..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={handleSearchClear}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <FiX className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="NEWS">News</option>
                <option value="AUDIO">Audio</option>
              </select>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="reported"
                  checked={filterReported}
                  onChange={(e) => setFilterReported(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="reported" className="text-sm text-gray-700">Reported</label>
              </div>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex items-center">
              <FiCalendar className="text-gray-400 mr-2" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Start Date"
              />
            </div>
            <div className="flex items-center">
              <FiCalendar className="text-gray-400 mr-2" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="End Date"
              />
            </div>
          </div>
        </div>

        {/* Posts Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p>{error}</p>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedPosts.size === posts.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Post
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reports
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">Loading posts...</p>
                    </td>
                  </tr>
                ) : posts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? `No posts found matching "${searchQuery}"` : 'No posts found'}
                    </td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPosts.has(post.id)}
                          onChange={() => toggleSelectPost(post.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{post.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-md">{post.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 flex-shrink-0">
                            {post.author.avatar ? (
                              <img className="h-8 w-8 rounded-full" src={post.author.avatar} alt="" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-500 font-medium">
                                  {post.author.username[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {post.author.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          post.type === 'NEWS'
                            ? 'bg-green-100 text-green-800'
                            : post.type === 'AUDIO'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {post.type.charAt(0).toUpperCase() + post.type.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {post.comments_count > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 text-xs font-semibold text-red-800">
                            <FiFlag className="mr-1" />
                            {post.comments_count}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">No reports</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(post.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/posts/${post.id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <FiEye className="h-5 w-5" />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(post.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(page => page + 1)}
              disabled={currentPage * pageSize >= totalCount}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(page => page + 1)}
                  disabled={currentPage * pageSize >= totalCount}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                  disabled={currentPage * pageSize >= totalCount}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Last
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirmation(false);
          setPostToDelete(null);
        }}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onSubmit={handleCreatePost}
      />
    </div>
  );
} 