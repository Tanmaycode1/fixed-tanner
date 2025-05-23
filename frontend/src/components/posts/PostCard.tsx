import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Flag,
  Loader2,
  Copy,
  Trash2,
  Edit2,
  ChevronRight,
  Lock,
  X,
  Check
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { toast } from 'react-hot-toast';
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { AudioPlayer } from '../../components/AudioPlayer';
import { postsApi, type Post } from '@/services/postsApi';
import { userApi } from '@/services/api';

interface PostCardProps {
  post: Post;
  expanded?: boolean;
  onPostUpdate?: (updatedPost: Post) => void;
  isLandingPage?: boolean;
}

interface Comment {
  id: string;
  author: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    bio: string;
    avatar: string | null;
  };
  content: string;
  created_at: string;
  is_author: boolean;
}

// Add this helper function at the top of the file, outside the component
const getImageUrl = (url: string | null | undefined) => {
  if (!url) return null;
  // If it's already a full URL, return it
  if (url.startsWith('http')) return url;
  // If it's a relative path, prepend the API base URL
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

// Helper function to get full image URL
const getPostImageUrl = (url: string | null): string | undefined => {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

// Helper function for avatar images
const getAvatarImageUrl = (url: string | null): string => {
  if (!url) return '';
  return url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

// First, add this helper function to determine if we should show the image in the main card
const shouldShowMainImage = (post: Post) => {
  return post.type === 'NEWS';
};

// Max description length before adding "Read more"
const MAX_DESCRIPTION_LENGTH = 150;

export function PostCard({ post, expanded = false, onPostUpdate, isLandingPage = false }: PostCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [localPost, setLocalPost] = useState(post);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.is_saved || false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    full_name: string;
    avatar_url?: string;
  } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [showFullDescription, setShowFullDescription] = useState(expanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Check if description is truncated
  const isTruncatedDescription = localPost.description?.length > MAX_DESCRIPTION_LENGTH;
  
  // Get truncated or full description based on state
  const displayDescription = showFullDescription || expanded 
    ? localPost.description 
    : localPost.description?.substring(0, MAX_DESCRIPTION_LENGTH) + '...';

  const loadComments = useCallback(async () => {
    try {
      setIsLoadingComments(true);
      const result = await postsApi.getComments(localPost.id);
      if (result.success && result.data) {
        setComments(result.data as Comment[]);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [localPost.id]);

  useEffect(() => {
    if (showComments && comments.length === 0) {
      loadComments();
    }
  }, [showComments, comments.length, loadComments]);

  useEffect(() => {
    setLocalPost(post);
    if (!isLandingPage) {
      loadUserProfile();
    }
  }, [post, isLandingPage]);

  const loadUserProfile = async () => {
    try {
      const response = await userApi.getProfile();
      if (response.success) {
        setCurrentUser(response.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const redirectToLogin = () => {
    router.push('/auth/login');
  };

  const handleLike = async () => {
    if (isLandingPage) {
      redirectToLogin();
      return;
    }

    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      const updatedPost = {
        ...localPost,
        is_liked: !localPost.is_liked,
        likes_count: localPost.likes_count + (localPost.is_liked ? -1 : 1),
        trending_data: {
          ...localPost.trending_data,
          like_count: (localPost.trending_data?.like_count || 0) + (localPost.is_liked ? -1 : 1)
        }
      };
      
      setLocalPost(updatedPost);
      
      const result = await postsApi.likePost(localPost.id);
      
      if (!result.success) {
        setLocalPost(localPost);
        toast.error('Failed to like post');
        return;
      }

      if (onPostUpdate) onPostUpdate(updatedPost);
      
      toast.success(updatedPost.is_liked ? 'Post liked' : 'Post unliked', {
        icon: updatedPost.is_liked ? '❤️' : '💔'
      });

    } catch (error) {
      console.error('Like error:', error);
      setLocalPost(localPost);
      toast.error('Failed to like post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (isLandingPage) {
      redirectToLogin();
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: localPost.title,
          text: localPost.description,
          url: window.location.href
        });
      } else {
        const result = await postsApi.sharePost(localPost.id, 'direct');
        if (result.success) {
          toast.success('Post shared successfully');
        }
      }
    } catch (error) {
      toast.error('Failed to share post');
    }
  };

  const handleBookmark = () => {
    if (isLandingPage) {
      redirectToLogin();
      return;
    }

    setIsBookmarked(!isBookmarked);
    toast.success(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks', {
      icon: isBookmarked ? '🗑️' : '🔖',
      className: 'dark:bg-slate-800 dark:text-white'
    });
  };

  const formatNumber = (num: number = 0) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval}${unit.charAt(0)}`;
      }
    }
    return 'now';
  };

  const toggleComments = async () => {
    if (isLandingPage) {
      redirectToLogin();
      return;
    }
    setShowComments(!showComments);
    
    // If opening comments and no comments loaded yet, fetch them
    if (!showComments && comments.length === 0) {
      try {
        setIsLoadingComments(true);
        const result = await postsApi.getComments(localPost.id);
        if (result.success && result.data) {
          setComments(result.data as Comment[]);
        } else {
          toast.error('Failed to load comments');
        }
      } catch (error) {
        console.error('Error loading comments:', error);
        toast.error('Failed to load comments');
      } finally {
        setIsLoadingComments(false);
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    // Check if user is authenticated
    if (!currentUser) {
      toast.error('Please log in to comment');
      router.push('/auth/login');
      return;
    }

    try {
      setIsSubmittingComment(true);
      
      const result = await postsApi.addComment(localPost.id, {
        content: newComment.trim()
      });
      
      if (result.success && result.data) {
        // Add the new comment to the beginning of the list
        setComments(prev => [result.data as Comment, ...prev]);
        setNewComment('');
        
        // Update post comment count
        const updatedPost = {
          ...localPost,
          comments_count: localPost.comments_count + 1,
          trending_data: {
            ...localPost.trending_data,
            comment_count: (localPost.trending_data?.comment_count || 0) + 1
          }
        };
        setLocalPost(updatedPost);
        if (onPostUpdate) onPostUpdate(updatedPost);
        
        toast.success('Comment added');
      } else {
        toast.error(result.error || 'Failed to add comment');
      }
    } catch (error: any) {
      console.error('Comment error:', error);
      toast.error(error?.response?.data?.error || 'Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    try {
      const result = await postsApi.editComment(localPost.id, commentId, content);
      if ('success' in result && result.success) {
        setComments(prev => 
          prev.map(c => c.id === commentId ? {
            ...c,
            content: content
          } : c)
        );
        setEditingCommentId(null);
        setEditedContent('');
        toast.success('Comment updated');
      } else {
        toast.error('Failed to update comment');
      }
    } catch (error) {
      console.error('Edit comment error:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const result = await postsApi.deleteComment(localPost.id, commentId);
      if ('success' in result && result.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setLocalPost(prev => ({
          ...prev,
          comments_count: prev.comments_count - 1
        }));
        toast.success('Comment deleted');
      } else {
        toast.error('Failed to delete comment');
      }
    } catch (error) {
      console.error('Delete comment error:', error);
      toast.error('Failed to delete comment');
    }
  };

  // Add useEffect to update comments' is_author when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setComments(prev => prev.map(comment => ({
        ...comment,
        is_author: comment.author.id === currentUser.id
      })));
    }
  }, [currentUser]);

  // Get image URLs for different purposes
  const postImageUrl = getPostImageUrl(localPost.image_url || localPost.image);
  const audioImageUrl = getPostImageUrl(localPost.cover_image_url || localPost.image_url || localPost.image);

  // Navigate to post detail page
  const navigateToPostDetail = () => {
    router.push(`/posts/${localPost.id}`);
  };

  // Navigate to user profile
  const navigateToUserProfile = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the click from bubbling to parent elements
    if (localPost.author?.id) {
      router.push(`/profile/${localPost.author.id}`);
    }
  };

  // Check if the current user is the author of the post
  const isPostAuthor = currentUser && post.author && currentUser.id === post.author.id;

  // Start editing the post
  const handleStartEdit = () => {
    setEditedTitle(localPost.title);
    setEditedDescription(localPost.description);
    setIsEditing(true);
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  // Save edit changes
  const handleSaveEdit = async () => {
    if (!editedTitle.trim() || !editedDescription.trim()) {
      toast.error('Title and description cannot be empty');
      return;
    }
    
    try {
      setIsSavingEdit(true);
      
      const formData = new FormData();
      formData.append('title', editedTitle);
      formData.append('description', editedDescription);
      formData.append('type', localPost.type);
      
      const result = await postsApi.patchPost(localPost.id, formData);
      
      if (result.status === 200) {
        // Update the local post
        const updatedPost = {
          ...localPost,
          title: editedTitle,
          description: editedDescription
        };
        
        setLocalPost(updatedPost);
        if (onPostUpdate) onPostUpdate(updatedPost);
        
        setIsEditing(false);
        toast.success('Post updated successfully');
      } else {
        toast.error('Failed to update post');
      }
    } catch (error) {
      console.error('Edit post error:', error);
      toast.error('Failed to update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePost = async () => {
    if (!isPostAuthor) return;
    
    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      try {
        const result = await postsApi.deletePost(localPost.id);
        if (result.success) {
          toast.success('Post deleted successfully');
          // Redirect to dashboard instead of home
          router.push('/dashboard');
        } else {
          toast.error(result.error || 'Failed to delete post');
        }
      } catch (error) {
        console.error('Delete post error:', error);
        toast.error('Failed to delete post');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full rounded-2xl overflow-hidden",
        "bg-white dark:bg-gray-800/90",
        "border border-gray-100 dark:border-gray-700/50",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        "backdrop-blur-xl"
      )}
    >
      {/* Post Header */}
      <div className={cn(
        "px-6 py-4 flex items-center justify-between",
        "border-b border-gray-100 dark:border-gray-700/50"
      )}>
        <div className="flex items-center space-x-4">
          <Avatar className={cn(
            "h-12 w-12 ring-2 ring-white dark:ring-blue-900",
            "transition-all duration-300",
            "hover:ring-blue-500/50 dark:hover:ring-blue-400/50"
          )}>
            <AvatarImage
              src={getImageUrl(localPost.author.profile_image || localPost.author.avatar) || ''}
              alt={localPost.author.username}
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              {localPost.author.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 
                className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:underline"
                onClick={navigateToUserProfile}
              >
                @{localPost.author.username}
              </h3>
              <Badge variant="secondary" className={cn(
                "text-xs font-medium",
                "bg-gray-100 dark:bg-gray-700",
                "text-gray-700 dark:text-gray-100",
                "border-transparent"
              )}>
                {localPost.type}
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                • {getTimeAgo(localPost.created_at)}
              </span>
            </div>
            {(localPost.author.first_name || localPost.author.last_name) && (
              <p 
                className="text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
                onClick={navigateToUserProfile}
              >
                {[localPost.author.first_name, localPost.author.last_name].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white focus:ring-0 focus:ring-offset-0"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-1 overflow-hidden"
          >
            <DropdownMenuItem 
              onClick={() => {
                const baseUrl = window.location.origin;
                const postUrl = `${baseUrl}/posts/${localPost.id}`;
                navigator.clipboard.writeText(postUrl);
                toast.success('Link copied!');
              }}
              className="flex items-center h-10 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Copy className="h-4 w-4 mr-2" />
              <span className="text-sm">Copy link</span>
            </DropdownMenuItem>
            
            {isPostAuthor && (
              <>
                <DropdownMenuSeparator className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <DropdownMenuItem 
                  onClick={handleStartEdit}
                  className="flex items-center h-10 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  <span className="text-sm">Edit post</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="flex items-center h-10 px-3 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span className="text-sm">Delete post</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Post Content */}
      <div className="p-6 space-y-4 text-gray-800 dark:text-gray-200">
        {isEditing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Title"
            />
            
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Description"
            />
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="flex items-center"
                disabled={isSavingEdit}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveEdit}
                className="flex items-center"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
                {localPost.title}
              </h2>
              <div className="relative">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {displayDescription}
                </p>
                {!expanded && isTruncatedDescription && !showFullDescription && (
                  <div className="mt-2">
                    <Button 
                      variant="link" 
                      className="text-blue-500 dark:text-blue-400 p-0 h-auto font-medium flex items-center"
                      onClick={navigateToPostDetail}
                    >
                      Read more <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Only show image here for NEWS posts */}
            {shouldShowMainImage(localPost) && postImageUrl && (
              <div className="relative aspect-video">
                <img
                  src={postImageUrl}
                  alt={localPost.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            )}

            {/* Audio Player (will handle its own image display) */}
            {localPost.type === 'AUDIO' && (
              <div className="mt-4 relative">
                <AudioPlayer
                  audioUrl={localPost.audio_url || ''}
                  coverImage={audioImageUrl}
                  title={localPost.title}
                  post={localPost}
                />
              </div>
            )}
          </>
        )}

        {/* Engagement Stats - Only show if not editing */}
        {!isEditing && (
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-6">
              {/* Like Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleLike}
                disabled={isLoading}
                className={cn(
                  "flex items-center space-x-2",
                  "text-gray-600 dark:text-gray-300",
                  "hover:text-red-500 dark:hover:text-red-400",
                  "transition-colors duration-200",
                  localPost.is_liked && "text-red-500 dark:text-red-400",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <motion.div
                  animate={{ 
                    scale: localPost.is_liked ? [1, 1.4, 1] : 1,
                    rotate: localPost.is_liked ? [0, 15, -15, 0] : 0
                  }}
                  transition={{ duration: 0.4 }}
                >
                  <Heart 
                    className={cn(
                      "h-5 w-5",
                      localPost.is_liked && "fill-current"
                    )}
                  />
                </motion.div>
                <span className="text-sm font-medium">
                  {formatNumber(localPost.likes_count)}
                </span>
              </motion.button>

              {/* Comments Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleComments}
                className={cn(
                  "flex items-center space-x-2",
                  "text-gray-600 dark:text-gray-300",
                  "hover:text-blue-500 dark:hover:text-blue-400",
                  "hover:bg-blue-50 dark:hover:bg-blue-900/20",
                  showComments && "text-blue-500 dark:text-blue-400"
                )}
              >
                <MessageCircle className={cn(
                  "h-5 w-5",
                  showComments && "fill-current"
                )} />
                <span className="text-sm font-medium">
                  {formatNumber(localPost.comments_count)}
                </span>
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBookmark}
                className={cn(
                  "text-gray-600 dark:text-gray-300",
                  "hover:text-blue-500 dark:hover:text-blue-400",
                  isBookmarked && "text-blue-500 dark:text-blue-400"
                )}
              >
                <Bookmark className={cn(
                  "h-5 w-5",
                  isBookmarked && "fill-current"
                )} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-slate-800"
          >
            <div className="p-6 space-y-6">
              {/* Comment Input */}
              <form onSubmit={handleSubmitComment} className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Avatar className="h-6 w-6">
                  {currentUser?.avatar_url ? (
                    <AvatarImage
                      src={getAvatarImageUrl(currentUser.avatar_url)}
                      alt={currentUser?.username || 'Me'}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {currentUser?.username?.charAt(0).toUpperCase() || 'M'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className={cn(
                      "flex-1 text-sm px-3 py-1 rounded",
                      "bg-transparent",
                      "text-gray-900 dark:text-white",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "focus:outline-none",
                    )}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    disabled={!newComment.trim() || isSubmittingComment}
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Post'
                    )}
                  </Button>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-4">
                {isLoadingComments ? (
                  // Loading skeleton
                  <div className="animate-pulse">
                    <div className="h-48 bg-gray-100 dark:bg-gray-700/30 rounded-xl mb-4" />
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700/30 rounded w-3/4" />
                      <div className="h-4 bg-gray-100 dark:bg-gray-700/30 rounded w-1/2" />
                    </div>
                  </div>
                ) : (
                  <>
                    {comments.map((comment) => (
                      <motion.div key={comment.id} className="flex space-x-2 mb-2">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage 
                            src={getAvatarImageUrl(comment.author.avatar)} 
                            alt={comment.author.username} 
                          />
                          <AvatarFallback className="text-xs">
                            {comment.author.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className={cn(
                                  "w-full px-3 py-1 text-sm rounded",
                                  "bg-gray-50 dark:bg-gray-800",
                                  "border border-gray-200 dark:border-gray-700",
                                  "focus:outline-none focus:ring-1 focus:ring-blue-500",
                                  "resize-none"
                                )}
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditedContent('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleEditComment(comment.id, editedContent)}
                                  disabled={!editedContent.trim() || editedContent === comment.content}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="group flex items-start justify-between gap-x-2">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm text-gray-900 dark:text-white mr-2">
                                  {comment.author.username}
                                </span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {comment.content}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-500">
                                    {getTimeAgo(comment.created_at)}
                                  </span>
                                </div>
                              </div>

                              {comment.is_author && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditedContent(comment.content);
                                    }}
                                    className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="h-6 w-6 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {comments.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No comments yet. Be the first to comment!
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full" style={{ paddingTop: '52.5%' }}>
            {postImageUrl && (
              <Image
                src={postImageUrl}
                alt={localPost.title}
                fill
                className="object-contain"
                priority
                sizes="100vw"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}