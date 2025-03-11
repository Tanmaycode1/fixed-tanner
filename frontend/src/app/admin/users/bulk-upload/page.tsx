'use client';

import { useState, useEffect } from 'react';
import { useAdminService } from '@/hooks/useAdminService';
import BulkRegistrationResults from '@/components/BulkRegistrationResults';

interface UploadProgress {
  status: string;
  progress: number;
  total: number;
  processed: number;
}

interface BulkUploadTask {
  id: string;
  status: string;
  created_at: string;
  total_users: number;
  processed_users: number;
  file_name: string;
  errors: string[];
  created_by: any;
  updated_at: string;
}

export default function BulkUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [tasks, setTasks] = useState<BulkUploadTask[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const adminService = useAdminService();

  const fetchTasks = async () => {
    try {
      const response = await adminService.getBulkUploadTasks();
      if (response.success && response.data) {
        setTasks(response.data.results);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploadStatus('uploading');
    setError(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          
          // Upload file and get task ID immediately
          const response = await adminService.bulkRegisterUsers(base64, selectedFile.name);
          
          if (response.success && response.data) {
            setUploadStatus('success');
            setSelectedFile(null);
            
            // Reset file input
            const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
            if (fileInput) {
              fileInput.value = '';
            }
            
            // Add the new task to the list immediately
            const newTask: BulkUploadTask = {
              id: response.data.task_id,
              status: 'PROCESSING',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              total_users: 0,
              processed_users: 0,
              file_name: selectedFile.name,
              errors: [],
              created_by: null
            };
            
            setTasks(prevTasks => [newTask, ...prevTasks]);
            
            // Expand the new task to show progress
            setExpandedTaskId(response.data.task_id);
            
            // Refresh task list after a short delay
            setTimeout(() => {
              fetchTasks();
            }, 2000);
          } else {
            setUploadStatus('error');
            setError(response.message || 'Failed to upload file');
          }
        } catch (error) {
          console.error('Upload error:', error);
          setUploadStatus('error');
          setError('Failed to upload file. Please try again.');
        }
      };
      
      reader.onerror = () => {
        setUploadStatus('error');
        setError('Failed to read file. Please try again.');
      };
      
      // Start reading the file
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setError('Failed to upload file. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'deleted': return 'bg-gray-100 text-gray-800';
      case 'stopped': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleStopProcessing = async (taskId: string) => {
    try {
      const response = await adminService.stopBulkTaskProcessing(taskId);
      if (response.success) {
        // Update the task status in the list
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, status: 'STOPPED', errors: [...(task.errors || []), 'Processing stopped manually'] }
              : task
          )
        );
      } else {
        setError(response.message || 'Failed to stop processing');
      }
    } catch (error) {
      setError('Error stopping task processing');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Bulk Upload Users</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-1 block w-full"
                disabled={uploadStatus !== 'idle'}
              />
              <p className="mt-1 text-sm text-gray-500">
                CSV must contain: name, email, username columns
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadStatus !== 'idle'}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : 
               uploadStatus === 'processing' ? 'Processing...' : 'Upload'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Upload History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div key={task.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{task.file_name || 'Unnamed Upload'}</h4>
                    <p className="text-sm text-gray-500">{formatDate(task.created_at)}</p>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.errors && task.errors.length > 0 && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                          Has Errors
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    {task.status.toLowerCase() === 'processing' && (
                      <button
                        onClick={() => handleStopProcessing(task.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Stop Processing
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (task.status.toLowerCase() === 'completed') {
                          try {
                            await adminService.downloadBulkRegisterResults(task.id);
                          } catch (error) {
                            setError('Error downloading results');
                          }
                        }
                      }}
                      disabled={task.status.toLowerCase() !== 'completed'}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {expandedTaskId === task.id ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>
                
                {expandedTaskId === task.id && (
                  <div className="mt-4">
                    <BulkRegistrationResults
                      taskId={task.id}
                      onDelete={() => {
                        fetchTasks();
                        setExpandedTaskId(null);
                      }}
                      onClose={() => setExpandedTaskId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 