"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'react-hot-toast';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    authCheck(pathname);
  }, [pathname]);

  const authCheck = (url: string) => {
    // Define public paths that don't require authentication
    const publicPaths = [
      '/',                // Landing page
      '/auth/login',      // Login page
      '/auth/register',   // Registration page
      '/about',           // If you have an about page
      '/contact',         // If you have a contact page
      '/privacy-policy',  // Other public pages
      '/terms'
    ];

    const path = url.split('?')[0];
    const accessToken = localStorage.getItem('access_token');

    // If it's a public path, allow access
    if (publicPaths.includes(path)) {
      setAuthorized(true);
      return;
    }

    // For protected routes, check for access token
    if (!accessToken) {
      setAuthorized(false);
      toast.error('Please login to access this page');
      router.push('/auth/login');
      return;
    }

    // User has token, allow access
    setAuthorized(true);
  };

  // Show loading or nothing while checking authentication
  if (pathname === undefined) {
    return null;
  }

  return authorized ? <>{children}</> : null;
} 