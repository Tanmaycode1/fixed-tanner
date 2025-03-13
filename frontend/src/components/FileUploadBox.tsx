import React, { useState, useRef, useCallback } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

interface FileUploadBoxProps {
  onFileChange: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
  label?: string;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({
  onFileChange,
  accept = '*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  label = 'Drag and drop a file here, or click to select'
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const validateFile = useCallback((file: File): boolean => {
    // Check file size
    if (file.size > maxSize) {
      setError(`File size exceeds the maximum allowed size (${(maxSize / (1024 * 1024)).toFixed(1)} MB)`);
      return false;
    }

    // Check file type if accept is specified
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type;
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          // Check by extension
          return fileExtension === type.toLowerCase();
        } else if (type.includes('*')) {
          // Handle wildcards like image/*
          const [category] = type.split('/');
          return fileType.startsWith(`${category}/`);
        } else {
          // Exact match
          return fileType === type;
        }
      });

      if (!isAccepted) {
        setError(`File type not accepted. Please upload a file with the following format: ${accept}`);
        return false;
      }
    }

    setError(null);
    return true;
  }, [accept, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileChange(file);
      } else {
        onFileChange(null);
      }
    }
  }, [onFileChange, validateFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileChange(file);
      } else {
        onFileChange(null);
      }
    }
  }, [onFileChange, validateFile]);

  const handleClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    onFileChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileChange]);

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={accept}
        style={{ display: 'none' }}
      />
      
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          cursor: 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'primary.light',
            bgcolor: 'action.hover'
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {selectedFile ? (
          <Box display="flex" flexDirection="column" alignItems="center">
            <InsertDriveFileIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              {selectedFile.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </Typography>
            <Box mt={1}>
              <Typography
                variant="body2"
                color="primary"
                sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
              >
                Remove file
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center">
            <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1">{label}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Maximum file size: {(maxSize / (1024 * 1024)).toFixed(1)} MB
            </Typography>
          </Box>
        )}
      </Paper>
      
      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default FileUploadBox; 