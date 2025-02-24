"use client";

import { useParams, useRouter } from 'next/navigation';
import { PostCard } from '@/components/posts/PostCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { postsApi, Post } from '@/services/postsApi';
import { toast } from 'react-hot-toast';
import { userApi } from '@/services/api';

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await postsApi.getPost(postId);
        
        if (response.success && response.data) {
          setPost(response.data);
        } else {
          setError(response.error || 'Failed to load post');
          toast.error(response.error || 'Failed to load post');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
        toast.error('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const handleFollow = async () => {
    if (!post?.author?.id) return;
    
    try {
      const response = await userApi[isFollowing ? 'unfollowUser' : 'followUser'](post.author.id);
      if (response.success) {
        setIsFollowing(!isFollowing);
        toast.success(isFollowing ? 'Unfollowed' : 'Following');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-4 text-lg font-semibold">
              Post
            </h1>
            <Button 
              variant="default" 
              size="sm"
              className="bg-black hover:bg-black/90 text-white"
              onClick={handleFollow}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error}</p>
            <Button
              variant="link"
              onClick={() => router.back()}
              className="mt-4"
            >
              Go back
            </Button>
          </div>
        ) : post ? (
          <PostCard post={post} expanded />
        ) : null}
      </div>
    </div>
  );
} 