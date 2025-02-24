'use client';
import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Trash2, X, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioChange: (file: File) => void;
}

export const AudioRecorder = ({ onAudioChange }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const [recordingBars, setRecordingBars] = useState<number[]>(Array(40).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const updateVisualizer = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Create smoother animation
    const smoothData = Array.from(dataArray)
      .slice(0, 40)
      .map(value => value / 255)
      .map((value, i, arr) => {
        const prev = arr[i - 1] || value;
        const next = arr[i + 1] || value;
        return (prev + value + next) / 3;
      });
    
    setRecordingBars(smoothData);
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        } 
      });

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.7;
      source.connect(analyserRef.current);

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        onAudioChange(audioFile);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      updateVisualizer();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      cleanup();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioURL(url);
      onAudioChange(file);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const deleteRecording = () => {
    setAudioURL(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const percentage = x / bounds.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <AnimatePresence mode="wait">
        {!audioURL ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex justify-center gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="w-full bg-red-500 hover:bg-red-600 text-white relative overflow-hidden group"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                  <motion.div
                    className="absolute inset-0 bg-white/20"
                    initial={{ scale: 0, opacity: 0 }}
                    whileTap={{ scale: 2, opacity: 0.4 }}
                    transition={{ duration: 0.5 }}
                  />
                </Button>
              ) : (
                <div className="w-full flex gap-2">
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="flex-1 relative overflow-hidden"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    <span>{formatTime(recordingTime)}</span>
                    <motion.div
                      className="absolute bottom-0 left-0 h-0.5 bg-white"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ 
                        duration: 1, 
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  </Button>
                  <Button
                    onClick={() => {
                      cleanup();
                      setIsRecording(false);
                      setRecordingTime(0);
                    }}
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>

            {isRecording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-center gap-0.5 h-16">
                  {recordingBars.map((level, idx) => (
                    <motion.div
                      key={idx}
                      className="w-1 bg-red-500 rounded-full"
                      animate={{
                        height: `${Math.max(4, level * 64)}px`,
                        opacity: 1
                      }}
                      initial={{
                        height: "4px",
                        opacity: 0.5
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        mass: 0.5
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                id="audio-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('audio-upload')?.click()}
                className="w-full"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Audio
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
          >
            <audio
              ref={audioRef}
              src={audioURL}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="flex items-center gap-4">
              <motion.button
                onClick={togglePlayback}
                className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{
                    scale: isPlaying ? [1, 1.2, 1] : 1
                  }}
                  transition={{ repeat: isPlaying ? Infinity : 0, duration: 1 }}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </motion.div>
              </motion.button>

              <div className="flex-1">
                <div 
                  className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                  onClick={handleProgressBarClick}
                >
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-red-500"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                    transition={{ type: "tween" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <Button
                onClick={deleteRecording}
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 