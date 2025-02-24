'use client';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

export const CaughtUpAnimation = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        <CheckCircle className="w-16 h-16 text-primary-500 mb-4" />
      </motion.div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        You're All Caught Up!
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-center">
        You've seen all the latest posts. Check back later for more updates!
      </p>
    </motion.div>
  );
}; 