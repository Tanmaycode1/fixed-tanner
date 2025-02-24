"use client";

import { User } from 'lucide-react';
import { motion } from 'framer-motion';
import { FollowButton } from '@/components/ui/follow-button';
import type { UserProfile } from '@/types/user';
import { ProfileStats } from './ProfileStats';

interface OtherProfileHeaderProps {
  profile: UserProfile;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
  onFollowChange?: (isFollowing: boolean) => void;
  isPublicProfile: boolean;
  showEditButton: boolean;
  children?: React.ReactNode;
}

export function OtherProfileHeader({ 
  profile, 
  onFollowersClick, 
  onFollowingClick,
  onFollowChange,
  isPublicProfile,
  showEditButton,
  children 
}: OtherProfileHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile Layout */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar Container */}
          <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
            {/* Avatar */}
            <motion.div 
              className="relative shrink-0 mb-4 sm:mb-0"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-gray-50 dark:ring-gray-800"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-gray-50 dark:ring-gray-800">
                  <User className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-between gap-3">
              <motion.h1 
                className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                {profile.username}
              </motion.h1>
              <div className="hidden sm:block">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <FollowButton
                    userId={profile.id}
                    username={profile.username}
                    isFollowing={profile.is_followed ?? false}
                    onFollowChange={onFollowChange ?? (() => {})}
                    className="w-32 bg-primary hover:bg-primary/90 text-white shadow-lg rounded-full"
                  />
                </motion.div>
              </div>
            </div>

            {/* Mobile Follow Button */}
            <div className="flex justify-center sm:hidden mt-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <FollowButton
                  userId={profile.id}
                  username={profile.username}
                  isFollowing={profile.is_followed ?? false}
                  onFollowChange={onFollowChange ?? (() => {})}
                  className="w-28 bg-primary hover:bg-primary/90 text-white shadow-lg rounded-full"
                />
              </motion.div>
            </div>

            {/* Full Name */}
            {profile.first_name && profile.last_name && (
              <motion.h2 
                className="text-base font-medium text-gray-900 dark:text-white mb-1 text-center sm:text-left mt-2"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                {`${profile.first_name} ${profile.last_name}`}
              </motion.h2>
            )}

            {/* Bio */}
            {profile.bio && (
              <motion.p 
                className="text-gray-600 dark:text-gray-400 max-w-2xl whitespace-pre-line text-center sm:text-left mt-1"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                {profile.bio}
              </motion.p>
            )}

            {/* Stats */}
            <div className="flex justify-center sm:justify-start mt-4">
              <ProfileStats
                postCount={profile.post_count || 0}
                followerCount={profile.followers_count}
                followingCount={profile.following_count}
                onFollowersClick={onFollowersClick}
                onFollowingClick={onFollowingClick}
                isPublicProfile={isPublicProfile}
              />
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}