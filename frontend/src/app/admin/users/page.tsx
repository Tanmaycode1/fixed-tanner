'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { AdminService } from '@/services/adminService';
import Link from 'next/link';
import { useAdminService } from '@/hooks/useAdminService';
import { User, PaginatedResponse } from '@/services/adminService';
import { FiSearch, FiFilter, FiTrash2, FiEdit2, FiX, FiCheck, FiUpload } from 'react-icons/fi';
import debounce from 'lodash/debounce';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default function UserManagement() {
  const { apiKey } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const adminService = useAdminService();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'staff' | 'superuser'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchUsers = async (page: number = currentPage) => {
    if (!apiKey) {
      setError('API key is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // If there's a search query, use the search endpoint
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        const response = await adminService.search(searchQuery, 'users');
        if (response.success && response.data) {
          // Directly set the users array with search results
          setUsers(response.data.users);
          setTotalCount(response.data.users.length);
        } else {
          setError(response.message || 'Failed to search users');
          // Don't clear users if search fails
          if (!users.length) {
            setUsers([]);
            setTotalCount(0);
          }
        }
      } else {
        // Otherwise use the regular user list endpoint
        setIsSearching(false);
        const response = await adminService.getUserList(page, pageSize);
        if (response.success && response.data) {
          const paginatedData = response.data as PaginatedResponse<User>;
          setUsers(paginatedData.results);
          setTotalCount(paginatedData.count);
        } else {
          setError(response.message || 'Failed to fetch users');
        }
      }
    } catch (err) {
      setError('An error occurred while fetching users');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(() => {
      fetchUsers(1);
    }, 500),
    [searchQuery]
  );

  useEffect(() => {
    debouncedSearch();
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (!isSearching) {
      fetchUsers();
    }
  }, [currentPage, pageSize, filterRole, filterStatus]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await adminService.deleteUser(userToDelete);
      if (response.success) {
        setUsers(users.filter(user => user.id !== userToDelete));
        setShowDeleteConfirmation(false);
        setUserToDelete(null);
      } else {
        setError(response.message || 'Failed to delete user');
      }
    } catch (error) {
      setError('Error deleting user');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} users?`)) return;

    try {
      const deletePromises = Array.from(selectedUsers).map(id => adminService.deleteUser(id));
      await Promise.all(deletePromises);
      fetchUsers();
      setSelectedUsers(new Set());
    } catch (error) {
      setError('Error performing bulk delete');
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(user => user.id)));
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const filteredUsers = users.filter(user => {
    // We don't need to filter by search query here since the API already did that
    // Just apply the role and status filters
    const matchesRole = filterRole === 'all' ||
      (filterRole === 'superuser' && user.is_superuser) ||
      (filterRole === 'staff' && user.is_staff && !user.is_superuser) ||
      (filterRole === 'user' && !user.is_staff && !user.is_superuser);

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);

    return matchesRole && matchesStatus;
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const response = await adminService.updateUser(editingUser.id, editingUser);
      if (response.success && response.data) {
        const updatedUser = response.data as User;
        setUsers(users.map(user => 
          user.id === updatedUser.id ? updatedUser : user
        ));
        setEditingUser(null);
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (error) {
      setError('Error updating user');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target?.result?.toString() || '';
        
        const response = await adminService.updateAvatar(
          editingUser.id,
          base64Content,
          file.name
        );

        if (response.success && response.data) {
          const updatedUser = response.data as User;
          setUsers(users.map(user => 
            user.id === updatedUser.id ? updatedUser : user
          ));
          setEditingUser(updatedUser);
        } else {
          setError(response.message || 'Failed to update avatar');
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setError('Error updating avatar');
    }
  };

  if (error && !users.length) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <div className="flex space-x-4">
            {selectedUsers.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
              >
                <FiTrash2 className="mr-2" />
                Delete Selected ({selectedUsers.size})
              </button>
            )}
            <Link 
              href="/admin/users/bulk-upload"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
            >
              <FiUpload className="mr-2" />
              Bulk Upload
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="absolute left-3 top-3 flex items-center">
                {loading && searchQuery ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-1"></div>
                ) : (
                  <FiSearch className="text-gray-400" />
                )}
              </div>
            </div>
            <div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="w-full py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="staff">Staff</option>
                <option value="superuser">Superusers</option>
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p>{error}</p>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">Loading users...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? `No users found matching "${searchQuery}"` : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            {user.avatar ? (
                              <img className="h-10 w-10 rounded-full" src={user.avatar} alt="" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-500 font-medium">
                                  {user.first_name?.[0] || user.username[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          user.is_superuser
                            ? 'bg-purple-100 text-purple-800'
                            : user.is_staff
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.is_superuser ? 'Superuser' : user.is_staff ? 'Staff' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <FiEdit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(page => page + 1)}
              disabled={currentPage * pageSize >= totalCount}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(page => page + 1)}
                  disabled={currentPage * pageSize >= totalCount}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                  disabled={currentPage * pageSize >= totalCount}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Last
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-500">
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={editingUser.first_name}
                    onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={editingUser.last_name}
                    onChange={e => setEditingUser({...editingUser, last_name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  value={editingUser.bio || ''}
                  onChange={e => setEditingUser({...editingUser, bio: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Avatar</label>
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 flex-shrink-0">
                    {editingUser.avatar ? (
                      <img 
                        src={editingUser.avatar} 
                        alt="User avatar" 
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 text-xl font-medium">
                          {editingUser.first_name?.[0] || editingUser.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <FiUpload className="mr-2 h-4 w-4" />
                      Upload New Avatar
                    </label>
                    {editingUser.avatar && (
                      <button
                        type="button"
                        onClick={() => setEditingUser({...editingUser, avatar: ''})}
                        className="ml-2 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-gray-50"
                      >
                        <FiX className="mr-2 h-4 w-4" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.is_active}
                    onChange={e => setEditingUser({...editingUser, is_active: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.is_staff}
                    onChange={e => setEditingUser({...editingUser, is_staff: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Staff</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.is_superuser}
                    onChange={e => setEditingUser({...editingUser, is_superuser: e.target.checked})}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Superuser</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirmation(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
} 