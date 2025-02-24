import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';

interface AuthLayoutProps {
  children: React.ReactNode;
  mode: 'login' | 'register';
}

const Illustration = ({ className = "" }) => (
  <svg className={`w-full h-full ${className}`} viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Dynamic Background */}
    <motion.rect 
      width="800" 
      height="600" 
      className="fill-primary-50/30 dark:fill-gray-900/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    />

    {/* Animated Circles */}
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 0.2 }}
    >
      <circle cx="400" cy="300" r="180" className="fill-primary-100/40 dark:fill-primary-900/20" />
      <circle cx="400" cy="300" r="140" className="fill-primary-200/40 dark:fill-primary-800/20" />
      <circle cx="400" cy="300" r="100" className="fill-primary-300/40 dark:fill-primary-700/20" />
    </motion.g>

    {/* Decorative Lines */}
    <motion.g 
      initial={{ opacity: 0, pathLength: 0 }}
      animate={{ opacity: 1, pathLength: 1 }}
      transition={{ duration: 1.5, delay: 0.5 }}
    >
      <path
        d="M200 150 Q400 50 600 150"
        className="stroke-primary-300 dark:stroke-primary-600"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M200 450 Q400 550 600 450"
        className="stroke-primary-300 dark:stroke-primary-600"
        strokeWidth="2"
        fill="none"
      />
    </motion.g>

    {/* Abstract Shapes */}
    <motion.g
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.8 }}
    >
      {/* Connected dots pattern */}
      {Array.from({ length: 5 }).map((_, i) => (
        <g key={i}>
          <circle
            cx={300 + i * 50}
            cy={250 + (i % 2) * 100}
            r="4"
            className="fill-primary-400 dark:fill-primary-500"
          />
          {i < 4 && (
            <line
              x1={304 + i * 50}
              y1={250 + (i % 2) * 100}
              x2={346 + i * 50}
              y2={250 + ((i + 1) % 2) * 100}
              className="stroke-primary-300 dark:stroke-primary-600"
              strokeWidth="2"
            />
          )}
        </g>
      ))}
    </motion.g>

    {/* Floating Elements */}
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1 }}
    >
      <motion.rect
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        x="250" y="150" width="30" height="30"
        className="fill-primary-400/50 dark:fill-primary-500/50"
        rx="8"
      />
      <motion.circle
        animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        cx="520" cy="380" r="15"
        className="fill-primary-500/50 dark:fill-primary-400/50"
      />
      <motion.path
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        d="M600 200 L620 220 L600 240 L580 220 Z"
        className="fill-primary-300/50 dark:fill-primary-600/50"
      />
    </motion.g>
  </svg>
);

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, mode }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-primary-50/30 to-white dark:from-gray-950 dark:via-primary-950/10 dark:to-gray-950 flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <Link href="/">
            <Button 
              variant="ghost" 
              size="sm"
              className="rounded-xl bg-white/80 hover:bg-primary-100/50 dark:bg-gray-800/80 dark:hover:bg-primary-900/50 shadow-sm dark:shadow-primary-500/20 border border-gray-200/50 dark:border-gray-700/50"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </Button>
          </Link>
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-primary-500/20 dark:from-primary-400/20 dark:to-primary-400/20 rounded-full blur-sm" />
            <div className="relative bg-white/80 dark:bg-gray-800/80 rounded-full p-1 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <ThemeToggle />
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="relative">
              {/* Glass effect and glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-primary-300 to-primary-500 dark:from-primary-700 dark:via-primary-600 dark:to-primary-700 rounded-[22px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              
              {/* Main card */}
              <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl shadow-primary-500/10 dark:shadow-primary-900/30 overflow-hidden">
                {/* Decorative top bar */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary-500 via-primary-300 to-primary-500" />
                
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Illustration */}
      <div className="hidden lg:block w-1/2 relative">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 p-8"
        >
          <div className="relative h-full w-full rounded-3xl overflow-hidden">
            {/* Custom SVG Illustration */}
            <Illustration className="absolute inset-0" />
            
            {/* Content Overlay */}
            <div className="absolute bottom-8 left-8 right-8 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-4xl font-bold"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                  {mode === 'login' 
                    ? "Welcome back!" 
                    : "Join the community"}
                </span>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-lg text-gray-600 dark:text-gray-400"
              >
                {mode === 'login'
                  ? "Great to see you again. Let's get you signed in."
                  : "Start your journey with us and discover amazing possibilities."}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;