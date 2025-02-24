"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import MobileMenu from './MobileMenu';
import ThemeToggle from './ThemeToggle';

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-primary-600 dark:text-primary-400"
            >
              Neuhu
            </motion.div>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/about">About</NavLink>
            <NavLink href="/features">Features</NavLink>
            <NavLink href="/contact">Contact</NavLink>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Link 
              href="/auth/login"
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Login
            </Link>
            <Link 
              href="/auth/register"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              Get Started
            </Link>
          </div>

          <MobileMenu />
        </div>
      </nav>
    </header>
  );
};

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Link 
      href={href}
      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
};

export default Header; 