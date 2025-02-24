"use client";

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Webcam from 'react-webcam';

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
  onClose: () => void;
}

const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [error, setError] = useState<string | null>(null);

  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        onCapture(imageSrc);
      }
    }
  };

  return (
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
            onClick={onClose}
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
            mirrored={true}
            onUserMediaError={(error) => {
              setError('Failed to access camera');
              console.error('Webcam error:', error);
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={capturePhoto}
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default CameraCapture; 