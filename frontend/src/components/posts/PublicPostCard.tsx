import React from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Post } from '@/services/postsApi';

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

export function PublicPostCard({ post }: PublicPostCardProps) {
  const router = useRouter();

  const redirectToLogin = () => {
    router.push('/auth/login');
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
      </div>

      {/* Post Content */}
      <div className="p-6 space-y-4 text-gray-800 dark:text-gray-200">
        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
            {post.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {post.description}
          </p>
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="relative aspect-video">
            <img
              src={getImageUrl(post.image_url)}
              alt={post.title}
              className="w-full h-full object-cover rounded-lg"
            />
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