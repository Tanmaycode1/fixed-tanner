import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Typography, 
  Alert, 
  Pagination,
  Chip,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Grid
} from '@mui/material';
import { AdminService } from '@/services/adminService';
import { useSnackbar } from 'notistack';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAdmin } from '@/context/AdminContext';
import axios from 'axios';

// Updated interfaces to match the new API response structure
interface CreatedUser {
  id?: number;
  username: string;
  email: string;
  name: string;
  password?: string;
  status: string;
  created_at: string;
}

interface TaskData {
  id: number;
  file_name: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
}

interface ResultsData {
  task: TaskData;
  users: CreatedUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface BulkRegistrationResultsProps {
  taskId: string | number;
  onClose?: () => void;
}

const BulkRegistrationResults: React.FC<BulkRegistrationResultsProps> = ({ taskId, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultsData | null>(null);
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [users, setUsers] = useState<CreatedUser[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const { apiKey } = useAdmin();
  const adminService = new AdminService({ 
    apiKey: apiKey || ''
  });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const theme = useTheme();
  const POLLING_INTERVAL = 5000; // 5 seconds between polls

  // Direct API call to get users (without using the service layer that's causing issues)
  const fetchUsersDirectly = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      console.log(`Directly fetching users for task ${taskId}, page ${pageNum}...`);
      
      const response = await axios.get(
        `http://localhost:8000/api/admin-panel/bulk-upload/tasks/${taskId}/users/?page=${pageNum}&page_size=${pageSize}`,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          withCredentials: true
        }
      );
      
      console.log('Direct API response:', response.data);
      
      // Handle array response (as seen in your curl output)
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        
        // If we don't have task data yet, use what we know
        if (!taskData) {
          setTaskData({
            id: Number(taskId),
            file_name: 'Bulk Upload',
            status: 'COMPLETED',
            total_rows: response.data.length,
            processed_rows: response.data.length,
            created_at: response.data[0]?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            progress_percentage: 100
          });
        }
        
        // Format data for the component
        setData({
          task: taskData || {
            id: Number(taskId),
            file_name: 'Bulk Upload',
            status: 'COMPLETED',
            total_rows: response.data.length,
            processed_rows: response.data.length,
            created_at: response.data[0]?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            progress_percentage: 100
          },
          users: response.data,
          total: response.data.length,
          page: pageNum,
          page_size: pageSize,
          total_pages: Math.ceil(response.data.length / pageSize)
        });
        
        setIsCompleted(true);
        setIsProcessing(false);
        setIsWaiting(false);
      } 
      // Handle paginated response
      else if (response.data && typeof response.data === 'object') {
        const responseData = response.data;
        
        if (responseData.results) {
          setUsers(responseData.results);
          
          // Format data for the component
          setData({
            task: taskData || {
              id: Number(taskId),
              file_name: 'Bulk Upload',
              status: 'COMPLETED',
              total_rows: responseData.count || responseData.results.length,
              processed_rows: responseData.count || responseData.results.length,
              created_at: responseData.results[0]?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              progress_percentage: 100
            },
            users: responseData.results,
            total: responseData.count || responseData.results.length,
            page: pageNum,
            page_size: pageSize,
            total_pages: Math.ceil((responseData.count || responseData.results.length) / pageSize)
          });
          
          setIsCompleted(true);
          setIsProcessing(false);
          setIsWaiting(false);
        }
      }
    } catch (err: any) {
      console.error('Error directly fetching users:', err);
      
      // If we get a 404 or other error, the task might not be completed yet
      // Let's check the progress instead
      checkTaskProgress();
      
      if (!data && !taskData) {
        setError('Failed to fetch results. The task may still be processing.');
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, apiKey, pageSize, taskData, data]);

  // Check task progress (only used for processing/waiting tasks)
  const checkTaskProgress = useCallback(async () => {
    try {
      console.log(`Checking progress for task ${taskId}...`);
      
      const response = await axios.get(
        `http://localhost:8000/api/admin-panel/bulk-upload/tasks/${taskId}/progress/`,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          withCredentials: true
        }
      );
      
      console.log('Progress response:', response.data);
      
      if (response.data) {
        setTaskData(response.data);
        
        const status = (response.data.status || '').toLowerCase();
        setIsProcessing(status === 'processing');
        setIsWaiting(status === 'waiting');
        setIsCompleted(status === 'completed');
        
        // If completed, fetch the users
        if (status === 'completed') {
          fetchUsersDirectly(page);
          
          // Clear polling if it exists
          if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
          }
        } 
        // If still processing or waiting, continue polling
        else if (status === 'processing' || status === 'waiting') {
          // Set up polling
          if (pollingRef.current) {
            clearTimeout(pollingRef.current);
          }
          pollingRef.current = setTimeout(checkTaskProgress, POLLING_INTERVAL);
        }
      }
    } catch (err: any) {
      console.error('Error checking task progress:', err);
      
      // If we can't check progress and don't have data, show error
      if (!data && !taskData) {
        setError('Failed to check task progress.');
      }
      
      // Try again after polling interval
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      pollingRef.current = setTimeout(checkTaskProgress, POLLING_INTERVAL);
    }
  }, [taskId, apiKey, page, fetchUsersDirectly, data, taskData]);

  // Initial data loading
  useEffect(() => {
    // First try to fetch users directly (assuming task is completed)
    fetchUsersDirectly(page)
      .catch(() => {
        // If that fails, check the progress
        checkTaskProgress();
      });
    
    // Cleanup function
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [fetchUsersDirectly, checkTaskProgress, page]);

  // Handle page change
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  // Handle download
  const handleDownload = async () => {
    try {
      await adminService.downloadBulkRegisterResults(String(taskId));
      enqueueSnackbar('Download started', { variant: 'success' });
    } catch (err: any) {
      console.error('Error downloading results:', err);
      enqueueSnackbar('Error downloading results: ' + (err.message || 'Unknown error'), { variant: 'error' });
    }
  };

  // Handle delete users
  const handleDeleteUsers = async () => {
    if (!window.confirm('Are you sure you want to delete all users created in this bulk upload?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.deleteBulkTaskUsers(String(taskId));
      
      if (response.success) {
        enqueueSnackbar('Users deleted successfully', { variant: 'success' });
        if (onClose) onClose();
      } else {
        throw new Error(response.message || 'Failed to delete users');
      }
    } catch (err: any) {
      console.error('Error deleting users:', err);
      enqueueSnackbar('Error deleting users: ' + (err.message || 'Unknown error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle stop processing
  const handleStopProcessing = async () => {
    if (!window.confirm('Are you sure you want to stop processing this bulk upload?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.stopBulkTaskProcessing(String(taskId));
      
      if (response.success) {
        enqueueSnackbar('Processing stopped', { variant: 'success' });
        checkTaskProgress();
      } else {
        throw new Error(response.message || 'Failed to stop processing');
      }
    } catch (err: any) {
      console.error('Error stopping processing:', err);
      enqueueSnackbar('Error stopping processing: ' + (err.message || 'Unknown error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
  };

  // Get status chip
  const getStatusChip = (status: string | undefined) => {
    let color;
    let label = status || 'Unknown';
    
    switch ((status || '').toLowerCase()) {
      case 'created':
        color = theme.palette.success.main;
        label = 'Created';
        break;
      case 'existing':
        color = theme.palette.info.main;
        label = 'Already Exists';
        break;
      default:
        color = theme.palette.grey[500];
    }
    
    return (
      <Chip 
        label={label} 
        size="small"
        sx={{ 
          backgroundColor: alpha(color, 0.1),
          color: color,
          fontWeight: 'medium',
          '& .MuiChip-label': {
            px: 1
          }
        }}
      />
    );
  };

  // Loading state
  if (loading && !data && !taskData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={6}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error && !data && !taskData) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Upload Results
        </Typography>
        {onClose && (
          <Tooltip title="Close">
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Task Details */}
      {(taskData || (data && data.task)) && (
        <Box mb={4}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 3, 
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.03)
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight="medium">
              Task Details
            </Typography>
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  File Name
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {(taskData || data?.task)?.file_name || 'Unknown'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Box display="flex" alignItems="center" mt={0.5}>
                  <Chip 
                    label={(taskData || data?.task)?.status || 'Unknown'} 
                    size="small"
                    color={
                      isCompleted ? 'success' :
                      isProcessing ? 'info' :
                      isWaiting ? 'warning' :
                      'error'
                    }
                    variant="outlined"
                  />
          {isProcessing && (
                    <CircularProgress size={16} sx={{ ml: 1 }} />
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1">
                  {(taskData || data?.task)?.created_at ? 
                    new Date((taskData || data?.task)?.created_at || '').toLocaleString() : 
                    'Unknown'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body1">
                  {(taskData || data?.task)?.processed_rows || 0} / {(taskData || data?.task)?.total_rows || 0} users
                </Typography>
              </Grid>
            </Grid>
            
            {isProcessing && (
              <Box mt={2}>
                <LinearProgress 
                  variant="determinate" 
                  value={(taskData || data?.task)?.progress_percentage || 0} 
                  sx={{ 
                    height: 8, 
                    borderRadius: 1,
                    mt: 1
                  }} 
                />
                <Box display="flex" justifyContent="space-between" mt={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Processing users...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(taskData || data?.task)?.progress_percentage || 0}%
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Action Buttons */}
      <Box mb={3} display="flex" gap={2} flexWrap="wrap">
        <Button 
          variant="contained" 
          color="primary" 
            onClick={handleDownload}
          disabled={loading || isWaiting}
          startIcon={<DownloadIcon />}
          sx={{ borderRadius: 2 }}
        >
          Download Results
        </Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleDeleteUsers}
          disabled={loading || isWaiting}
          startIcon={<DeleteIcon />}
          sx={{ borderRadius: 2 }}
        >
          Delete Users
        </Button>
        {isProcessing && (
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleStopProcessing}
            disabled={loading}
            startIcon={<StopIcon />}
            sx={{ borderRadius: 2 }}
          >
            Stop Processing
          </Button>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* User Results Section */}
      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight="medium">
          User Results
        </Typography>
        {data?.total && (
          <Typography variant="body2" color="text.secondary">
            Total: {data.total} users
          </Typography>
        )}
      </Box>

      {/* Show users only if completed */}
      {isCompleted && users && users.length > 0 ? (
        <>
          <TableContainer 
            component={Paper} 
            elevation={1}
            sx={{ 
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Password</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getStatusChip(user.status)}</TableCell>
                    <TableCell>
                      {user.password ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              p: 0.5,
                              px: 1,
                              borderRadius: 1
                            }}
                          >
                            {user.password}
                          </Typography>
                          <Tooltip title="Copy password">
                            <IconButton 
                              size="small" 
                              onClick={() => copyToClipboard(user.password || '')}
                              sx={{ color: theme.palette.primary.main }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {data?.total_pages && data.total_pages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination 
                count={data.total_pages} 
                page={page} 
                onChange={handlePageChange} 
                color="primary" 
                shape="rounded"
                size="large"
              />
            </Box>
          )}
        </>
      ) : (
        <Alert 
          severity="info"
          sx={{ 
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%',
              textAlign: 'center'
            }
          }}
        >
          {isProcessing ? 'Processing users...' : 
           isWaiting ? 'Task is waiting to be processed...' : 
           'No users found for this task.'}
        </Alert>
      )}
    </Box>
  );
};

export default BulkRegistrationResults; 