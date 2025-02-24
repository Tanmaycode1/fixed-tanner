"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Twitter, Linkedin, Facebook, Instagram } from 'lucide-react';

const footerSections = {
  features: [
    { label: 'News', href: '/news' },
    { label: 'Audio Content', href: '/audio' },
    { label: 'Expert Network', href: '/experts' },
    { label: 'Live Discussions', href: '/discussions' }
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
    { label: 'Blog', href: '/blog' }
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' }
  ]
};

const socialLinks = [
  { Icon: Twitter, href: '#', label: 'Twitter' },
  { Icon: Linkedin, href: '#', label: 'LinkedIn' },
  { Icon: Facebook, href: '#', label: 'Facebook' },
  { Icon: Instagram, href: '#', label: 'Instagram' }
];

const Footer = () => {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-blue-500" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                Neuhu
              </span>
            </Link>
            <p className="text-gray-600 dark:text-gray-300 max-w-md">
              Your premier platform for business news, expert analysis, and professional networking.
              Join our community of thought leaders and industry experts.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map(({ Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all duration-300"
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{label}</span>
                </motion.a>
              ))}
            </div>
          </div>

          {/* Features Section */}
          <div>
            <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">Features</h4>
            <ul className="space-y-3">
              {footerSections.features.map(({ label, href }) => (
                <li key={href}>
                  <Link 
                    href={href} 
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Section */}
          <div>
            <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">Company</h4>
            <ul className="space-y-3">
              {footerSections.company.map(({ label, href }) => (
                <li key={href}>
                  <Link 
                    href={href} 
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Section */}
          <div>
            <h4 className="font-semibold mb-4 text-gray-900 dark:text-white">Legal</h4>
            <ul className="space-y-3">
              {footerSections.legal.map(({ label, href }) => (
                <li key={href}>
                  <Link 
                    href={href} 
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} Neuhu. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link 
                href="/accessibility" 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                Accessibility
              </Link>
              <Link 
                href="/sitemap" 
                className="text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;