"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/services/api';
import type { LoginCredentials } from '@/types/auth';
import type { AuthResponse } from '@/types/auth';
import { ApiError } from '@/services/api';
import { toast } from 'react-hot-toast';

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (data: LoginCredentials) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.login(data);

      if (response.success) {
        toast.success('Login successful!');
        router.push('/dashboard');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (error: any) {
      if (error instanceof ApiError) {
        setError(error.userMessage);
        toast.error(error.userMessage);
      } else {
        setError('An unexpected error occurred');
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary-50/30 to-white dark:from-gray-950 dark:via-primary-950/10 dark:to-gray-950">
      <AuthLayout mode="login">
        <AuthForm
          mode="login"
          onSubmit={handleLogin}
          isLoading={isLoading}
        />
      </AuthLayout>
    </div>
  );
}