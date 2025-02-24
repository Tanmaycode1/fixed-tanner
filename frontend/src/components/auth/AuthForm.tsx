import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { authApi, ApiError } from '@/services/api';
import { toast } from 'react-hot-toast';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
  errors?: Record<string, string[]>;
}

type FieldErrors = {
  form?: string[];
  email?: string[];
  password?: string[];
  first_name?: string[];
  last_name?: string[];
  confirmPassword?: string[];
  otp?: string[];
  non_field_errors?: string[];
  [key: string]: string[] | undefined;
};

export const AuthForm: React.FC<AuthFormProps> = ({ mode, onSubmit, isLoading, errors: serverErrors }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<FieldErrors>({});
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Record<string, string>) => ({ ...prev, [name]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: FieldErrors = {};
    
    if (!formData.email?.trim()) {
      newErrors.email = ['Email is required'];
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = ['Please enter a valid email address'];
    }

    if (!formData.password?.trim()) {
      newErrors.password = ['Password is required'];
    } else if (formData.password.length < 8) {
      newErrors.password = ['Password must be at least 8 characters'];
    }

    if (mode === 'register') {
      if (!formData.first_name?.trim()) {
        newErrors.first_name = ['First name is required'];
      }
      if (!formData.last_name?.trim()) {
        newErrors.last_name = ['Last name is required'];
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = ['Passwords do not match'];
      }
    }

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = async () => {
    try {
      setValidationErrors({});
      setIsVerifying(true);
      const response = await authApi.sendVerificationOtp(formData.email);
      if (response.success) {
        setOtpSent(true);
        toast.success('Verification code sent to your email');
      } else if (response.errors) {
        setValidationErrors(response.errors);
        toast.error(response.message || 'Failed to send verification code');
      }
    } catch (err) {
      toast.error('Failed to send verification code');
      setValidationErrors({
        non_field_errors: ['An unexpected error occurred while sending verification code']
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setValidationErrors({});
      setIsVerifying(true);
      const response = await authApi.verifyEmailOtp(formData.email, otp);
      if (response.success) {
        setIsEmailVerified(true);
        toast.success('Email verified successfully');
        setOtpSent(false);
      } else if (response.errors) {
        setValidationErrors(response.errors);
        toast.error(response.message || 'Failed to verify email');
      }
    } catch (err) {
      toast.error('Failed to verify email');
      setValidationErrors({
        non_field_errors: ['An unexpected error occurred while verifying email']
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    try {
        if (mode === 'register') {
            if (!isEmailVerified) {
                // If email isn't verified, handle OTP flow
                if (!otpSent) {
                    await handleSendOTP();
                    return;
                }
                // If OTP is sent but not verified
                toast.error('Please verify your email first');
                return;
            }

            // Only proceed with registration if email is verified
            await onSubmit(formData);
        } else {
            // Login flow
            await onSubmit(formData);
        }
    } catch (err) {
        console.error('Form submission error:', err);
        toast.error('An unexpected error occurred');
    }
};
  // Combine validation errors with server errors
  const allErrors: FieldErrors = {
    ...validationErrors,
    ...serverErrors
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block"
        >
          <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
            {mode === 'login' ? 'Sign In' : 'Sign Up'}
          </span>
        </motion.div>
        
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 dark:from-primary-400 dark:via-primary-300 dark:to-primary-400">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <Link 
                href="/auth/register" 
                className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 font-medium underline-offset-4 hover:underline transition-colors duration-200"
              >
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium underline-offset-4 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </motion.div>

      {/* General Error Messages */}
      {allErrors.non_field_errors && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-red-50 p-4 text-sm text-red-600"
        >
          {allErrors.non_field_errors[0]}
        </motion.div>
      )}

      {/* Form */}
      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Input
                name="first_name"
                placeholder="First Name"
                onChange={handleChange}
                className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
                  allErrors.first_name ? 'border-red-500 dark:border-red-500' : ''
                }`}
              />
              {allErrors.first_name && (
                <p className="text-sm text-red-500">{allErrors.first_name[0]}</p>
              )}
            </div>
            <div className="space-y-1">
              <Input
                name="last_name"
                placeholder="Last Name"
                onChange={handleChange}
                className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
                  allErrors.last_name ? 'border-red-500 dark:border-red-500' : ''
                }`}
              />
              {allErrors.last_name && (
                <p className="text-sm text-red-500">{allErrors.last_name[0]}</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Input
            name="email"
            type="email"
            placeholder="Email"
            onChange={handleChange}
            className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
              allErrors.email ? 'border-red-500 dark:border-red-500' : ''
            }`}
          />
          {allErrors.email && (
            <p className="text-sm text-red-500 dark:text-red-400">{allErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Input
            name="password"
            type="password"
            placeholder="Password"
            onChange={handleChange}
            className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
              allErrors.password ? 'border-red-500 dark:border-red-500' : ''
            }`}
          />
          {allErrors.password && (
            <p className="text-sm text-red-500">{allErrors.password[0]}</p>
          )}
        </div>

        {mode === 'register' && (
          <div className="space-y-1">
            <Input
              name="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              onChange={handleChange}
              className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
                allErrors.confirmPassword ? 'border-red-500 dark:border-red-500' : ''
              }`}
            />
            {allErrors.confirmPassword && (
              <p className="text-sm text-red-500">{allErrors.confirmPassword[0]}</p>
            )}
          </div>
        )}

        {mode === 'register' && otpSent && !isEmailVerified && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter verification code"
                className={`bg-white/50 dark:bg-gray-800/50 rounded-xl border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500/20 h-11 dark:text-white dark:placeholder-gray-400 ${
                  allErrors.otp ? 'border-red-500 dark:border-red-500' : ''
                }`}
              />
              {allErrors.otp && (
                <p className="text-sm text-red-500 dark:text-red-400">{allErrors.otp[0]}</p>
              )}
            </div>
            <div className="flex gap-4">
              <Button 
                type="button"
                className="flex-1 rounded-xl h-11 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white dark:text-gray-900 transition-colors duration-200" 
                onClick={handleVerifyOTP}
                disabled={isVerifying || !otp}
              >
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>
              <Button 
                type="button"
                variant="outline" 
                className="flex-1 rounded-xl h-11 border-primary-200 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/50 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors duration-200"
                onClick={handleSendOTP}
                disabled={isVerifying}
              >
                Resend Code
              </Button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full rounded-xl h-11 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white dark:text-gray-900 transition-colors duration-200"
          disabled={isLoading || (mode === 'register' && !isEmailVerified && otpSent)}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </span>
          ) : (
            mode === 'login' ? 'Sign in' : (
              otpSent && !isEmailVerified ? 'Verify Email' : 'Create account'
            )
          )}
        </Button>
      </motion.form>
    </div>
  );
};

export default AuthForm;