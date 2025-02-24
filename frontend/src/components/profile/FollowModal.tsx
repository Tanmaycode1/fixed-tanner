"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, User, X } from 'lucide-react';
import Link from 'next/link';
import { FollowButton } from '@/components/ui/follow-button';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar: string | null;
  bio: string;
  is_followed: boolean;
}

interface FollowModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'followers' | 'following';
  users: User[];
  loading: boolean;
  onFollowChange?: () => void;
  currentUserFollowing?: string[];
}

export function FollowModal({
  isOpen,
  onClose,
  type,
  users,
  loading,
  onFollowChange,
  currentUserFollowing = []
}: FollowModalProps) {

  const handleFollowChange = async () => {
    try {
      if (onFollowChange) {
        await onFollowChange();
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast.error('Failed to update follow status');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 h-[100dvh] sm:h-auto w-full sm:w-auto sm:rounded-lg bg-white dark:bg-gray-900">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 p-0 mr-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={onClose}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-gray-500 dark:text-gray-400"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Button>

              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white flex-1">
                {type === 'followers' ? 'Followers' : 'Following'}
              </DialogTitle>

              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={onClose}
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No {type} yet
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-4">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <Link href={`/profile/${user.id}`} className="shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/profile/${user.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-400 truncate block"
                      >
                        {user.username}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        {user.first_name && user.last_name ? (
                          <span className="truncate">
                            {`${user.first_name} ${user.last_name}`}
                          </span>
                        ) : (
                          <span className="truncate">{user.email}</span>
                        )}
                        {user.bio && (
                          <>
                            <span className="text-gray-300 dark:text-gray-700">•</span>
                            <span className="truncate">{user.bio}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <FollowButton 
                      userId={user.id}
                      username={user.username}
                      isFollowing={type === 'following' || user.is_followed}
                      onFollowChange={handleFollowChange}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}