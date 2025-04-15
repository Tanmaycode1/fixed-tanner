"use client";

import { motion } from 'framer-motion';
import { Check, Headphones, Mic, Users, MessageSquare, Clock, Upload, ChevronDown, XCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

// Animation variants for consistent timing
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const premiumFeatures = [
  {
    icon: Headphones,
    title: "Unlimited Audio Content",
    description: "Access our entire library of expert audio content and analysis"
  },
  {
    icon: Mic,
    title: "Premium Audio Quality",
    description: "High-quality audio recordings for the best listening experience"
  },
  {
    icon: Users,
    title: "Expert Network",
    description: "Connect with industry leaders and thought experts"
  },
  {
    icon: MessageSquare,
    title: "Direct Messaging",
    description: "Message and connect with experts directly"
  },
  {
    icon: Clock,
    title: "Extended Audio Length",
    description: "Upload and listen to longer audio content"
  },
  {
    icon: Upload,
    title: "Unlimited Uploads",
    description: "Share your insights without limits"
  }
];

const features = [
  {
    name: 'Basic',
    price: 'Free',
    description: 'Perfect for getting started',
    features: [
      'Basic audio uploads',
      'Limited storage space',
      'Standard audio quality',
      'Basic analytics',
      'Community access'
    ],
    cta: 'Get Started',
    href: '/auth/register'
  },
  {
    name: 'Pro',
    price: '$189.99',
    period: '/month',
    description: 'For content creators and professionals',
    features: [
      'Unlimited audio uploads',
      'High quality audio',
      'Advanced analytics',
      'Unlimited messenger credit',
      'Access to analytic dashboard',
      'Profile views for 365 days',
      'Advanced follower and account search'
    ],
    extraFeatures: [
      'Extended storage space',
      'Priority support',
      'Custom branding',
      'Scheduled posts',
      'Unlimited expert and investor browsing',
      'Follower recommendation and save follower',
      'AI search filters',
      'Follower recommendation daily',
      'Advanced content scheduling',
      'Priority customer support',
      'Custom API integrations',
      'Exclusive webinars and events'
    ],
    cta: 'Upgrade to Pro',
    href: '/auth/register?plan=pro',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Everything in Pro',
      'Custom integrations',
      'Dedicated support',
      'Team collaboration',
      'API access',
      'Custom solutions',
      'White-label options'
    ],
    extraFeatures: [
      'Unlimited messenger credit',
      'Access to analytic dashboard',
      'Profile views for 365 days',
      'Unlimited expert and investor browsing',
      'Advanced follower and account search',
      'Follower recommendation and save follower',
      'AI search filters',
      'Follower recommendation daily',
      'Enterprise-grade security',
      'User role management',
      'Dedicated account manager',
      'Custom reporting',
      'Priority feature requests'
    ],
    cta: 'Contact Sales',
    href: '/contact'
  }
];

export default function PremiumPage() {
  const [showModal, setShowModal] = useState(false);
  const [modalFeatures, setModalFeatures] = useState<string[]>([]);
  const [modalTitle, setModalTitle] = useState('');

  const openFeaturesModal = (planName: string, features: string[]) => {
    setModalTitle(`${planName} Plan - All Features`);
    setModalFeatures(features);
    setShowModal(true);
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Features Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{modalTitle}</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <ul className="space-y-3">
              {modalFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}

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
                Exclusive Benefits
              </motion.div>
              
              <motion.h1 
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
              >
                Elevate Your Experience
              </motion.h1>
              
              <motion.p 
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-xl text-gray-600 dark:text-gray-300 mb-8"
              >
                Unlock premium features like unlimited messaging, audio uploads, and access to our expert network. Choose from three flexible plans to suit your needs.
              </motion.p>
              
              <motion.div
                {...fadeInUp}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-wrap gap-4"
              >
                <Link 
                  href="#pricing" 
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors duration-300"
                >
                  View Plans
                </Link>
                <Link 
                  href="/contact" 
                  className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors duration-300"
                >
                  Contact Sales
                </Link>
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
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                  alt="Premium subscription benefits"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-400 dark:to-primary-200 mb-4">
              Premium Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Get access to exclusive features and content with our premium plans
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {premiumFeatures.map((feature, index) => (
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

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Select the perfect plan for your needs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 ${
                  plan.popular ? 'border-2 border-primary-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary-500 text-white px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-600 dark:text-gray-300 ml-1">
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {feature}
                      </span>
                    </li>
                  ))}

                  {plan.extraFeatures && plan.extraFeatures.length > 0 && (
                    <li>
                      <button 
                        onClick={() => openFeaturesModal(plan.name, [...plan.features, ...plan.extraFeatures])}
                        className="flex items-center text-primary-500 hover:text-primary-600 font-medium mt-2"
                      >
                        <ChevronDown className="h-4 w-4 mr-1" />
                        See more features
                      </button>
                    </li>
                  )}
                </ul>

                <Link
                  href={plan.href}
                  className={`block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 text-center"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Need help choosing?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Contact our sales team to find the perfect plan for your needs
            </p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Contact Sales
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
} 