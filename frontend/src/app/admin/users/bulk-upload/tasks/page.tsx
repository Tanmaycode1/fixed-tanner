'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { AdminService } from '@/services/adminService';
import BulkRegistrationResults from '@/components/BulkRegistrationResults';
import Link from 'next/link';

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

export default function BulkUploadTasks() {
  const { apiKey } = useAdmin();
  const [tasks, setTasks] = useState<BulkUploadTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const adminService = new AdminService({ apiKey: apiKey! });
        const response = await adminService.getBulkUploadTasks();
        if (response.success && response.data) {
          setTasks(response.data.results);
        } else {
          setError(response.message || 'Failed to fetch tasks');
        }
      } catch (err) {
        setError('An error occurred while fetching tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [apiKey]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'deleted':
        return 'bg-gray-100 text-gray-800';
      case 'stopped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bulk Upload Tasks</h1>
          <Link 
            href="/admin/users/bulk-upload"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            New Upload
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-900">
                        {task.file_name || 'Unnamed Upload'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(task.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      <button
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {expandedTask === task.id ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        Users: {task.processed_users} / {task.total_users}
                      </p>
                    </div>
                    {task.errors && task.errors.length > 0 && (
                      <div className="mt-2 flex items-center text-sm text-red-500 sm:mt-0">
                        Contains Errors
                      </div>
                    )}
                  </div>
                  {expandedTask === task.id && (
                    <div className="mt-4">
                      <BulkRegistrationResults
                        taskId={task.id}
                        onClose={() => setExpandedTask(null)}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
} 