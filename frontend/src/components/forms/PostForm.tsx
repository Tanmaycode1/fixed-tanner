'use client';
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import ImageCropper from '@/components/shared/ImageCropper';
import CameraCapture from '@/components/shared/CameraCapture';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { PageHeader } from '@/components/layout/PageHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { postsApi } from '@/services/postsApi';
import { useAuth } from '@/hooks/useAuth';

const PostFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .min(1, 'Description is required')
    .max(5000, 'Description must be less than 5000 characters'),
});

interface PostFormProps {
  type: 'NEWS' | 'AUDIO';
}

interface CreatePostData {
  type: 'NEWS' | 'AUDIO';
  title: string;
  description: string;
  image?: File;
  audio_file?: File;
}

const PostForm = ({ type }: PostFormProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user: currentUser } = useAuth();

  const form = useForm<z.infer<typeof PostFormSchema>>({
    resolver: zodResolver(PostFormSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image size should be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
      setShowCropper(true);
    }
  };

  const handleCroppedImage = (croppedImage: Blob) => {
    setImageFile(new File([croppedImage], 'cropped_image.jpg', { type: 'image/jpeg' }));
    setPreviewImage(URL.createObjectURL(croppedImage));
    setShowCropper(false);
    setUploadError(null);
  };

  const handleCameraCapture = (imageSrc: string) => {
    fetch(imageSrc)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
        setImageFile(file);
        setShowCropper(true);
        setShowCamera(false);
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to process camera image",
          variant: "destructive",
        });
      });
  };

  const onSubmit = async (values: z.infer<typeof PostFormSchema>) => {
    try {
      setIsLoading(true);
      setUploadError(null);

      // Validation checks
      if (type === 'AUDIO' && !audioFile) {
        setUploadError('Audio file is required for audio posts');
        return;
      }

      if (type === 'AUDIO' && !imageFile) {
        setUploadError('Cover image is required for audio posts');
        return;
      }

      const formData = new FormData();
      formData.append('type', type);
      formData.append('title', values.title);
      formData.append('description', values.description);
      if (imageFile) formData.append('image', imageFile);
      if (audioFile) formData.append('audio_file', audioFile);

      const result = await postsApi.createPost(formData);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create post');
      }

      toast({
        title: "Success",
        description: "Post created successfully",
      });

      router.push(result.data.id ? `/posts/${result.data.id}` : '/');
      router.refresh();

    } catch (error: any) {
      console.error('Error creating post:', error);
      
      let errorMessage = 'Something went wrong';
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setUploadError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:w-64 fixed inset-y-0">
          <Sidebar currentUser={currentUser} />
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:pl-64">
          {/* Header */}
          <PageHeader title={`Create ${type === 'AUDIO' ? 'Audio' : 'News'} Post`} />
          
          {/* Form Content */}
          <div className="container max-w-2xl py-6 space-y-6 px-4 sm:px-6 lg:px-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {uploadError && (
                  <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-lg text-sm">
                    {uploadError}
                  </div>
                )}
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter post title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter post description" 
                          className="min-h-[150px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>{type === 'AUDIO' ? 'Cover Image (Required)' : 'Image (Optional)'}</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCamera(true)}
                      className="flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={imageInputRef}
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                  {previewImage && (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                      <Image
                        src={previewImage}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>

                {type === 'AUDIO' && (
                  <div className="space-y-4">
                    <FormLabel>Audio</FormLabel>
                    <AudioRecorder
                      onAudioChange={(file) => {
                        setAudioFile(file);
                      }}
                    />
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : 'Create Post'}
                </Button>
              </form>
            </Form>

            {/* Camera and Cropper modals remain same */}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <MobileNav />
        </div>
      </div>

      {/* Modals */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {showCropper && imageFile && (
        <ImageCropper
          image={URL.createObjectURL(imageFile)}
          onCrop={handleCroppedImage}
          onCancel={() => setShowCropper(false)}
          aspect={16/9}
        />
      )}
    </div>
  );
};

export default PostForm; 