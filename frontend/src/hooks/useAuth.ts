import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/user';
import { authApi } from '@/services/apiService';
import { useRouter } from 'next/navigation';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const checkAuth = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setUser(null);
                setLoading(false);
                return false;
            }

            const response = await authApi.me();
            if (response.data.success) {
                setUser(response.data.data);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (credentials: { email: string; password: string }) => {
        try {
            const response = await authApi.login(credentials);
            if (response.data.access) {
                localStorage.setItem('token', response.data.access);
                localStorage.setItem('refreshToken', response.data.refresh);
                await checkAuth();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };

    const logout = async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setUser(null);
        router.push('/login');
    };

    useEffect(() => {
        const init = async () => {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated && window.location.pathname !== '/login') {
                router.push('/login');
            }
        };
        init();
    }, [checkAuth, router]);

    return { user, loading, login, logout, checkAuth };
} 