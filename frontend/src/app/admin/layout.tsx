'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdmin } from '@/context/AdminContext';
import { AdminProvider } from '@/context/AdminContext';
import AdminNav from '@/components/AdminNav';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin') {
      router.push('/admin');
    }
  }, [isAuthenticated, router, pathname]);

  if (!isAuthenticated && pathname !== '/admin') {
    return null;
  }

  return (
    <>
      {pathname !== '/admin' && <AdminNav />}
      {children}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <ProtectedLayout>
        {children}
      </ProtectedLayout>
    </AdminProvider>
  );
} 