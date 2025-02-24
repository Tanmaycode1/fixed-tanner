"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Home,
  Search,
  PlusSquare,
  MessageSquare,
  User,
  Bell
} from 'lucide-react';

const navigationItems = [
  { 
    name: 'Home', 
    href: '/dashboard', 
    icon: Home,
    color: 'text-blue-500'
  },
  { 
    name: 'Explore', 
    href: '/search', 
    icon: Search,
    color: 'text-green-500'
  },
  { 
    name: 'Create', 
    href: '/create', 
    icon: PlusSquare,
    color: 'text-purple-500'
  },
  { 
    name: 'Messages', 
    href: '/messages', 
    icon: MessageSquare,
    color: 'text-pink-500'
  },
  { 
    name: 'Profile', 
    href: '/profile', 
    icon: User,
    color: 'text-indigo-500'
  }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      {/* Gradient Border */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
      
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-around px-4 py-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative py-2 px-3"
                >
                  <motion.div
                    className="flex flex-col items-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className={`
                      relative p-1.5 rounded-xl
                      ${isActive 
                        ? 'text-primary-500 dark:text-primary-400' 
                        : 'text-gray-500 dark:text-gray-400'
                      }
                    `}>
                      <item.icon className={`
                        h-6 w-6 transition-colors
                        ${isActive ? item.color : 'current'}
                      `} />

                      {isActive && (
                        <motion.div
                          className="absolute inset-0 bg-primary-100 dark:bg-primary-900/20 rounded-xl -z-10"
                          layoutId="nav-pill"
                          transition={{ type: "spring", duration: 0.5 }}
                        />
                      )}
                    </div>
                    
                    <span className={`
                      text-xs mt-1 transition-colors
                      ${isActive 
                        ? 'font-medium text-gray-900 dark:text-white' 
                        : 'text-gray-500 dark:text-gray-400'
                      }
                    `}>
                      {item.name}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}