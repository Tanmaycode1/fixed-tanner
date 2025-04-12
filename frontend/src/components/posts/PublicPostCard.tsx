import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Share2, Bookmark, ChevronRight, MoreHorizontal, Copy, Flag } from "lucide-react";
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
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { Post } from '@/services/postsApi';
import { default as NextImage } from 'next/image';

interface PublicPostCardProps {
  post: Post;
}

const getImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
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

// Character limit for post descriptions
const DESCRIPTION_CHAR_LIMIT = 150;

export function PublicPostCard({ post }: PublicPostCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  
  const isDescriptionLong = post.description && post.description.length > DESCRIPTION_CHAR_LIMIT;
  const displayDescription = !expanded && isDescriptionLong
    ? `${post.description.substring(0, DESCRIPTION_CHAR_LIMIT)}...`
    : post.description;

  const redirectToLogin = () => {
    router.push('/auth/login');
  };

  const handleShare = () => {
    redirectToLogin();
  };

  const handleBookmark = () => {
    redirectToLogin();
    toast.success('Please login to save posts', {
      icon: '🔖',
    });
  };

  const copyPostLink = () => {
    // Create a full URL including the post ID
    const baseUrl = window.location.origin;
    const postUrl = `${baseUrl}/posts/${post.id}`;
    
    navigator.clipboard.writeText(postUrl);
    toast.success('Post link copied!');
  };

  return (
    <div className={cn(
      "w-full rounded-2xl overflow-hidden",
      "bg-white dark:bg-gray-800/90",
      "border border-gray-100 dark:border-gray-700/50",
      "shadow-sm hover:shadow-md transition-shadow duration-200",
      "backdrop-blur-xl"
    )}>
      {/* Post Header */}
      <div className={cn(
        "px-6 py-4 flex items-center justify-between",
        "border-b border-gray-100 dark:border-gray-700/50"
      )}>
        <div className="flex items-center space-x-4">
          <Avatar className={cn(
            "h-12 w-12 ring-2 ring-white dark:ring-blue-900",
            "transition-all duration-300"
          )}>
            <AvatarImage
              src={getImageUrl(post.author.profile_image || post.author.avatar) || ''}
              alt={post.author.username}
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              {post.author.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                @{post.author.username}
              </h3>
              <Badge variant="secondary" className={cn(
                "text-xs font-medium",
                "bg-gray-100 dark:bg-gray-700",
                "text-gray-700 dark:text-gray-100",
                "border-transparent"
              )}>
                {post.type}
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                • {getTimeAgo(post.created_at)}
              </span>
            </div>
            {(post.author.first_name || post.author.last_name) && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {[post.author.first_name, post.author.last_name].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={copyPostLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBookmark}>
              <Bookmark className="h-4 w-4 mr-2" />
              Save post
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-500 dark:text-red-400"
              onClick={() => {
                redirectToLogin();
                toast.error('Please login to report posts');
              }}
            >
              <Flag className="h-4 w-4 mr-2" />
              Report post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Post Content */}
      <div className="p-6 space-y-4 text-gray-800 dark:text-gray-200">
        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
            {post.title}
          </h2>
          <div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {displayDescription}
            </p>
            {isDescriptionLong && (
              <Button
                variant="ghost"
                size="sm"
                onClick={redirectToLogin}
                className="mt-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 p-0 h-auto font-medium flex items-center"
              >
                Read more <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="relative aspect-video">
            <div className="relative w-full h-full">
              <NextImage
                src={getImageUrl(post.image_url) || ''}
                alt={post.title}
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          </div>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-6">
            {/* Like Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={redirectToLogin}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-300"
            >
              <Heart className="h-5 w-5" />
              <span>{formatNumber(post.likes_count)}</span>
            </Button>

            {/* Comments Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={redirectToLogin}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-300"
            >
              <MessageCircle className="h-5 w-5" />
              <span>{formatNumber(post.comments_count)}</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={redirectToLogin}
              className="text-gray-600 dark:text-gray-300"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redirectToLogin}
              className="text-gray-600 dark:text-gray-300"
            >
              <Bookmark className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 