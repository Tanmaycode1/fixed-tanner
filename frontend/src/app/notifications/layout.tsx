"use client";

import { useState, useEffect } from 'react';
import { userApi } from '@/services/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';


export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await userApi.getProfile();
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUser();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:w-64 fixed inset-y-0">
          <Sidebar currentUser={currentUser} />
        </div>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-30">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 h-16 flex items-center justify-between">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">
                Eemu
              </span>
              {/* <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              > */}
                {/* {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )} */}
              {/* </button> */}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:pl-64">
          <div className="min-h-screen pt-16 lg:pt-0">
            {children}
          </div>
        </main>

        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}