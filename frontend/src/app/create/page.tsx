"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { 
  ArrowLeft, 
  Camera,
  Mic,
  Upload,
  X,
  Music,
  Newspaper,
  Loader2,
  StopCircle,
  Trash,
  Image as ImageIcon,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AudioPlayer } from '@/components/AudioPlayer';
import { postsApi } from '@/services/postsApi';
import { cn } from '@/lib/utils';
import Webcam from 'react-webcam';

export default function CreatePostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webcamRef = useRef<Webcam>(null);
  
  const [postType, setPostType] = useState<'NEWS' | 'AUDIO' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setShowCropper(true);
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

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = 800;
    canvas.height = 800;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      800,
      800
    );

    return new Promise((resolve) => {
      canvas.toBlob(blob => {
        if (!blob) throw new Error('Canvas is empty');
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCropComplete = async () => {
    try {
      if (!imagePreview || !croppedAreaPixels) return;
      
      const croppedImage = await getCroppedImg(imagePreview, croppedAreaPixels);
      const file = new File([croppedImage], 'cover_image.jpg', { type: 'image/jpeg' });
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(croppedImage);
      
      setShowCropper(false);
    } catch (error) {
      console.error('Error cropping image:', error);
      toast.error('Failed to crop image');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'recorded_audio.webm', { 
          type: 'audio/webm',
          lastModified: Date.now()
        });
        setAudioFile(file);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      toast.success('Recording stopped');
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select a valid audio file');
      return;
    }

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  const discardAudio = () => {
    setAudioFile(null);
    setAudioUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);

      if (!title.trim()) {
        toast.error('Title is required');
        return;
      }

      if (!postType) {
        toast.error('Post type is required');
        return;
      }

      if (postType === 'AUDIO' && !audioFile) {
        toast.error('Audio file is required for audio posts');
        return;
      }

      const formData = new FormData();
      formData.append('type', postType);
      formData.append('title', title.trim());
      
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (postType === 'AUDIO' && audioFile) {
        formData.append('audio_file', audioFile);
      }

      const response = await postsApi.createPost(formData);

      if (response.success && response.data) {
        toast.success('Post created successfully');
        router.push('/dashboard');
      } else {
        toast.error(response.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Create post error:', error);
      toast.error('Failed to create post');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // JSX for the type selection screen
  if (!postType) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-16">
          <h1 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Create New Post
          </h1>
          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPostType('NEWS')}
              className="w-full p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex flex-col items-center">
                <Newspaper className="w-8 h-8 text-blue-500 mb-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">News Post</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Share updates or announcements</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPostType('AUDIO')}
              className="w-full p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex flex-col items-center">
                <Music className="w-8 h-8 text-blue-500 mb-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audio Post</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Share audio or music</p>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Create {postType} Post
              </h1>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : 'Create Post'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title"
                className="mt-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter post description"
                rows={4}
                className="mt-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Cover Image {postType === 'AUDIO' && '(Required)'}
            </Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="h-8 w-8 bg-red-500/80 hover:bg-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCamera(true)}
                    className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Audio Section */}
          {postType === 'AUDIO' && (
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Audio File</Label>
              <div className="mt-2 space-y-4">
                {audioFile ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <AudioPlayer
                      audioUrl={audioUrl || ''}
                      coverImage={imagePreview}
                      title={title || 'New Audio Post'}
                    />
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={discardAudio}
                        className="flex items-center"
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Discard Audio
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => audioInputRef.current?.click()}
                        className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Audio
                      </Button>
                      <Button
                        variant={isRecording ? "destructive" : "outline"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn(
                          "bg-white dark:bg-gray-900",
                          !isRecording && "border-gray-200 dark:border-gray-700"
                        )}
                      >
                        {isRecording ? (
                          <>
                            <StopCircle className="w-4 h-4 mr-2" />
                            Stop Recording ({formatTime(recordingTime)})
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4 mr-2" />
                            Record Audio
                          </>
                        )}
                      </Button>
                    </div>
                    {isRecording && (
                      <div className="flex items-center justify-center p-8">
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"
                        >
                          <motion.div
                            animate={{
                              scale: [1, 1.1, 1],
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            className="w-8 h-8 rounded-full bg-red-500"
                          />
                        </motion.div>
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
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
              
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-4">
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
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCamera(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (webcamRef.current) {
                      const imageSrc = webcamRef.current.getScreenshot();
                      if (imageSrc) {
                        setImagePreview(imageSrc);
                        setShowCamera(false);
                        setShowCropper(true);
                      }
                    }
                  }}
                >
                  Capture
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {showCropper && imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Adjust Image
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCropper(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black mb-6">
                <Cropper
                  image={imagePreview}
                  crop={crop}
                  zoom={zoom}
                  aspect={16/9}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedAreaPixels) => {
                    setCroppedAreaPixels(croppedAreaPixels);
                  }}
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
                  onClick={() => setShowCropper(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCropComplete}>
                  Apply
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}