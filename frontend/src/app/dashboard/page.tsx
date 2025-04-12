"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { userApi} from '@/services/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { postsApi, type Post } from '@/services/postsApi';
import React from 'react';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { Highlights } from '@/components/dashboard/Highlights';
import { CaughtUpAnimation } from '@/components/dashboard/CaughtUpAnimation';
import { Loader } from 'lucide-react';

// Mock Data
import { trendingTopics } from '@/data/mockData';

// Add these interfaces at the top of the file, after the imports
interface SuggestedUser {
  id: string | number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  bio?: string;
}

// Add a FeedMetadata interface to properly type the metadata
interface FeedMetadata {
  has_more: boolean;
  current_page: number;
  sections_included: string[];
  counts?: Record<string, number>;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [feedSections, setFeedSections] = useState<Record<string, Post[]>>({});
  const [activeSections, setActiveSections] = useState<string[]>([]);
  const [feedCacheTime, setFeedCacheTime] = useState<number | null>(null);
  
  // Reference to observe when user scrolls to bottom
  const observerTarget = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadUserProfile();
    loadSuggestions();
    
    // Check for cached feed data
    const cachedFeed = localStorage.getItem('cachedFeed');
    const cachedTime = localStorage.getItem('feedCacheTime');
    
    if (cachedFeed && cachedTime) {
      try {
        const parsedCache = JSON.parse(cachedFeed);
        const parsedTime = parseInt(cachedTime);
        const currentTime = Date.now();
        
        // Use cache if it's less than 5 minutes old
        if (currentTime - parsedTime < 5 * 60 * 1000) {
          console.log('Using cached feed data');
          setPosts(parsedCache.posts || []);
          setFeedSections(parsedCache.sections || {});
          setActiveSections(parsedCache.activeSections || []);
          setPage(parsedCache.page || 1);
          setHasMore(parsedCache.hasMore || false);
          setIsLoadingPosts(false);
          setLoading(false);
          setFeedCacheTime(parsedTime);
          return;
        }
      } catch (error) {
        console.error('Error parsing cached feed:', error);
      }
    }
    
    // If no valid cache exists, load fresh data
    loadPosts();
  }, []);

  // Cache feed data function
  const cacheFeedData = useCallback(() => {
    const cacheData = {
      posts,
      sections: feedSections,
      activeSections,
      page,
      hasMore,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('cachedFeed', JSON.stringify(cacheData));
      localStorage.setItem('feedCacheTime', Date.now().toString());
      setFeedCacheTime(Date.now());
    } catch (error) {
      console.error('Error caching feed data:', error);
    }
  }, [posts, feedSections, activeSections, page, hasMore]);

  // Update cache whenever feed data changes
  useEffect(() => {
    if (posts.length > 0 && !isLoadingPosts) {
      cacheFeedData();
    }
  }, [posts, feedSections, activeSections, page, hasMore, isLoadingPosts, cacheFeedData]);

  // Add a function to manually refresh the feed
  const refreshFeed = useCallback(() => {
    setIsLoadingPosts(true);
    setPosts([]);
    setFeedSections({});
    setActiveSections([]);
    setPage(1);
    setHasMore(true);
    localStorage.removeItem('cachedFeed');
    localStorage.removeItem('feedCacheTime');
    setFeedCacheTime(null);
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
    if (!hasMore || (isLoadingPosts && pageNum > 1)) return Promise.resolve();
    
    try {
      setIsLoadingPosts(true);
      console.log(`Loading posts for page ${pageNum}`);
      const response = await postsApi.getFeed(pageNum);
      
      if (response.success && response.data) {
        // Handle sectioned data (new format)
        if (response.data.sections) {
          const sections = response.data.sections;
          const metadata = (response.data.metadata || {}) as FeedMetadata;
          
          // Update feed sections
          if (pageNum === 1) {
            console.log('First page load, replacing all content');
            // First page, replace all sections
            setFeedSections(sections);
            setActiveSections(metadata.sections_included || Object.keys(sections));
            
            // Combine all sections for flat feed view
            const allPosts = Object.values(sections).flat();
            setPosts(allPosts);
          } else {
            console.log(`Loading more posts: page ${pageNum}`);
            // Additional pages, merge with existing sections
            setFeedSections(prevSections => {
              const updatedSections = { ...prevSections };
              
              // Merge each section
              Object.entries(sections).forEach(([sectionKey, sectionPosts]) => {
                const existingPosts = updatedSections[sectionKey] || [];
                const existingIds = new Set(existingPosts.map(post => post.id));
                
                // Filter out duplicates
                const newPosts = sectionPosts.filter(post => !existingIds.has(post.id));
                console.log(`Adding ${newPosts.length} new posts to section ${sectionKey}`);
                
                // Merge with existing posts
                updatedSections[sectionKey] = [...existingPosts, ...newPosts];
              });
              
              return updatedSections;
            });
            
            // Update active sections if new ones are available
            if (metadata.sections_included && metadata.sections_included.length > 0) {
              setActiveSections(prevSections => {
                const newSections = new Set([...prevSections, ...metadata.sections_included]);
                return Array.from(newSections);
              });
            }
            
            // Combine all new sections for flat feed view and append to existing posts
            const newPosts = Object.values(sections).flat();
            setPosts(prev => {
              const existingIds = new Set(prev.map(post => post.id));
              const uniqueNewPosts = newPosts.filter(post => !existingIds.has(post.id));
              console.log(`Adding ${uniqueNewPosts.length} unique new posts to feed`);
              return [...prev, ...uniqueNewPosts];
            });
          }
          
          // Update pagination state
          setHasMore(metadata.has_more || false);
          setPage(pageNum);
          console.log(`Has more: ${metadata.has_more}, Current page: ${pageNum}`);
        }
        // Handle standard results array (backward compatibility)
        else if (Array.isArray(response.data.results)) {
          const { results, next } = response.data;
          
          if (pageNum === 1) {
            console.log('First page load (legacy format), replacing all content');
            setPosts(results);
            // Create a single section for backward compatibility
            setFeedSections({ all: results });
            setActiveSections(['all']);
          } else {
            console.log(`Loading more posts (legacy format): page ${pageNum}`);
            // Add new posts while avoiding duplicates
            setPosts(prev => {
              const existingIds = new Set(prev.map(post => post.id));
              const uniqueNewPosts = results.filter(post => !existingIds.has(post.id));
              console.log(`Adding ${uniqueNewPosts.length} unique new posts to feed`);
              return [...prev, ...uniqueNewPosts];
            });
            
            // Update the single section
            setFeedSections(prev => {
              const existingPosts = prev.all || [];
              const existingIds = new Set(existingPosts.map(post => post.id));
              const uniqueNewPosts = results.filter(post => !existingIds.has(post.id));
              
              return {
                ...prev,
                all: [...existingPosts, ...uniqueNewPosts]
              };
            });
          }
          
          // Update pagination state
          setHasMore(!!next);
          setPage(pageNum);
          console.log(`Has more: ${!!next}, Current page: ${pageNum}`);
        } 
        // No valid data found
        else {
          if (pageNum === 1) {
            console.log('No valid data found, clearing feed');
            setPosts([]);
            setFeedSections({});
            setActiveSections([]);
            setHasMore(false);
          } else {
            console.log('No more data to load');
            setHasMore(false);
          }
        }
      } else {
        if (pageNum === 1) {
          toast.error('Failed to load posts');
          setPosts([]);
          setFeedSections({});
          setActiveSections([]);
        } else {
          console.error('Failed to load more posts');
        }
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      if (pageNum === 1) {
        toast.error('Failed to load posts');
        setPosts([]);
        setFeedSections({});
        setActiveSections([]);
      }
    } finally {
      setIsLoadingPosts(false);
    }
    
    return Promise.resolve(); // Return a resolved promise for chaining
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  };
  
  // Infinite scroll observer setup
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry?.isIntersecting && hasMore && !isLoadingPosts) {
      // Store current scroll position and document height before loading more
      const scrollPosition = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Increment page and load more posts
      const nextPage = page + 1;
      
      // Load more posts (loading state is managed inside loadPosts)
      loadPosts(nextPage).then(() => {
        // After posts are loaded and DOM is updated
        setTimeout(() => {
          // Calculate new document height
          const newDocumentHeight = document.documentElement.scrollHeight;
          // Calculate how much the document height has changed
          const heightDifference = newDocumentHeight - documentHeight;
          
          // Log for debugging
          console.log(`Previous height: ${documentHeight}, New height: ${newDocumentHeight}, Difference: ${heightDifference}`);
          
          // Restore scroll position, compensating for new content
          window.scrollTo({
            top: scrollPosition,
            behavior: 'auto' // Use 'auto' to avoid animation
          });
          
          // Log the scroll position
          console.log(`Restored scroll position to: ${scrollPosition}`);
        }, 100); // Small delay to ensure DOM updates are complete
      });
    }
  }, [hasMore, isLoadingPosts, page, loadPosts]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px', // Start loading a bit before reaching the end
      threshold: 0.1,
    });
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [handleObserver, observerTarget]);

  // Memoize posts to prevent unnecessary re-renders
  const memoizedPosts = React.useMemo(() => posts, [posts]);

  // Get section title for display
  const getSectionTitle = (section: string): string => {
    const titles: Record<string, string> = {
      following: "From People You Follow",
      recommended: "Recommended For You",
      trending: "Trending Now",
      discover: "Discover",
      fallback: "Popular Content",
      all: "Your Feed"
    };
    return titles[section] || section.charAt(0).toUpperCase() + section.slice(1);
  };

  // Render section header
  const renderSectionHeader = (section: string, postCount: number) => {
    if (postCount === 0) return null;
    
    return (
      <motion.div 
        key={`header-${section}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 px-1"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {getSectionTitle(section)}
        </h2>
      </motion.div>
    );
  };

  // Render posts grouped by section
  const renderPostsBySection = () => {
    // If we have only one section or in mobile view, render flat list
    if (activeSections.length <= 1) {
      return (
        <AnimatePresence mode="popLayout" initial={false}>
          {memoizedPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: Math.min(0.05 * (index % 3), 0.15)
              }}
              layoutId={post.id}
              className="mb-4"
            >
              <PostCard post={post} onPostUpdate={handlePostUpdate} />
            </motion.div>
          ))}
        </AnimatePresence>
      );
    }
    
    // On larger screens, group by section
    return (
      <>
        {activeSections.map(section => {
          const sectionPosts = feedSections[section] || [];
          if (sectionPosts.length === 0) return null;
          
          return (
            <div key={`section-${section}`} className="mb-8">
              {renderSectionHeader(section, sectionPosts.length)}
              
              <AnimatePresence mode="popLayout" initial={false}>
                {sectionPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      delay: Math.min(0.05 * (index % 3), 0.15)
                    }}
                    layoutId={post.id}
                    className="mb-4"
                  >
                    <PostCard post={post} onPostUpdate={handlePostUpdate} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </>
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
          <Sidebar currentUser={currentUser} />
        </div>

        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-30">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 h-16 flex items-center justify-between">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">
                Eemu
              </span>
              <button
                onClick={refreshFeed}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Loader className={`h-5 w-5 text-gray-600 dark:text-gray-400 ${isLoadingPosts ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Scrollable */}
        <main className="flex-1 lg:pl-64">
          <div className="min-h-screen pt-16 lg:pt-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Cache indicator and refresh button (desktop) */}
              {feedCacheTime && (
                <div className="hidden lg:flex items-center justify-between mb-6">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span>Last updated: {new Date(feedCacheTime).toLocaleTimeString()}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshFeed}
                    disabled={isLoadingPosts}
                    className="flex items-center gap-2"
                  >
                    <Loader className={`h-4 w-4 ${isLoadingPosts ? 'animate-spin' : ''}`} />
                    {isLoadingPosts ? 'Refreshing...' : 'Refresh Feed'}
                  </Button>
                </div>
              )}
              
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
                      {renderPostsBySection()}
                      
                      {/* Loading indicator for infinite scroll */}
                      <div ref={observerTarget} className="h-10 flex items-center justify-center">
                        {isLoadingPosts && hasMore && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-4"
                          >
                            <Loader className="h-6 w-6 animate-spin text-primary-500/70 dark:text-primary-400/70" />
                          </motion.div>
                        )}
                      </div>

                      {/* End of feed message */}
                      {!hasMore && posts.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
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
                          {suggestions.map((user, index) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
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