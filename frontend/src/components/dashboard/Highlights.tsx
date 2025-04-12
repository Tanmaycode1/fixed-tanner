'use client';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { postsApi, type Post } from '@/services/postsApi';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, AlertTriangle, Zap, TrendingUp, Award, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInView } from 'react-intersection-observer';

// Types
interface HighlightsData {
  latest_news: Post | null;
  trending_audio: Post | null;
  featured_post: Post | null;
}

export const Highlights = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<HighlightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: false,
    threshold: 0.2,
  });

  // Load highlights from cache or fetch them
  useEffect(() => {
    const fetchHighlights = async () => {
      // Check cache first
      const cachedHighlights = localStorage.getItem('cachedHighlights');
      const cachedTime = localStorage.getItem('highlightsCacheTime');
      
      if (cachedHighlights && cachedTime) {
        try {
          const parsedCache = JSON.parse(cachedHighlights);
          const parsedTime = parseInt(cachedTime);
          const currentTime = Date.now();
          
          // Use cache if it's less than 15 minutes old
          if (currentTime - parsedTime < 15 * 60 * 1000) {
            console.log('Using cached highlights data');
            setHighlights(parsedCache);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error parsing cached highlights:', error);
        }
      }
      
      // Fetch fresh data if cache is invalid or expired
      try {
        setIsLoading(true);
        setError(null);
        const response = await postsApi.getHighlights();
        
        if (response.success && response.data) {
          setHighlights(response.data);
          
          // Cache the data
          localStorage.setItem('cachedHighlights', JSON.stringify(response.data));
          localStorage.setItem('highlightsCacheTime', Date.now().toString());
        } else {
          throw new Error('Failed to load highlights');
        }
      } catch (error) {
        console.error('Failed to fetch highlights:', error);
        setError('Could not load highlights. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighlights();
  }, []);

  // Auto scroll every 5 seconds if in view
  useEffect(() => {
    if (!inView || isLoading || error || !highlights) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const validHighlights = Object.values(highlights).filter(Boolean).length;
        return (prev + 1) % validHighlights;
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [inView, isLoading, error, highlights]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 330; // Card width (300) + gap (30)
      const currentScroll = scrollRef.current.scrollLeft;
      
      scrollRef.current.scrollTo({
        left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
        behavior: 'smooth'
      });
      
      // Update active index based on scroll direction
      setActiveIndex((prev) => {
        const validHighlights = highlights ? Object.values(highlights).filter(Boolean).length : 0;
        if (direction === 'left') {
          return (prev - 1 + validHighlights) % validHighlights;
        } else {
          return (prev + 1) % validHighlights;
        }
      });
    }
  }, [highlights]);

  // Helper function to get image URL
  const getImageUrl = (post: Post | null): string => {
    if (!post) return '/images/placeholder.jpg';
    // First try post image
    if (post.image_url) return post.image_url;
    if (post.image) return post.image;
    if (post.cover_image_url) return post.cover_image_url;
    // Fallback to author's avatar
    if (post.author.profile_image) return post.author.profile_image;
    if (post.author.avatar) return post.author.avatar;
    return '/images/placeholder.jpg';
  };

  // Get the icon for each highlight type
  const getHighlightIcon = (title: string) => {
    switch (title) {
      case 'Latest News':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'Trending Audio':
        return <TrendingUp className="h-5 w-5 text-purple-500" />;
      case 'Featured Post':
        return <Award className="h-5 w-5 text-amber-500" />;
      default:
        return <Zap className="h-5 w-5 text-primary-500" />;
    }
  };

  // Get time ago string
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Convert highlights object to array for mapping
  const highlightsList = highlights ? [
    { id: 1, title: 'Latest News', post: highlights.latest_news, link: `/posts/${highlights.latest_news?.id}`, color: 'blue' },
    { id: 2, title: 'Trending Audio', post: highlights.trending_audio, link: `/posts/${highlights.trending_audio?.id}`, color: 'purple' },
    { id: 3, title: 'Featured Post', post: highlights.featured_post, link: `/posts/${highlights.featured_post?.id}`, color: 'amber' }
  ].filter(item => item.post) : [];

  // If we have no highlights data after loading
  const noHighlights = !isLoading && (!highlights || Object.values(highlights).every(v => !v));

  return (
    <div ref={inViewRef} className="relative p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Highlights</h2>
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center"
              >
                <Badge variant="outline" className="ml-2 bg-gray-100 dark:bg-gray-800 gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-medium">Loading</span>
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => scroll('left')}
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            disabled={isLoading || error !== null}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => scroll('right')}
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            disabled={isLoading || error !== null}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 flex items-center gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No highlights state */}
      <AnimatePresence>
        {noHighlights && !error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-4 flex flex-col items-center gap-3 text-center"
          >
            <Zap className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-300">No highlights available right now.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Check back later for featured content!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main highlights carousel */}
      <div className="relative">
        {/* Dot indicators - Removed as requested */}

        <div
          ref={scrollRef}
          className="grid grid-flow-col auto-cols-max gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {isLoading ? (
            // Loading skeletons - more attractive with varying heights
            Array(3).fill(0).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className={`snap-center flex-shrink-0 min-w-[300px] ${
                  i % 2 === 0 ? 'h-56' : 'h-48'
                } bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl overflow-hidden relative`}
              >
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <Skeleton className="h-6 w-2/3 mb-2 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </div>
              </motion.div>
            ))
          ) : (
            highlightsList.map((highlight, index) => (
              <motion.div
                key={highlight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: activeIndex === index ? 1 : 0.95,
                  filter: activeIndex === index ? 'brightness(1)' : 'brightness(0.9)'
                }}
                transition={{ duration: 0.4 }}
                whileHover={{ scale: 1.02, filter: 'brightness(1.05)' }}
                className={`snap-center flex-shrink-0 min-w-[300px] h-56 rounded-xl overflow-hidden relative shadow-md hover:shadow-lg transition-all`}
              >
                <Link href={highlight.link}>
                  <div className="absolute inset-0">
                    <Image
                      src={getImageUrl(highlight.post!)}
                      alt={highlight.post!.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 90vw, 300px"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                  </div>
                  
                  <div className="absolute inset-0 p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <Badge 
                        className={`bg-${highlight.color}-100 text-${highlight.color}-700 dark:bg-${highlight.color}-900/20 dark:text-${highlight.color}-400 border-none`}
                      >
                        <div className="flex items-center gap-1.5">
                          {getHighlightIcon(highlight.title)}
                          <span>{highlight.title}</span>
                        </div>
                      </Badge>
                      
                      {highlight.post!.created_at && (
                        <span className="text-xs text-white/80 backdrop-blur-sm bg-black/20 px-2 py-1 rounded-full">
                          {getTimeAgo(highlight.post!.created_at)}
                        </span>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-white font-semibold text-lg line-clamp-2 mb-1">
                        {highlight.post!.title}
                      </h3>
                      
                      <div className="flex items-center mt-2">
                        <div className="flex-shrink-0 mr-2">
                          {highlight.post!.author.avatar ? (
                            <Image
                              src={highlight.post!.author.avatar}
                              alt={highlight.post!.author.username}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center">
                              <span className="text-xs text-primary-700">
                                {highlight.post!.author.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-white/80">
                          {highlight.post!.author.username}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
        
        {/* Desktop indicator dots - Removed as requested */}
      </div>
    </div>
  );
};