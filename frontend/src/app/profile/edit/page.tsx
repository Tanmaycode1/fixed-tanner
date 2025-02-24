"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { userApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { 
  ArrowLeft, 
  Upload, 
  User, 
  Camera, 
  Loader2,
  Globe,
  Lock,
  X,
  Image as ImageIcon,
  ChevronLeft,
  Pencil,
  Link as LinkIcon,
  MapPin,
  Mail,
  Instagram,
  Twitter
} from 'lucide-react';
import Webcam from 'react-webcam';
import { z } from 'zod';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileFormData {
  first_name: string;
  last_name: string;
  bio: string;
  account_privacy: string;
  website: string;
  phone: string;
  location: string;
  birth_date: string;
  gender: string;
  occupation: string;
  company: string;
  education: string;
  social_links: {
    twitter: string;
    github: string;
    linkedin: string;
    website: string;
  };
}

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  birth_date: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  occupation: z.string().optional(),
  company: z.string().optional(),
  education: z.string().optional(),
  account_privacy: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  social_links: z.object({
    twitter: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().url().optional().or(z.literal(''))
  }).optional()
});

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  const [formData, setFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    bio: '',
    account_privacy: 'PUBLIC',
    website: '',
    phone: '',
    location: '',
    birth_date: '',
    gender: '',
    occupation: '',
    company: '',
    education: '',
    social_links: {
      twitter: '',
      github: '',
      linkedin: '',
      website: ''
    }
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userApi.getProfile();
      const { first_name, last_name, bio, account_privacy, avatar_url, website, phone, location, birth_date, gender, occupation, company, education, social_links } = response.data;
      setFormData({
        first_name,
        last_name,
        bio: bio || '',
        account_privacy,
        website,
        phone,
        location,
        birth_date,
        gender,
        occupation,
        company,
        education,
        social_links
      });
      setCurrentAvatar(avatar_url);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const WebcamComponent = () => {
    return (
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 1280,
          height: 720,
          facingMode: "user"
        }}
        className="w-full h-full object-cover"
        mirrored={true}
      />
    );
  };

  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setAvatarPreview(imageSrc);
        setShowAvatarModal(true);
        setShowCamera(false);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
      setShowAvatarModal(true);
    };
    reader.readAsDataURL(file);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Set width to desired size
    canvas.width = 400;
    canvas.height = 400;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      400,
      400
    );

    // As Base64 string
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Canvas is empty');
          }
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleAvatarUpload = async () => {
    try {
      if (!avatarPreview || !croppedAreaPixels) return;
      setSaving(true);

      const croppedImage = await getCroppedImg(avatarPreview, croppedAreaPixels);
      const file = new File([croppedImage], 'avatar.jpg', { type: 'image/jpeg' });
      
      await userApi.updateAvatar(file);
      
      // Convert blob to data URL for preview
      const reader = new FileReader();
      reader.readAsDataURL(croppedImage);
      reader.onloadend = () => {
        setCurrentAvatar(reader.result as string);
      };
      
      setShowAvatarModal(false);
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await userApi.updateProfile(formData);
      toast.success('Profile updated successfully');
      router.push('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropSize = Math.min(width, height) * 0.8; // 80% of the smaller dimension
    
    setCrop({
      x: (width - cropSize) / 2,
      y: (height - cropSize) / 2,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Edit Profile
              </h1>
            </div>
            <Button
              type="submit"
              form="profile-form"
              disabled={saving}
              variant="default"
              size="sm"
              className="rounded-full px-6 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 mb-16 sm:mb-0">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Avatar & Quick Links */}
          <div className="col-span-12 md:col-span-4 space-y-6">
            {/* Avatar Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col items-center text-center">
                {/* Avatar with hover overlay on desktop */}
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 ring-4 ring-white dark:ring-gray-800 shadow-lg">
                    {currentAvatar ? (
                      <img 
                        src={currentAvatar} 
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </div>

                  {/* Hover overlay - Only visible on desktop */}
                  <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 hidden sm:flex items-center justify-center">
                    <div className="flex gap-2 scale-90 group-hover:scale-100 transition-transform">
                      <Button
                        size="sm"
                        className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                        onClick={() => setShowCamera(true)}
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Mobile buttons - Hidden on desktop */}
                <div className="flex flex-col gap-2 mt-6 w-full sm:hidden">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full justify-center rounded-xl bg-gradient-to-r from-primary-500/10 to-primary-600/10 dark:from-primary-400/10 dark:to-primary-500/10 hover:from-primary-500/20 hover:to-primary-600/20 dark:hover:from-primary-400/20 dark:hover:to-primary-500/20 border-primary-500/20 dark:border-primary-400/20 text-primary-700 dark:text-primary-300"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setShowCamera(true)}
                    className="w-full justify-center rounded-xl bg-gradient-to-r from-primary-500/10 to-primary-600/10 dark:from-primary-400/10 dark:to-primary-500/10 hover:from-primary-500/20 hover:to-primary-600/20 dark:hover:from-primary-400/20 dark:hover:to-primary-500/20 border-primary-500/20 dark:border-primary-400/20 text-primary-700 dark:text-primary-300"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Recommended: Square image, at least 400x400px
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Change Email
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Password & Security
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Language & Region
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Main Form */}
          <div className="col-span-12 md:col-span-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <form id="profile-form" onSubmit={handleSubmit}>
                <div className="p-6 space-y-6">
                  {/* Basic Info Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-gray-700 dark:text-gray-300">
                          First Name
                        </Label>
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            first_name: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700 dark:text-gray-300">
                          Last Name
                        </Label>
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            last_name: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bio Section */}
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Bio
                    </Label>
                    <Textarea
                      value={formData.bio}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        bio: e.target.value
                      }))}
                      rows={4}
                      placeholder="Tell us about yourself..."
                      className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    />
                  </div>

                  {/* Social Links */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Social Links
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                        <Input
                          placeholder="Twitter username"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <Instagram className="w-5 h-5 text-[#E4405F]" />
                        <Input
                          placeholder="Instagram username"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Privacy Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Privacy Settings
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, account_privacy: 'PUBLIC' }))}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          formData.account_privacy === 'PUBLIC'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-500/50'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <Globe className={`w-6 h-6 mb-2 ${
                            formData.account_privacy === 'PUBLIC'
                              ? 'text-primary-500'
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                          <p className="font-medium text-gray-900 dark:text-white">Public Profile</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Anyone can view your profile</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, account_privacy: 'PRIVATE' }))}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          formData.account_privacy === 'PRIVATE'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-500/50'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <Lock className={`w-6 h-6 mb-2 ${
                            formData.account_privacy === 'PRIVATE'
                              ? 'text-primary-500'
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                          <p className="font-medium text-gray-900 dark:text-white">Private Profile</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Only followers can view your profile</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="phone" className="text-gray-700 dark:text-gray-300">
                          Phone
                        </label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            phone: e.target.value
                          }))}
                          type="tel"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                          placeholder="+1234567890"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Location
                        </label>
                        <Input
                          value={formData.location}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            location: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                          placeholder="City, Country"
                        />
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
                          value={formData.birth_date}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            birth_date: e.target.value
                          }))}
                          type="date"
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Gender
                        </label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            gender: value
                          }))}
                        >
                          <SelectTrigger className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700">
                            <SelectValue placeholder="Select gender" className="text-gray-500 dark:text-gray-400" />
                          </SelectTrigger>
                          <SelectContent 
                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            position="popper"
                            sideOffset={5}
                          >
                            <SelectGroup>
                              <SelectItem 
                                value="MALE" 
                                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Male
                              </SelectItem>
                              <SelectItem 
                                value="FEMALE" 
                                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Female
                              </SelectItem>
                              <SelectItem 
                                value="OTHER" 
                                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Other
                              </SelectItem>
                              <SelectItem 
                                value="PREFER_NOT_TO_SAY" 
                                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Prefer not to say
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
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
                          value={formData.occupation}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            occupation: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                          placeholder="Your current role"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Company
                        </label>
                        <Input
                          value={formData.company}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            company: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                          placeholder="Company name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Education
                        </label>
                        <Input
                          value={formData.education}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            education: e.target.value
                          }))}
                          className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 focus:ring-primary-500/20"
                          placeholder="Your highest education"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Take Photo
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCamera(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="relative aspect-square rounded-xl overflow-hidden bg-black mb-4">
                <WebcamComponent />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCamera(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={capturePhoto}
                >
                  Capture
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Preview/Crop Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Adjust Photo
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAvatarModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black mb-6">
                <Cropper
                  image={avatarPreview!}
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

              <div className="flex items-center gap-4 mb-6 px-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAvatarModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAvatarUpload}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Photo'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}