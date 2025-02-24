"use client";

import { motion } from 'framer-motion';
import { Edit, User, Camera, MapPin, Link as LinkIcon, Twitter, Instagram, Globe, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/types/user';
import { ProfileStats } from './ProfileStats';

interface ProfileHeaderProps {
  profile: UserProfile;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
  isPublicProfile?: boolean;
  showEditButton?: boolean;
  children?: React.ReactNode;
}

export function ProfileHeader({ 
  profile, 
  onFollowersClick, 
  onFollowingClick, 
  isPublicProfile = false,
  showEditButton = true,
  children 
}: ProfileHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile Layout */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar Container */}
          <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
            {/* Avatar */}
            <div className="relative shrink-0 mb-4 sm:mb-0">
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
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            {/* Username and Edit Button */}
            <div className="flex items-center justify-center sm:justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {profile.username}
              </h1>
              {/* Mobile Edit Button */}
              <div className="sm:hidden">
                {showEditButton && !isPublicProfile && (
                  <Link href="/profile/edit" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                    <Edit className="h-4 w-4" />
                   
                  </Link>
                )}
              </div>
              {/* Desktop Edit Button */}
              <div className="hidden sm:block">
                {children}
              </div>
            </div>

            {/* Full Name */}
            {profile.first_name && profile.last_name && (
              <h2 className="text-base font-medium text-gray-900 dark:text-white mb-1 text-center sm:text-left mt-2">
                {`${profile.first_name} ${profile.last_name}`}
              </h2>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl whitespace-pre-line text-center sm:text-left mt-1">
                {profile.bio}
              </p>
            )}

            {/* Stats - Now below bio */}
            <div className="flex justify-center sm:justify-start mt-4">
              <ProfileStats
                postCount={profile.post_count || 0}
                followerCount={profile.followers_count}
                followingCount={profile.following_count}
                onFollowersClick={isPublicProfile ? undefined : onFollowersClick}
                onFollowingClick={isPublicProfile ? undefined : onFollowingClick}
                isPublicProfile={isPublicProfile}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 