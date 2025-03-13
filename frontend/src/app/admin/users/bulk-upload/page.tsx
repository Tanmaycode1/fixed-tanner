'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Container, 
  Divider, 
  Grid, 
  Paper, 
  Typography, 
  Alert, 
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import { AdminService } from '@/services/adminService';
import { useSnackbar } from 'notistack';
import FileUploadBox from '@/components/FileUploadBox';
import BulkRegistrationResults from '@/components/BulkRegistrationResults';
import { AdminApiConfig } from '@/services/adminService';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAdmin } from '@/context/AdminContext';

// Updated interface to match the new API response structure
interface BulkUploadTask {
  id: number;
  file_name: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
}

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<BulkUploadTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const { apiKey } = useAdmin();
  
  // Initialize AdminService with the API key from context
  const adminService = new AdminService({ 
    apiKey: apiKey || ''
  });

  const fetchTasks = useCallback(async (showRefreshIndicator = true) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await adminService.getBulkUploadTasks();
      
      if (response.success && response.data) {
        // Ensure we have an array of tasks
        const taskResults = response.data.results || [];
        setTasks(taskResults);
      } else {
        console.error('Failed to fetch tasks:', response.message);
        setTasks([]);
        if (response.message) {
          enqueueSnackbar(`Failed to fetch tasks: ${response.message}`, { variant: 'error' });
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
      enqueueSnackbar('Error fetching tasks. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminService, enqueueSnackbar]);

  useEffect(() => {
    fetchTasks(false);
    
    // Set up polling to refresh tasks only when there are processing tasks
    // and limit the polling frequency to reduce unnecessary requests
    let interval: NodeJS.Timeout | null = null;
    
    if (tasks.some(task => ['processing', 'waiting'].includes(task.status.toLowerCase()))) {
      interval = setInterval(() => {
        fetchTasks(false);
      }, 10000); // Poll every 10 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchTasks, tasks]);

  const handleFileChange = (file: File | null) => {
    setFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          // Extract base64 content (remove data:application/csv;base64, prefix)
          const base64Content = reader.result?.toString().split(',')[1];
          
          if (!base64Content) {
            throw new Error('Failed to read file content');
          }

          // Upload the file
          const response = await adminService.bulkRegisterUsers(base64Content, file.name);
          
          if (response.success && response.data) {
            enqueueSnackbar('File uploaded successfully', { variant: 'success' });
            setCurrentTaskId(response.data.id);
            setShowResults(true);
            fetchTasks(); // Refresh task list
            setFile(null); // Reset file selection
          } else {
            throw new Error(response.message || 'Upload failed');
          }
        } catch (error: any) {
          console.error('Upload error:', error);
          setUploadError(error.message || 'Failed to upload file');
          enqueueSnackbar('Upload failed: ' + (error.message || 'Unknown error'), { variant: 'error' });
        } finally {
          setUploading(false);
        }
      };
      
      reader.onerror = () => {
        setUploadError('Failed to read file');
        setUploading(false);
        enqueueSnackbar('Failed to read file', { variant: 'error' });
      };
    } catch (error: any) {
      console.error('File reading error:', error);
      setUploadError(error.message || 'Failed to process file');
      setUploading(false);
      enqueueSnackbar('File processing failed: ' + (error.message || 'Unknown error'), { variant: 'error' });
    }
  };

  const handleViewResults = (taskId: number) => {
    setCurrentTaskId(taskId);
    setShowResults(true);
  };

  const handleCloseResults = () => {
    setShowResults(false);
    fetchTasks(); // Refresh task list after closing results
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'completed':
        return theme.palette.success;
      case 'processing':
        return theme.palette.info;
      case 'waiting':
        return theme.palette.warning;
      case 'failed':
        return theme.palette.error;
      default:
        return {
          main: theme.palette.text.secondary
        };
    }
  };

  const getStatusChip = (status: string) => {
    const statusLower = status.toLowerCase();
    const color = getStatusColor(status);
    
    return (
      <Chip 
        label={status} 
        size="small"
        sx={{ 
          backgroundColor: alpha(color.main, 0.1),
          color: color.main,
          fontWeight: 'medium',
          '& .MuiChip-label': {
            px: 1
          }
        }}
        icon={
          statusLower === 'processing' || statusLower === 'waiting' ? 
            <CircularProgress size={12} color="inherit" sx={{ ml: 1 }} /> : 
            undefined
        }
      />
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else {
      return date.toLocaleString();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1" fontWeight="bold">
          Bulk User Registration
        </Typography>
        <Tooltip title="Refresh tasks">
          <IconButton 
            onClick={() => fetchTasks()} 
            disabled={refreshing}
            color="primary"
          >
            {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      
      {showResults && currentTaskId ? (
        <Box mb={4}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2,
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <BulkRegistrationResults 
              taskId={currentTaskId} 
              onClose={handleCloseResults} 
            />
          </Paper>
        </Box>
      ) : (
        <Grid container spacing={4}>
          <Grid item xs={12} md={5}>
            <Card 
              elevation={3} 
              sx={{ 
                height: '100%',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box 
                sx={{ 
                  p: 2, 
                  bgcolor: 'primary.main', 
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <CloudUploadIcon />
                <Typography variant="h6" fontWeight="medium">
                  Upload New CSV File
                </Typography>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Box mb={3} p={2} bgcolor="grey.50" borderRadius={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoOutlinedIcon fontSize="small" color="info" />
                    Upload a CSV file with user data. The file should include columns for name, username, and email.
                  </Typography>
                </Box>
                
                <FileUploadBox 
                  onFileChange={handleFileChange} 
                accept=".csv"
                  maxSize={5 * 1024 * 1024} // 5MB
                  label="Drag and drop a CSV file here, or click to select"
                />
                
                {uploadError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {uploadError}
                  </Alert>
                )}
                
                <Box mt={3} display="flex" justifyContent="flex-end">
                  <Button 
                    variant="contained" 
                    color="primary" 
              onClick={handleUpload}
                    disabled={!file || uploading}
                    startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                    size="large"
                    sx={{ 
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      boxShadow: 2
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Upload CSV'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={7}>
            <Card 
              elevation={3} 
              sx={{ 
                height: '100%',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box 
                sx={{ 
                  p: 2, 
                  bgcolor: 'primary.main', 
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <AccessTimeIcon />
                <Typography variant="h6" fontWeight="medium">
                  Recent Uploads
                </Typography>
              </Box>
              
              <CardContent sx={{ p: 0 }}>
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" p={6}>
                    <CircularProgress />
                  </Box>
                ) : tasks.length > 0 ? (
                  <Box>
                    {tasks.map((task, index) => (
                      <React.Fragment key={task.id}>
                        {index > 0 && <Divider />}
                        <Box 
                          p={3} 
                          sx={{
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {task.file_name}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                <Typography variant="body2" color="text.secondary">
                                  {formatDate(task.created_at)}
                                </Typography>
                                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {task.processed_rows} / {task.total_rows} users
                                </Typography>
                              </Box>
                              <Box mt={1}>
                                {getStatusChip(task.status)}
                              </Box>
                            </Box>
                            <Button 
                              variant="outlined" 
                              size="small"
                              onClick={() => handleViewResults(task.id)}
                              startIcon={<VisibilityIcon />}
                              sx={{ 
                                borderRadius: 2,
                                minWidth: 120
                              }}
                            >
                              View Results
                            </Button>
                          </Box>
                          
                          {['processing', 'waiting'].includes(task.status.toLowerCase()) && (
                            <Box mt={2}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Typography variant="body2" color="text.secondary">
                                  Progress
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {task.progress_percentage}%
                                </Typography>
                              </Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={task.progress_percentage} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 1,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1)
                                }} 
                              />
                            </Box>
                          )}
                        </Box>
                      </React.Fragment>
                    ))}
                  </Box>
                ) : (
                  <Box p={4} display="flex" justifyContent="center" alignItems="center">
                    <Alert 
                      severity="info" 
                      sx={{ 
                        width: '100%',
                        '& .MuiAlert-message': {
                          width: '100%',
                          textAlign: 'center'
                        }
                      }}
                    >
                      No upload tasks found. Upload a CSV file to get started.
                    </Alert>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
} 