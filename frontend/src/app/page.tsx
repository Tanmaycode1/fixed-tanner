"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { PostCard } from '@/components/posts/PostCard';
import { mockPosts, trendingTopics } from '@/data/mockData';
import { 
  BookOpen, ChevronDown, TrendingUp, 
  ArrowRight, Sparkles, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { postsApi } from '@/services/postsApi';
import type { Post } from '@/services/postsApi';
import { PublicPostCard } from '@/components/posts/PublicPostCard';

const FloatingElement = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  return (
    <motion.div
      animate={{
        y: [0, -15, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
};

const ParticleBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#38BDF8]/5 to-transparent animate-pulse" />
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-[#38BDF8]/20 rounded-full"
          initial={{
            x: Math.random() * 100 + "%",
            y: Math.random() * 100 + "%",
          }}
          animate={{
            y: ["-10%", "110%"],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
};

const GlowingButton = ({ children, onClick, className = "" }: { children: React.ReactNode; onClick: () => void; className?: string }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-[#38BDF8]/20 to-[#0EA5E9]/20"
        initial={{ x: "-100%" }}
        whileHover={{ x: "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
      {children}
    </motion.button>
  );
};

export default function Home() {
  const router = useRouter();
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const { scrollYProgress } = useScroll();
  const mainRef = useRef(null);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const translateY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.98]);

  const stats = [
    { label: "Active Users", value: "100K+", color: "text-[#38BDF8]" },
    { label: "Daily Posts", value: "5K+", color: "text-[#10B981]" },
    { label: "Topics", value: "500+", color: "text-[#8B5CF6]" },
  ];

  useEffect(() => {
    const fetchTrendingPosts = async () => {
      try {
        setIsLoading(true);
        const response = await postsApi.getTrending();
        console.log('Trending API Response:', response); // Debug log
        
        if (response.success && response.data?.results) {
          console.log('Setting trending posts:', response.data.results); // Debug log
          setTrendingPosts(response.data.results);
        } else {
          console.log('No trending posts found in response:', response); // Debug log
          setTrendingPosts([]);
        }
      } catch (error) {
        console.error('Error fetching trending posts:', error);
        setTrendingPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendingPosts();
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-screen bg-white dark:bg-[#0B1121] overflow-hidden mt-[-80px] pt-[80px]">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid-gray-100/20 dark:bg-grid-white/10" />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white/40 dark:from-[#0B1121] dark:via-[#0B1121]/90 dark:to-[#0B1121]" />
        <ParticleBackground />
        
        {/* Main Content */}
        <motion.div 
          ref={mainRef}
          style={{ translateY, opacity, scale }} 
          className="relative z-10 flex flex-col justify-center min-h-screen"
        >
          <div className="container px-4">
            <div className="max-w-4xl mx-auto text-center mt-24 md:mt-0">
                              <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", duration: 1 }}
                  className="inline-flex items-center justify-center mb-8 bg-white/10 dark:bg-white/5 backdrop-blur-lg rounded-2xl p-4 relative z-20"
                >
                  <BookOpen className="h-8 w-8 text-[#38BDF8]" />
                  <span className="text-2xl font-bold bg-gradient-to-r from-[#38BDF8] to-[#0EA5E9] bg-clip-text text-transparent ml-2">
                    Neuhu
                  </span>
                </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative mb-8"
              >
                <motion.h1 
                  className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-black dark:text-white"
                >
                  Share Your 
                  Knowledge
                  <div className="relative mt-4">
                    <span className="block text-[#38BDF8]">
                      Inspire Others
                    </span>
                    <motion.div
                      className="absolute -right-16 -top-16"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-10 w-10 text-[#38BDF8]" />
                    </motion.div>
                  </div>
                </motion.h1>
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed"
              >
                Neuhu delivers business, markets expert news, analysis, and audios to the world, 
                featuring stories from global experts.
              </motion.p>

              {/* Stats Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-3 gap-8 mb-12"
              >
                {stats.map((stat, index) => (
                  <FloatingElement key={stat.label} delay={index * 0.2}>
                    <div className="p-4 rounded-xl bg-white/10 dark:bg-white/5 backdrop-blur-lg">
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 + index * 0.2 }}
                        className={`text-3xl font-bold ${stat.color} mb-2`}
                      >
                        {stat.value}
                      </motion.div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {stat.label}
                      </div>
                    </div>
                  </FloatingElement>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Scroll Button with enhanced animation - Repositioned */}
        <motion.div 
          className="hidden md:block absolute bottom-10 left-1/2 -translate-x-1/2 z-30"
          animate={{
            y: [0, 6, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          <Button
            onClick={() => {
              const contentSection = document.getElementById('content-section');
              if (contentSection) {
                contentSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full bg-[#1a2234]/80 backdrop-blur-lg border border-[#38BDF8]/20 hover:border-[#38BDF8]/40 transition-all duration-300"
          >
            <ChevronDown className="h-4 w-4 text-[#38BDF8]" />
          </Button>
        </motion.div>
      </section>

      {/* Content Section with enhanced animations */}
      <section id="content-section" className="py-16 md:py-24 bg-gray-50 dark:bg-[#0F172A]">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* Enhanced Sidebar */}
            <div className="hidden lg:block">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <Card className="p-6 sticky top-20 bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-lg border-gray-200/50 dark:border-gray-800/50">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-[#38BDF8]" />
                    Trending Topics
                  </h3>
                  <div className="space-y-2">
                    {trendingTopics.map((topic, index) => (
                      <motion.button
                        key={topic.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onHoverStart={() => setHoveredTopic(topic.id)}
                        onHoverEnd={() => setHoveredTopic(null)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors">
                          <div className="flex items-center space-x-3">
                            <motion.div 
                              className={`w-2 h-2 rounded-full bg-${topic.color}-500`}
                              animate={{
                                scale: hoveredTopic === topic.id ? [1, 1.5, 1] : 1,
                              }}
                              transition={{ duration: 0.5 }}
                            />
                            <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#38BDF8] transition-colors">
                              {topic.name}
                            </span>
                          </div>
                          <motion.div
                            animate={{
                              x: hoveredTopic === topic.id ? [0, 5, 0] : 0,
                            }}
                            transition={{ duration: 0.5 }}
                          >
                            <ArrowRight 
                              className={`h-4 w-4 text-[#38BDF8] transition-opacity duration-200 ${
                                hoveredTopic === topic.id ? 'opacity-100' : 'opacity-0'
                              }`} 
                            />
                          </motion.div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <TrendingUp className="h-6 w-6 text-[#38BDF8]" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Trending Posts
                  </h2>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                  </div>
                ) : trendingPosts.length > 0 ? (
                  trendingPosts.map((post) => (
                    <PublicPostCard
                      key={post.id}
                      post={post}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No Trending Posts Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Check back later for the latest trending content
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Gradient */}
      <div className="h-24 bg-gradient-to-t from-gray-50 to-transparent dark:from-[#0F172A] dark:to-[#0F172A]" />
    </Layout>
  );
}