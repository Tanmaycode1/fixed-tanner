"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authApi } from '@/services/api';
import type { RegisterData } from '@/types/auth';
import { toast } from 'react-hot-toast';

export default function Register() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleRegister = async (data: RegisterData) => {
    setIsLoading(true);
    setErrors({});
    try {
      const response = await authApi.register({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        // Username is optional, will be generated from email if not provided
      });
      
      if (response.success) {
        toast.success('Registration successful!');
        router.push('/onboarding');
      } else {
        if (response.errors) {
          setErrors(response.errors);
          // Show the first error message as a toast
          const firstError = Object.values(response.errors)[0]?.[0] || response.message;
          toast.error(firstError);
        } else {
          toast.error(response.message || 'Registration failed');
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred';
      toast.error(errorMessage);
      setErrors({
        non_field_errors: [errorMessage]
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout mode="register">
      <AuthForm
        mode="register"
        onSubmit={handleRegister}
        isLoading={isLoading}
        errors={errors}
      />
    </AuthLayout>
  );
} 