"use client";

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Rewind,
  Forward,
  ListMusic,
  MoreHorizontal,
  Disc3
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import Image from "next/image";

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
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioUrl) return;

    const loadAudio = async () => {
      if (!audioRef.current) return;

      try {
        setIsLoaded(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

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
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!isLoaded || !audioRef.current) return;
    
    try {
      if (isPlaying) {
        await audioRef.current.pause();
      } else {
        if (audioRef.current.ended) {
          audioRef.current.currentTime = 0;
        }
        await audioRef.current.play();
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
      const audioDuration = audioRef.current.duration;
      
      if (isFinite(time) && isFinite(audioDuration)) {
        setCurrentTime(time);
        setDuration(audioDuration); // Update duration continuously
        
        if (onProgress) {
          onProgress(time / audioDuration);
        }

        // Check if we reached the end
        if (time >= audioDuration) {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration)) {
        setDuration(audioDuration);
        setIsLoaded(true);
        audioRef.current.preload = 'auto';
      }
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
    if (!isFinite(newTime)) return;
    
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      try {
        const clampedTime = Math.max(0, Math.min(newTime, audioRef.current.duration));
        audioRef.current.currentTime = clampedTime;
        setCurrentTime(clampedTime);
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
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
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
      className
    )}>
      {/* Cover image for audio */}
      {coverImage && (
        <div className="relative w-full aspect-video">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to a default music cover if image fails to load
              e.currentTarget.src = '/images/default-music-cover.jpg';
              e.currentTarget.onerror = null; // Prevent infinite loop
            }}
          />
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

        {/* Progress Bar */}
        <div className="mb-4 space-y-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
            >
              <Rewind className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={handlePlayPause}
              disabled={!isLoaded}
              className={cn(
                "h-10 w-10 rounded-xl",
                "bg-gradient-to-br from-violet-500 to-violet-600",
                "hover:from-violet-600 hover:to-violet-700",
                "text-white shadow-lg shadow-violet-500/25",
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
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ListMusic className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
          if (onEnded) onEnded();
        }}
        onError={(e: React.SyntheticEvent<HTMLAudioElement, Event>) => handleAudioError(e.nativeEvent)}
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
}