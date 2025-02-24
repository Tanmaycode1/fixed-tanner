"use client";

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { userApi, postsApi } from '@/services/api';
import { Loader2, User } from 'lucide-react';
import { OtherProfileHeader } from '@/components/profile/OtherProfileHeader';
import { PostCard } from '@/components/posts/PostCard';
import type { UserProfile } from '@/types/user';
import type { Post } from '@/services/postsApi';
import { getFullImageUrl } from '@/services/api';
import Image from 'next/image';
import Link from 'next/link';
import { FollowButton } from '@/components/ui/follow-button';

interface PageProps {
  params: Promise<{ userId: string }>;
}

type TabType = 'all' | 'news' | 'audio';

interface SuggestedUser {
  id: string;
  username: string;
  avatar: string | null;
  is_followed: boolean;
  first_name?: string;
  last_name?: string;
}

function OtherProfileContent({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fetchProfile = async () => {
    try {
      const response = await userApi.getUserProfile(userId);
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

  const fetchUserPosts = async (type?: string) => {
    try {
      setPostsLoading(true);
      const response = await postsApi.getUserPosts(userId, type);
      if (response.success && response.data?.results) {
        setPosts(response.data.results);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const response = await userApi.getSuggestions();
      if (response.success) {
        setSuggestions(response.data);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
      loadSuggestions();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      const type = activeTab === 'all' ? undefined : activeTab.toUpperCase();
      fetchUserPosts(type);
    }
  }, [userId, activeTab]);

  const handleFollowChange = async (isFollowing: boolean) => {
    if (!profile) return;
    
    setProfile(prev => {
      if (!prev) return null;
      return {
        ...prev,
        is_followed: isFollowing,
        followers_count: isFollowing ? prev.followers_count + 1 : prev.followers_count - 1
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Profile not found</h2>
          <p className="mt-2 text-muted-foreground">Unable to load profile information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <OtherProfileHeader 
        profile={profile}
        onFollowChange={handleFollowChange}
        onFollowersClick={() => {}}
        onFollowingClick={() => {}}
        isPublicProfile={true}
        showEditButton={false}
      />

      <div className="max-w-7xl mx-auto pb-20">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-center sm:justify-start px-4">
            {(['all', 'news', 'audio'] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-medium relative ${
                  activeTab === tab
                    ? 'text-primary'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                {tab === 'all' ? 'All Posts' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Posts Column */}
            <div className="lg:col-span-2 space-y-6">
              {postsLoading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="animate-pulse"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                    >
                      <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-gray-500 dark:text-gray-400">
                    {activeTab === 'all' 
                      ? 'No posts yet' 
                      : `No ${activeTab} posts yet`
                    }
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <PostCard 
                        post={post}
                        onPostUpdate={(updatedPost) => {
                          setPosts(currentPosts => 
                            currentPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
                          );
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions Column */}
            <div className="hidden lg:block">
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Suggested for you
                  </h3>
                </div>

                <div className="p-4">
                  {suggestionsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="animate-pulse flex items-center gap-3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.1 }}
                        >
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                          </div>
                          <div className="w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                        </motion.div>
                      ))}
                    </div>
                  ) : suggestions.length === 0 ? (
                    <motion.p
                      className="text-center text-gray-500 dark:text-gray-400 py-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      No suggestions available
                    </motion.p>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((user, index) => (
                        <motion.div
                          key={user.id}
                          className="flex items-center justify-between"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center gap-3">
                            <Link href={`/profile/${user.id}`} className="shrink-0">
                              <motion.div 
                                className="relative h-10 w-10 rounded-full overflow-hidden"
                                whileHover={{ scale: 1.05 }}
                              >
                                {user.avatar && (
                                  <Image
                                    src={getFullImageUrl(user.avatar)}
                                    alt={user.username}
                                    fill
                                    className="object-cover"
                                  />
                                )}
                              </motion.div>
                            </Link>
                            <div className="min-w-0">
                              <Link 
                                href={`/profile/${user.id}`}
                                className="font-medium text-sm text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-400 truncate block"
                              >
                                {user.username}
                              </Link>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                Suggested for you
                              </p>
                            </div>
                          </div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FollowButton
                              userId={user.id}
                              username={user.username}
                              isFollowing={user.is_followed}
                              onFollowChange={(isFollowing) => {
                                setSuggestions(currentSuggestions =>
                                  currentSuggestions.map(suggestion =>
                                    suggestion.id === user.id
                                      ? { ...suggestion, is_followed: isFollowing }
                                      : suggestion
                                  )
                                );
                              }}
                              variant="ghost"
                              size="sm"
                            />
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <OtherProfileContent userId={resolvedParams.userId} />;
}