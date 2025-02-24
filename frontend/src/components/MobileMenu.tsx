"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <Bars3Icon className="h-6 w-6" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-16 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4"
          >
            <nav className="container mx-auto px-4">
              <ul className="space-y-4">
                <li>
                  <Link 
                    href="/about"
                    className="block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/features"
                    className="block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/pricing"
                    className="block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/contact"
                    className="block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileMenu; 