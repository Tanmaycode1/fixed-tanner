import React, { useState, useEffect } from 'react';
import { useAdminService } from '@/hooks/useAdminService';

interface BulkRegistrationResultsProps {
  taskId: string;
  onDelete?: () => void;
  onClose?: () => void;
}

interface CreatedUser {
  email: string;
  username: string;
  password: string;
  name?: string;
}

interface TaskData {
  id: string;
  status: string;
  total_users: number;
  processed_users: number;
  errors: string[];
  file_name: string;
  created_at: string;
  updated_at: string;
  created_by: any;
}

interface ResultsData {
  task: TaskData;
  users: CreatedUser[];
  progress: number;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function BulkRegistrationResults({ taskId, onDelete, onClose }: BulkRegistrationResultsProps) {
  const [results, setResults] = useState<ResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const adminService = useAdminService();

  const fetchUsers = async () => {
    try {
      const response = await adminService.getBulkTaskUsers(taskId, currentPage, pageSize);
      if (response.success && response.data) {
        setResults(response.data);
        // If still processing, continue polling
        if (response.data.task.status.toLowerCase() === 'processing') {
          // Set polling interval if not already set
          if (!pollingInterval) {
            const interval = setInterval(fetchUsers, 2000);
            setPollingInterval(interval);
          }
        } else {
          // Clear polling interval if task is no longer processing
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      } else {
        setError(response.message || 'Failed to fetch results');
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (error) {
      setError('Error fetching results');
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Cleanup function to clear interval when component unmounts
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [taskId, currentPage, pageSize]);

  const handleDownload = async () => {
    try {
      await adminService.downloadBulkRegisterResults(taskId);
    } catch (error) {
      setError('Error downloading results');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all users from this bulk upload? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await adminService.deleteBulkTaskUsers(taskId);
      if (response.success) {
        onDelete?.();
      } else {
        setError(response.message || 'Failed to delete users');
      }
    } catch (error) {
      setError('Error deleting users');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStopProcessing = async () => {
    if (!confirm('Are you sure you want to stop processing this bulk upload?')) {
      return;
    }

    setIsStopping(true);
    try {
      const response = await adminService.stopBulkTaskProcessing(taskId);
      if (response.success) {
        // Refresh data
        fetchUsers();
      } else {
        setError(response.message || 'Failed to stop processing');
      }
    } catch (error) {
      setError('Error stopping processing');
    } finally {
      setIsStopping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const task = results.task;
  const progress = results.progress;
  const isProcessing = task.status.toLowerCase() === 'processing';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Upload Results</h3>
          <p className="text-sm text-gray-500">
            Total Users: {results.total} | Page {results.page} of {results.total_pages}
          </p>
          {isProcessing && (
            <div className="mt-2">
              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mr-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-500">
                  {task.processed_users} / {task.total_users} ({progress}%)
                </span>
              </div>
              <p className="text-sm text-blue-600 mt-1">Processing users...</p>
            </div>
          )}
          {task.status.toLowerCase() === 'stopped' && (
            <p className="text-sm text-yellow-600 mt-1">Processing was stopped manually.</p>
          )}
        </div>
        <div className="space-x-2">
          {isProcessing && (
            <button
              onClick={handleStopProcessing}
              disabled={isStopping}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {isStopping ? 'Stopping...' : 'Stop Processing'}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Download CSV
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete All Users'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {task.errors && task.errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Warnings/Errors:</p>
          <ul className="list-disc list-inside">
            {task.errors.map((error, index) => (
              <li key={index} className="text-sm">{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Password
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.users.map((user, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <code className="bg-gray-100 px-2 py-1 rounded">{user.password}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center">
          <label className="mr-2 text-sm text-gray-700">Users per page:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border-gray-300 text-sm"
          >
            {[10, 25, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= results.total_pages}
            className="ml-3 relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
} 