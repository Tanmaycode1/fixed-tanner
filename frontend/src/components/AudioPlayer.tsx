"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Rewind,
  Forward,
  ListMusic,
  MoreHorizontal,
  Lock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { default as NextImage } from 'next/image';


interface AudioPlayerProps {
  audioUrl: string;
  coverImage: string | null | undefined;
  title: string;
  artist?: string;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  className?: string;
  post?: any;
}

// Maximum playback time in seconds (1 minute)
const MAX_PLAYBACK_TIME = 60;

export function AudioPlayer({
  audioUrl,
  coverImage,
  title,
  artist,
  onProgress,
  onEnded,
  className,
  post
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(MAX_PLAYBACK_TIME);
  const [isPremiumLimited, setIsPremiumLimited] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Use useCallback for functions that use refs
  const play = useCallback(async () => {
    if (audioRef.current && !isPremiumLimited) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  }, [isPremiumLimited]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Start the countdown timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          // Time's up - handle premium limit
          if (timerRef.current) clearInterval(timerRef.current);
          setIsPremiumLimited(true);
          pause();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [pause]);

  // Stop the countdown timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Effect to handle volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Effect to load audio when URL changes
  useEffect(() => {
    if (!audioUrl) return;

    const loadAudio = async () => {
      if (!audioRef.current) return;

      try {
        setIsLoaded(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setTimeRemaining(MAX_PLAYBACK_TIME);
        setIsPremiumLimited(false);
        setDuration(MAX_PLAYBACK_TIME); // Always set duration to 1 minute

        audioRef.current.src = audioUrl;
        audioRef.current.load();
        
        // Wait for metadata to load
        await new Promise((resolve) => {
          audioRef.current!.addEventListener('loadedmetadata', resolve, { once: true });
        });

        setIsLoaded(true);
      } catch (error) {
        console.error('Audio loading error:', error);
        toast.error('Failed to load audio');
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      stopTimer();
    };
  }, [audioUrl, stopTimer]);

  // Effect to clean up animation frame
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopTimer();
    };
  }, [stopTimer]);

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!isLoaded || !audioRef.current || isPremiumLimited) return;
    
    try {
      if (isPlaying) {
        await audioRef.current.pause();
        stopTimer();
      } else {
        if (audioRef.current.ended) {
          audioRef.current.currentTime = 0;
        }
        await audioRef.current.play();
        startTimer();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Audio playback error:', error);
      toast.error('Failed to play audio');
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      
      // Check if we've reached the premium limit
      if (time >= MAX_PLAYBACK_TIME && !isPremiumLimited) {
        setIsPremiumLimited(true);
        pause();
        stopTimer();
        setTimeRemaining(0);
        
        // Notify about premium limit
        if (onEnded) onEnded();
      }
      
      // Update current time (capped at MAX_PLAYBACK_TIME)
      const cappedTime = Math.min(time, MAX_PLAYBACK_TIME);
      setCurrentTime(cappedTime);
      
      // Call progress callback
      if (onProgress) {
        onProgress(cappedTime / MAX_PLAYBACK_TIME);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      // Always set display duration to 1 minute
      setDuration(MAX_PLAYBACK_TIME);
      setIsLoaded(true);
      audioRef.current.preload = 'auto';
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleProgressChange = (value: number[]) => {
    const newTime = value[0];
    if (!isFinite(newTime) || isPremiumLimited) return;
    
    if (audioRef.current) {
      try {
        // Clamp to MAX_PLAYBACK_TIME
        const clampedTime = Math.max(0, Math.min(newTime, MAX_PLAYBACK_TIME));
        audioRef.current.currentTime = clampedTime;
        setCurrentTime(clampedTime);
        
        // Update time remaining
        setTimeRemaining(MAX_PLAYBACK_TIME - clampedTime);
      } catch (error) {
        console.error('Error setting audio time:', error);
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current && !isPremiumLimited) {
      const newTime = audioRef.current.currentTime + seconds;
      const clampedTime = Math.max(0, Math.min(newTime, MAX_PLAYBACK_TIME));
      audioRef.current.currentTime = clampedTime;
      setTimeRemaining(MAX_PLAYBACK_TIME - clampedTime);
    }
  };

  // Add this for better error handling
  const handleAudioError = (e: Event) => {
    const target = e.target as HTMLAudioElement;
    console.error('Audio error:', {
      src: target.src,
      error: target.error
    });
    setIsLoaded(false);
    toast.error('Failed to load audio');
  };

  return (
    <div className={cn(
      "w-full rounded-xl overflow-hidden",
      "bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-800",
      "border border-slate-200 dark:border-slate-700/50",
      "shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20",
      "relative",
      className
    )}>
      {/* Premium limit overlay */}
      {isPremiumLimited && (
        <div className="absolute inset-0 bg-blue-900/80 z-20 flex flex-col items-center justify-center rounded-xl text-white p-6">
          <Lock className="h-10 w-10 mb-3 text-blue-300" />
          <h3 className="font-bold text-xl text-center text-blue-100">Premium Content</h3>
          <p className="text-center text-sm mt-2 mb-4 text-blue-200">
            You've reached the 1-minute free preview limit. Upgrade to continue listening.
          </p>
          <Button 
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
            onClick={() => toast.success('Upgrade feature coming soon!')}
          >
            Upgrade to Premium
          </Button>
        </div>
      )}

      {/* Cover image for audio */}
      {coverImage && (
        <div className="relative w-full aspect-video">
          <div className="relative w-full h-full">
            <NextImage
              src={coverImage}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={() => {
                // Handle error through onError prop instead of DOM event
                const fallbackImage = '/images/default-music-cover.jpg';
                if (coverImage !== fallbackImage) {
                  // Update coverImage state in parent or handle differently
                  console.error('Image failed to load, using fallback');
                }
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        </div>
      )}

      {/* Audio Controls */}
      <div className="p-4">
        {/* Title & Artist */}
        <div className="mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
            {title || 'Now Playing'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {artist || (post?.author?.username ? `@${post.author.username}` : 'Unknown Artist')}
          </p>
        </div>

        {/* Timer Display */}
        <div className="mb-2 flex justify-end">
          <span className="text-xs font-mono px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
            {formatTime(timeRemaining)} remaining
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 space-y-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={MAX_PLAYBACK_TIME} // Always set max to 1 minute
            step={0.1}
            onValueChange={handleProgressChange}
            className={cn(
              "cursor-pointer",
              isPremiumLimited && "opacity-50 cursor-not-allowed"
            )}
            disabled={isPremiumLimited}
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(MAX_PLAYBACK_TIME)}</span> {/* Always show 1 minute as max duration */}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-10)}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              disabled={isPremiumLimited}
            >
              <Rewind className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={handlePlayPause}
              disabled={!isLoaded || isPremiumLimited}
              className={cn(
                "h-10 w-10 rounded-xl",
                "bg-gradient-to-br from-blue-500 to-blue-600",
                "hover:from-blue-600 hover:to-blue-700",
                "text-white shadow-lg shadow-blue-500/25",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(10)}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              disabled={isPremiumLimited}
            >
              <Forward className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              disabled={isPremiumLimited}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            
            <div className="w-20">
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
                disabled={isPremiumLimited}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              disabled={isPremiumLimited}
            >
              <ListMusic className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              disabled={isPremiumLimited}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          stopTimer();
          if (onEnded) onEnded();
        }}
        onError={(e: React.SyntheticEvent<HTMLAudioElement, Event>) => handleAudioError(e.nativeEvent)}
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
}