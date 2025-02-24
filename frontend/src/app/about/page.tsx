"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { NewspaperIcon, SpeakerWaveIcon, UserGroupIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

// Animation variants for consistent timing
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const features = [
  {
    icon: NewspaperIcon,
    title: "Expert News Coverage",
    description: "Get in-depth analysis and coverage of business and market news from global experts."
  },
  {
    icon: SpeakerWaveIcon,
    title: "Audio Content",
    description: "Listen to news, analysis, and expert opinions in audio format for on-the-go consumption."
  },
  {
    icon: UserGroupIcon,
    title: "Expert Community",
    description: "Connect with a community of business professionals and market experts."
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: "Real-time Discussions",
    description: "Engage in live discussions about market trends and business news."
  }
];

const steps = [
  {
    number: "01",
    title: "Create an Account",
    description: "Sign up for free and complete your profile to get started."
  },
  {
    number: "02",
    title: "Explore Content",
    description: "Browse through expert news, analysis, and audio content."
  },
  {
    number: "03",
    title: "Join Discussions",
    description: "Engage with experts and fellow professionals in real-time discussions."
  },
  {
    number: "04",
    title: "Share Insights",
    description: "Contribute your own expertise through posts and audio content."
  }
];

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-white dark:from-gray-800 dark:to-gray-900" />
          <div className="absolute inset-y-0 right-0 w-1/2">
            <svg className="h-full w-full" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" className="text-primary-200/20 dark:text-primary-500/10" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <motion.div
                {...fadeInUp}
                className="inline-block mb-4 px-4 py-1.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
              >
                The Future of Business News
              </motion.div>
              
              <motion.h1 
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
              >
                Expert Business News & Analysis
              </motion.h1>
              
              <motion.p 
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-xl text-gray-600 dark:text-gray-300 mb-8"
              >
                Neuhu delivers business, markets expert news, analysis, and audios to the world, 
                featuring stories from global experts.
              </motion.p>
              
              <motion.div 
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-wrap gap-4"
              >
                <a 
                  href="/register" 
                  className="px-8 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors duration-300"
                >
                  Get Started
                </a>
                <a 
                  href="/about" 
                  className="px-8 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 transition-colors duration-300"
                >
                  Learn More
                </a>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-xl dark:shadow-primary-500/10">
                <Image
                  src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2074&q=80"
                  alt="Business professionals discussing news"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              
              {/* Floating Stats Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg dark:shadow-primary-500/10"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 dark:bg-primary-900/50 p-3 rounded-full">
                    <UserGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">50K+</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Active Users</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 mb-4">
              Why Choose Neuhu?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Your gateway to expert insights, real-time market analysis, and a thriving professional community.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="bg-gray-50 dark:bg-gray-800 p-8 rounded-xl shadow-sm dark:shadow-primary-500/10 hover:shadow-md transition-shadow duration-300"
              >
                <div className="bg-primary-50 dark:bg-primary-900/50 p-3 rounded-lg w-fit mb-6">
                  <feature.icon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How Neuhu Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get started with Neuhu in four simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative"
              >
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm dark:shadow-primary-500/10 relative z-10">
                  <div className="text-7xl font-bold text-primary-100 dark:text-primary-900/30 absolute -top-6 -left-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 relative text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 relative">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gray-200 dark:bg-gray-700" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
} 
