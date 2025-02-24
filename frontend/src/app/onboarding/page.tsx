"use client";

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { userApi } from '@/services/api';
import { toast } from 'react-hot-toast';
import { Camera, X, Loader2, User } from 'lucide-react';
import Webcam from 'react-webcam';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { getCroppedImg } from '@/lib/imageUtils';

const onboardingSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  location: z.string().min(1, 'Location is required'),
  birth_date: z.string().min(1, 'Birth date is required'),
  website: z.string().url().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  company: z.string().optional(),
  education: z.string().min(1, 'Education is required'),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      gender: 'PREFER_NOT_TO_SAY',
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPreviewImage(imageSrc);
        setShowCropModal(true);
        setShowCamera(false);
      }
    }
  };

  const handleCrop = async () => {
    if (!previewImage || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(previewImage, croppedAreaPixels);
      const file = new File([croppedImage], 'avatar.jpg', { type: 'image/jpeg' });
      await userApi.updateAvatar(file);
      setShowCropModal(false);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error('Failed to update profile photo');
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsLoading(true);
    try {
      await userApi.updateProfile({
        phone: data.phone,
        location: data.location,
        birth_date: data.birth_date,
        website: data.website,
        gender: data.gender,
        bio: data.bio,
        occupation: data.occupation,
        company: data.company,
        education: data.education
      });
      
      toast.success('Profile setup completed!');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete profile setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary-50/30 to-white dark:from-gray-950 dark:via-primary-950/10 dark:to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Complete Your Profile
            </h1>
            <Button
              type="submit"
              form="onboarding-form"
              disabled={isLoading}
              className="rounded-full px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : 'Complete Setup'}
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 space-y-8"
        >
          <form id="onboarding-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Photo */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 ring-4 ring-white dark:ring-gray-800">
                  {previewImage ? (
                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCamera(true)}
                >
                  Take Photo
                </Button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <Input
                    {...register('phone')}
                    type="tel"
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="+1234567890"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <Input
                    {...register('location')}
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="City, Country"
                  />
                  {errors.location && (
                    <p className="mt-1 text-sm text-red-500">{errors.location.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Birth Date
                  </label>
                  <Input
                    {...register('birth_date')}
                    type="date"
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  />
                  {errors.birth_date && (
                    <p className="mt-1 text-sm text-red-500">{errors.birth_date.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    {...register('gender')}
                    className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 py-2 px-3"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    {...register('bio')}
                    rows={4}
                    className="w-full rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 py-2 px-3 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                  {errors.bio && (
                    <p className="mt-1 text-sm text-red-500">{errors.bio.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    {watch('bio')?.length || 0}/500 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <Input
                    {...register('website')}
                    type="url"
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="https://..."
                  />
                  {errors.website && (
                    <p className="mt-1 text-sm text-red-500">{errors.website.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Professional Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Occupation
                  </label>
                  <Input
                    {...register('occupation')}
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="Your current role"
                  />
                  {errors.occupation && (
                    <p className="mt-1 text-sm text-red-500">{errors.occupation.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  <Input
                    {...register('company')}
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="Company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Education
                  </label>
                  <Input
                    {...register('education')}
                    className="rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    placeholder="Your highest education"
                  />
                  {errors.education && (
                    <p className="mt-1 text-sm text-red-500">{errors.education.message}</p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg mx-auto mt-20 bg-white dark:bg-gray-800 rounded-xl overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-medium">Take Photo</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCamera(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="relative aspect-square">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full"
                />
              </div>
              <div className="p-4 flex justify-end">
                <Button onClick={capturePhoto}>Capture</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {showCropModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg mx-auto mt-20 bg-white dark:bg-gray-800 rounded-xl overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-medium">Adjust Photo</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCropModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="relative w-full aspect-square">
                <Cropper
                  image={previewImage || ''}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedAreaPixels) => {
                    setCroppedAreaPixels(croppedAreaPixels);
                  }}
                  cropShape="round"
                  showGrid={false}
                />
              </div>

              <div className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCropModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCrop}>Save Photo</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 