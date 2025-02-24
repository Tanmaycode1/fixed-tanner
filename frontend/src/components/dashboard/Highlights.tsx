'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { postsApi, type Post } from '@/services/postsApi';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export const Highlights = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<{
    latest_news: Post | null;
    trending_audio: Post | null;
    featured_post: Post | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const response = await postsApi.getHighlights();
        if (response.success && response.data) {
          setHighlights(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch highlights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighlights();
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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

  // Convert highlights object to array for mapping
  const highlightsList = highlights ? [
    { id: 1, title: 'Latest News', post: highlights.latest_news, link: `/posts/${highlights.latest_news?.id}` },
    { id: 2, title: 'Trending Audio', post: highlights.trending_audio, link: `/posts/${highlights.trending_audio?.id}` },
    { id: 3, title: 'Featured Post', post: highlights.featured_post, link: `/posts/${highlights.featured_post?.id}` }
  ] : [];

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Highlights</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <BsChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <BsChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-4"
      >
        {isLoading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex-shrink-0 relative w-60 h-32">
              <Skeleton className="w-full h-full rounded-xl" />
            </div>
          ))
        ) : (
          highlightsList.map((highlight) => (
            highlight.post && (
              <motion.div
                key={highlight.id}
                whileHover={{ scale: 1.05 }}
                className="flex-shrink-0 relative w-60 h-32 rounded-xl overflow-hidden"
              >
                <Link href={highlight.link}>
                  <div className="relative w-full h-full">
                    <Image
                      src={getImageUrl(highlight.post)}
                      alt={highlight.post.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      {(highlight.title === 'Latest News' || highlight.title === 'Trending Audio') && (
                        <h3 className="text-white font-semibold text-lg">{highlight.title}</h3>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          ))
        )}
      </div>
    </div>
  );
};