import { useEffect, useMemo } from 'react';
import { AdminService } from '@/services/adminService';
import { useAdmin } from '@/context/AdminContext';

export function useAdminService() {
  const { apiKey } = useAdmin();

  const adminService = useMemo(() => {
    return new AdminService({ apiKey: apiKey || '' });
  }, [apiKey]);

  return adminService;
} 