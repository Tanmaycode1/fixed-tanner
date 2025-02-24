"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { userApi } from '@/services/api';
import { Loader, Edit } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FollowButton } from '@/components/ui/follow-button';

// Components
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { PostCard } from '@/components/posts/PostCard';
import { FollowModal } from '@/components/profile/FollowModal';

// Types
import type { UserProfile } from '@/types/user';
import { postsApi, Post } from '@/services/postsApi';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'news' | 'audio'>('all');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [currentUserFollowing, setCurrentUserFollowing] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    fetchProfile();
    loadSuggestions();
    loadCurrentUserFollowing();
    fetchMyPosts();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await userApi.getProfile();
      if (response.success) {
        setProfile(response.data);
      } else {
        toast.error('Failed to load profile');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const response = await userApi.getSuggestions();
      if (response.success) {
        setSuggestions(response.data);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadFollowers = async () => {
    try {
      setLoadingFollowers(true);
      const response = await userApi.getFollowers();
      if (response?.success && response.data?.results) {
        setFollowers(response.data.results);
      } else {
        toast.error('Failed to load followers');
      }
    } catch (error) {
      console.error('Failed to load followers:', error);
      toast.error('Failed to load followers');
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowing = async () => {
    try {
      setLoadingFollowing(true);
      const response = await userApi.getFollowing();
      if (response?.success && response.data?.results) {
        setFollowing(response.data.results);
      } else {
        toast.error('Failed to load following');
      }
    } catch (error) {
      console.error('Failed to load following:', error);
      toast.error('Failed to load following');
    } finally {
      setLoadingFollowing(false);
    }
  };

  const loadCurrentUserFollowing = async () => {
    try {
      const response = await userApi.getFollowing();
      if (response?.success) {
        const followingIds = response.data.results.map((user: any) => user.id);
        setCurrentUserFollowing(followingIds);
      }
    } catch (error) {
      console.error('Failed to load following list:', error);
    }
  };

  const fetchMyPosts = async () => {
    try {
      setLoadingPosts(true);
      const response = await postsApi.getMyPosts();
      if (response.success && response.data?.results) {
        setPosts(response.data.results);
      } else {
        toast.error('Failed to load posts');
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await userApi.followUser(userId);
      loadSuggestions();
      toast.success('User followed successfully');
    } catch (error) {
      toast.error('Failed to follow user');
    }
  };

  const handleFollowersClick = () => {
    loadFollowers();
    setShowFollowersModal(true);
  };

  const handleFollowingClick = () => {
    loadFollowing();
    setShowFollowingModal(true);
  };

  const filteredPosts = posts.filter(post => {
    if (activeTab === 'all') return true;
    if (activeTab === 'news') return post.type === 'NEWS';
    if (activeTab === 'audio') return post.type === 'AUDIO';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Unable to load profile information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto pb-20">
        <ProfileHeader 
          profile={profile} 
          onFollowersClick={handleFollowersClick}
          onFollowingClick={handleFollowingClick}
        >
          <Link href="/profile/edit">
  <Button 
    size="sm"
    variant="outline"
    className="hidden sm:flex items-center gap-2 bg-black dark:bg-primary hover:bg-black/90 dark:hover:bg-primary/90 text-white border-none"
  >
    <Edit className="h-4 w-4" />
    <span>Edit Profile</span>
  </Button>
</Link>
        </ProfileHeader>
        
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Posts Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'all'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  All Posts
                  {activeTab === 'all' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('news')}
                  className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'news'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  News
                  {activeTab === 'news' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('audio')}
                  className={`pb-4 px-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'audio'
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  Audio
                  {activeTab === 'audio' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    />
                  )}
                </button>
              </div>

              {/* Posts */}
              <div className="space-y-6">
                {loadingPosts ? (
                  <div className="space-y-6">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                        <div className="space-y-3">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      {activeTab === 'all' 
                        ? 'No posts yet' 
                        : activeTab === 'news' 
                          ? 'No news posts yet' 
                          : 'No audio posts yet'
                      }
                    </p>
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post}
                      onPostUpdate={(updatedPost) => {
                        setPosts(currentPosts => 
                          currentPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
                        );
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Suggestions Column */}
            <div className="lg:col-span-1 space-y-6">
              {/* Who to follow */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Suggested for you
                  </h3>
                </div>

                <div className="p-4">
                  {loadingSuggestions ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : suggestions.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                      No suggestions available
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((user) => (
                        <div key={user.id} className="flex items-center gap-3">
                          <Link href={`/profile/${user.id}`} className="shrink-0">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.username}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.email}
                            </p>
                          </div>
                          <FollowButton 
                            userId={user.id}
                            username={user.username}
                            isFollowing={currentUserFollowing.includes(user.id)}
                            onFollowChange={loadSuggestions}
                            className="shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FollowModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        type="followers"
        users={followers}
        loading={loadingFollowers}
        currentUserFollowing={currentUserFollowing}
        onFollowChange={() => {
          loadFollowers();
          fetchProfile();
          loadCurrentUserFollowing();
        }}
      />

      <FollowModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        type="following"
        users={following}
        loading={loadingFollowing}
        currentUserFollowing={currentUserFollowing}
        onFollowChange={() => {
          loadFollowing();
          fetchProfile();
          loadCurrentUserFollowing();
        }}
      />
    </div>
  );
}