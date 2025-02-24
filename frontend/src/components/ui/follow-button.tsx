"use client";

// FollowButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { userApi } from '@/services/api';
import { toast } from 'react-hot-toast';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ButtonProps } from '@/components/ui/button';

interface FollowButtonProps extends ButtonProps {
  userId: string;
  username: string;
  isFollowing: boolean;
  onFollowChange: (isFollowing: boolean) => void;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export function FollowButton({
  userId,
  username,
  isFollowing,
  onFollowChange,
  size = 'sm',
  variant = 'outline',
  className = '',
  ...props
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [currentlyFollowing, setCurrentlyFollowing] = useState(isFollowing);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (loading) return;
    
    setLoading(true);
    const wasFollowing = currentlyFollowing;
    
    try {
      const response = wasFollowing 
        ? await userApi.unfollowUser(userId)
        : await userApi.followUser(userId);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update follow status');
      }

      setCurrentlyFollowing(!wasFollowing);
      onFollowChange(!wasFollowing);
      toast.success(wasFollowing ? `Unfollowed ${username}` : `Following ${username}`);
    } catch (error) {
      console.error('Follow action failed:', error);
      setCurrentlyFollowing(wasFollowing);
      toast.error(wasFollowing ? `Failed to unfollow ${username}` : `Failed to follow ${username}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5',
        currentlyFollowing 
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
          : variant === 'ghost'
            ? 'hover:bg-muted'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{currentlyFollowing ? 'Unfollowing...' : 'Following...'}</span>
        </>
      ) : currentlyFollowing ? (
        <>
          <UserMinus className="w-4 h-4" />
          <span>Unfollow</span>
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          <span>Follow</span>
        </>
      )}
    </Button>
  );
}