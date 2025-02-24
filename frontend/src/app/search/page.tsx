"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/Input';
import { Loader2, Search, User as UserIcon, TrendingUp } from 'lucide-react';
import { searchApi, getFullImageUrl } from '@/services/api';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { PostCard } from '@/components/posts/PostCard';
import { toast } from 'react-hot-toast';
import debounce from 'lodash/debounce';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { userApi } from '@/services/api';
import { postsApi } from '@/services/postsApi';
import type { User } from '@/types/user';

interface SearchResults {
  posts: any[];
  users: any[];
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState<SearchResults>({ posts: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [trendingSearches, setTrendingSearches] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const performSearch = async (searchQuery: string, bypassCache = false) => {
    if (!searchQuery.trim()) {
      setResults({ posts: [], users: [] });
      return;
    }

    try {
      setLoading(true);
      const response = await postsApi.search(searchQuery, activeTab);
      if (response.success) {
        setResults(response.data ?? { posts: [], users: [] });
      } else {
        setResults({ posts: [], users: [] });
        if (!response.error?.includes('Network error')) {
          toast.error('Failed to perform search');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults({ posts: [], users: [] });
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(performSearch, 300);

  useEffect(() => {
    if (query) {
      debouncedSearch(query);
    }
    return () => debouncedSearch.cancel();
  }, [query, activeTab]);

  useEffect(() => {
    const loadTrending = async () => {
      try {
        const result = await postsApi.getTrendingSearches();
        if (result.success) {
          setTrendingSearches(result.data ?? []);
        }
      } catch (error) {
        console.error('Error loading trending searches:', error);
      }
    };

    loadTrending();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const response = await userApi.getProfile();
      if (response.success) {
        setCurrentUser(response.data);
      }
    };
    loadUser();
  }, []);

  const handleFollowChange = async (userId: string, isFollowed: boolean) => {
    try {
      if (isFollowed) {
        await userApi.unfollowUser(userId);
      } else {
        await userApi.followUser(userId);
      }
      
      if (query) {
        await performSearch(query, true);
      }
      
      toast.success(isFollowed ? 'Unfollowed successfully' : 'Following successfully');
    } catch (error) {
      console.error('Follow/unfollow error:', error);
      toast.error('Failed to update follow status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="lg:hidden">
        <MobileNav />
      </div>

      <div className="flex">
        {/* Left Sidebar - Fixed width */}
        <div className="hidden lg:block w-[270px] shrink-0">
          <div className="fixed top-0 left-0 w-[270px] h-screen border-r border-gray-200 dark:border-gray-800">
            <Sidebar currentUser={currentUser} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex">
            {/* Center Content */}
            <main className="flex-1 min-h-screen border-r border-gray-200 dark:border-gray-800">
              <div className="max-w-2xl mx-auto px-4 py-6 lg:pt-8">
                {/* Search Input */}
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    type="text"
                    placeholder="Search posts, users, or audio..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  />
                </div>

                {/* Tabs */}
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full mb-6">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
                    <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
                  </TabsList>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : query.trim() === '' ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Start searching
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        Enter a search term to find posts, users, or audio content
                      </p>
                    </div>
                  ) : (
                    <TabsContent value={activeTab} className="space-y-4">
                      {/* Users Results */}
                      {(activeTab === 'users' || activeTab === 'all') && results.users.length > 0 && (
                        <div className="space-y-4">
                          {results.users.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg"
                            >
                              <Link href={`/profile/${user.id}`} className="shrink-0">
                                {user.avatar ? (
                                  <img
                                    src={getFullImageUrl(user.avatar)}
                                    alt={user.username}
                                    className="h-12 w-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <UserIcon className="h-6 w-6 text-primary" />
                                  </div>
                                )}
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/profile/${user.id}`}
                                  className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-400"
                                >
                                  {user.username}
                                </Link>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {user.bio}
                                </p>
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
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Posts Results */}
                      {(activeTab === 'posts' || activeTab === 'all') && results.posts.length > 0 && (
                        <div className="space-y-4">
                          {results.posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                          ))}
                        </div>
                      )}

                      {/* No Results */}
                      {results.posts.length === 0 && results.users.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-gray-500 dark:text-gray-400">
                            No results found for "{query}"
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </main>

            {/* Right Sidebar - Fixed width */}
            <div className="hidden lg:block w-[384px] shrink-0">
              <div className="fixed top-0 h-screen w-[384px] border-l border-gray-200 dark:border-gray-800 p-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Trending Searches
                      </h3>
                    </div>
                  </div>
                  <div className="p-4">
                    {loadingTrending ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trendingSearches.map((item, index) => (
                          <button
                            key={index}
                            onClick={() => setQuery(item.query)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors"
                          >
                            {item.query}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 