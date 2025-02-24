"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useTheme } from '@/context/ThemeContext';
import { userApi, authApi, getFullImageUrl } from '@/services/api';
import { Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { FollowButton } from '@/components/ui/follow-button';
import { postsApi, type Post } from '@/services/postsApi';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { Highlights } from '@/components/dashboard/Highlights';
import { CaughtUpAnimation } from '@/components/dashboard/CaughtUpAnimation';
import { Loader } from 'lucide-react';

// Mock Data
import { mockPosts, trendingTopics, suggestedUsers } from '@/data/mockData';

export default function DashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadUserProfile();
    loadSuggestions();
    loadPosts();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await userApi.getProfile();
      if (response.success) {
        setCurrentUser(response.data);
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

  const loadPosts = async (pageNum = 1) => {
    try {
      setIsLoadingPosts(true);
      const response = await postsApi.getFeed(pageNum);
      
      if (response.success && response.data) {
        const { results, next } = response.data;
        if (Array.isArray(results)) {
          if (pageNum === 1) {
            setPosts(results);
          } else {
            setPosts(prev => [...prev, ...results]);
          }
          setHasMore(!!next);
          setPage(pageNum);
        } else {
          setPosts([]);
          setHasMore(false);
        }
      } else {
        toast.error('Failed to load posts');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
      setPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingPosts && hasMore) {
      loadPosts(page + 1);
    }
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading your feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:w-64 fixed inset-y-0">
          <Sidebar />
        </div>

        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-30">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 h-16 flex items-center justify-between">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">
                Neuhu
              </span>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Scrollable */}
        <main className="flex-1 lg:pl-64">
          <div className="min-h-screen pt-16 lg:pt-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Feed Section */}
                <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                  {/* Stories/Highlights */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
                  >
                    <Highlights />
                  </motion.div>

                  {/* Posts Feed */}
                  {isLoadingPosts && page === 1 ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((n) => (
                        <motion.div
                          key={n}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: n * 0.1 }}
                          className="bg-white dark:bg-gray-800 rounded-xl h-64 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <AnimatePresence mode="popLayout">
                        {posts.map((post, index) => (
                          <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <PostCard post={post} onPostUpdate={handlePostUpdate} />
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {(hasMore || isLoadingPosts) && (
                        <div className="flex justify-center py-6">
                          <Button
                            variant="outline"
                            onClick={handleLoadMore}
                            disabled={isLoadingPosts}
                            className="min-w-[120px]"
                          >
                            {isLoadingPosts ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              'Load More'
                            )}
                          </Button>
                        </div>
                      )}

                      {!hasMore && posts.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <CaughtUpAnimation />
                        </motion.div>
                      )}
                    </>
                  )}
                </div>

                {/* Right Sidebar - Fixed on desktop */}
                <div className="hidden lg:block space-y-6">
                  <div className="sticky top-8">
                    {/* Trending Topics */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Trending Topics
                        </h2>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {trendingTopics.map((topic, index) => (
                          <motion.div
                            key={topic.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full bg-${topic.color}-100 dark:bg-${topic.color}-900/20 flex items-center justify-center`}>
                                <span className={`text-xs font-medium text-${topic.color}-600 dark:text-${topic.color}-400`}>
                                  #{topic.id}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {topic.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {topic.postCount.toLocaleString()} posts
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Suggested Users */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Suggested Users
                        </h2>
                      </div>

                      {loadingSuggestions ? (
                        <div className="p-4 space-y-4">
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
                        <div className="text-center py-8">
                          <User className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600" />
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            No suggestions available
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {suggestions.map((user) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: user.id * 0.1 }}
                              className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
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
                              <Link href={`/profile/${user.id}`} className="shrink-0">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                >
                                  View Profile
                                </Button>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Navigation at the bottom */}
        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}