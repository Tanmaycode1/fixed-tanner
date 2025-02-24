"use client";

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LogOut, 
  Search, 
  MessageSquare, 
  User, 
  PlusSquare, 
  Home,
  Moon,
  Sun,
  Settings,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { userApi, authApi, getFullImageUrl } from '@/services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '@/context/ThemeContext';
import { User as UserType } from '@/types/user';

const menuItems = [
  { 
    name: 'Home',
    href: '/dashboard',
    icon: Home,
    color: 'text-blue-500 dark:text-blue-400'
  },
  { 
    name: 'Explore',
    href: '/search',
    icon: Search,
    color: 'text-green-500 dark:text-green-400'
  },
  { 
    name: 'Create',
    href: '/create',
    icon: PlusSquare,
    color: 'text-purple-500 dark:text-purple-400'
  },
  { 
    name: 'Messages',
    href: '/messages',
    icon: MessageSquare,
    color: 'text-pink-500 dark:text-pink-400'
  },
  { 
    name: 'Notifications',
    href: '/notifications',
    icon: Bell,
    color: 'text-yellow-500 dark:text-yellow-400'
  },
  { 
    name: 'Profile',
    href: '/profile',
    icon: User,
    color: 'text-gray-500 dark:text-gray-400'
  }
];

export function Sidebar({ currentUser }: { currentUser: UserType | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await userApi.getProfile();
      if (response.success) {
        // Assuming the response.data is of the same structure as the currentUser prop
        // If not, you might want to adjust this part to match your actual data structure
        // For example, if the response.data is different, you might want to set the currentUser state directly
        // setCurrentUser(response.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      localStorage.clear();
      toast.success('Logged out successfully');
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.clear();
      router.push('/auth/login');
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center">
          <motion.span 
            className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            Neuhu
          </motion.span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.2 }}
            >
              <Link href={item.href}>
                <div className={`
                  relative flex items-center px-4 py-2.5 rounded-xl transition-all
                  ${isActive 
                    ? 'text-primary-500 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                  <span className="ml-3 font-medium">{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 w-1 inset-y-1 bg-primary-500 dark:bg-primary-400 rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex flex-col space-y-4">
          {/* User Info */}
          {currentUser && (
            <Link href="/profile">
              <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-offset-2 ring-transparent group-hover:ring-primary-500/20 dark:ring-offset-gray-900 transition-all">
                    {currentUser.avatar_url ? (
                      <img
                        src={getFullImageUrl(currentUser.avatar_url)}
                        alt={`${currentUser.first_name} ${currentUser.last_name}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {`${currentUser.first_name} ${currentUser.last_name}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    @{currentUser.username}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {/* {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-blue-500" />
              )} */}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
            >

            <Link href="/profile/edit">
              <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </Link>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}