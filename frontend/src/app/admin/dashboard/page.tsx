'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { useAdminService } from '@/hooks/useAdminService';
import { FiUsers, FiFileText, FiFlag, FiActivity, FiCalendar, FiBarChart2, FiThumbsUp, FiMessageSquare } from 'react-icons/fi';
import { format, subDays } from 'date-fns';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { PostStats } from '@/services/adminService';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SystemLog {
  id: string;
  timestamp: string;
  level: string;
  type: string;
  action: string;
  details: string;
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
  ip_address: string;
  user_agent: string;
}

interface LogsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SystemLog[];
}

export default function Dashboard() {
  const { apiKey } = useAdmin();
  const adminService = useAdminService();
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [postStats, setPostStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [tempDateRange, setTempDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isLoadingPostStats, setIsLoadingPostStats] = useState(false);

  // Fetch dashboard stats and logs only once when component mounts
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!apiKey) {
        setError('API key is required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch dashboard stats
        const statsResponse = await adminService.getDashboardStats();
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        } else {
          setError(statsResponse.message || 'Failed to fetch dashboard stats');
        }

        // Fetch system logs
        const logsResponse = await adminService.getSystemLogs({
          limit: 10
        });
        if (logsResponse.success && logsResponse.data) {
          setLogs(logsResponse.data);
        }
      } catch (err) {
        setError('An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [apiKey, adminService]);

  // Separate effect for post stats that depends on date range
  useEffect(() => {
    const fetchPostStats = async () => {
      if (!apiKey) return;
      
      setIsLoadingPostStats(true);
      try {
        const postStatsResponse = await adminService.getPostStats(
          dateRange.startDate,
          dateRange.endDate
        );
        if (postStatsResponse.success && postStatsResponse.data) {
          setPostStats(postStatsResponse.data);
        }
      } catch (err) {
        console.error('Error fetching post stats:', err);
      } finally {
        setIsLoadingPostStats(false);
      }
    };

    fetchPostStats();
  }, [apiKey, dateRange.startDate, dateRange.endDate, adminService]);

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'startDate' | 'endDate') => {
    setTempDateRange(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const applyDateFilter = () => {
    setDateRange(tempDateRange);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // Prepare data for posts by day chart
  const postsChartData = {
    labels: postStats?.posts_by_day?.map(item => format(new Date(item.day), 'MMM d')) || [],
    datasets: [
      {
        label: 'Posts',
        data: postStats?.posts_by_day?.map(item => item.count) || [],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Prepare data for post types pie chart
  const postTypesData = {
    labels: postStats ? Object.keys(postStats.post_types || {}) : [],
    datasets: [
      {
        data: postStats ? Object.values(postStats.post_types || {}) : [],
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for top authors chart
  const topAuthorsData = {
    labels: postStats?.top_authors?.map(author => author.author__username) || [],
    datasets: [
      {
        label: 'Posts',
        data: postStats?.top_authors?.map(author => author.post_count) || [],
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <FiUsers className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.users?.total || 0}</p>
                <p className="text-sm text-green-600">+{stats?.users?.new_24h || 0} today</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <FiFileText className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Posts</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.posts?.total || 0}</p>
                <p className="text-sm text-green-600">+{stats?.posts?.new_24h || 0} today</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <FiFlag className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Reported Posts</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.posts?.reported || 0}</p>
                <p className="text-sm text-gray-500">Pending review</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <FiActivity className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Moderation Actions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats?.moderation?.actions_24h || 0}</p>
                <p className="text-sm text-gray-500">Last 24 hours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Post Statistics</h2>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="start-date"
                value={tempDateRange.startDate}
                onChange={(e) => handleDateRangeChange(e, 'startDate')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="end-date"
                value={tempDateRange.endDate}
                onChange={(e) => handleDateRangeChange(e, 'endDate')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="self-end">
              <button
                onClick={applyDateFilter}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>

        {/* Post Stats Overview */}
        {isLoadingPostStats ? (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        ) : postStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <FiBarChart2 className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Posts</p>
                  <p className="text-2xl font-semibold text-gray-900">{postStats.total_posts}</p>
                  <p className="text-sm text-gray-500">In selected period</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <FiCalendar className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Daily Average</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(postStats.total_posts / Math.max(postStats.posts_by_day.length, 1)).toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">Posts per day</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-red-100 text-red-600">
                  <FiThumbsUp className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg. Likes</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {postStats.engagement.avg_likes_per_post.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">Per post</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  <FiMessageSquare className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg. Comments</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {postStats.engagement.avg_comments_per_post.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">Per post</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Charts */}
        {postStats && !isLoadingPostStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Posts by Day Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Posts Over Time</h3>
              <div className="h-80">
                <Line
                  data={postsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          precision: 0
                        }
                      }
                    },
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Post Types Pie Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Post Types</h3>
              <div className="h-80 flex justify-center items-center">
                <div className="w-64 h-64">
                  <Pie
                    data={postTypesData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom' as const,
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.raw as number;
                              const total = (context.chart.data.datasets[0].data as number[]).reduce((a, b) => (a as number) + (b as number), 0) as number;
                              const percentage = Math.round((value / total) * 100);
                              return `${label}: ${value} (${percentage}%)`;
                            }
                          }
                        }
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top Authors Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Authors</h3>
              <div className="h-80">
                <Bar
                  data={topAuthorsData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y' as const,
                    scales: {
                      x: {
                        beginAtZero: true,
                        ticks: {
                          precision: 0
                        }
                      }
                    },
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Most Liked Posts */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Most Liked Posts</h3>
              <div className="overflow-hidden">
                <ul className="divide-y divide-gray-200">
                  {postStats.most_liked_posts.map((post) => (
                    <li key={post.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
                          <p className="text-sm text-gray-500">by {post.author}</p>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <FiThumbsUp className="mr-1 h-4 w-4 text-red-500" />
                          {post.likes_count}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* System Logs */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent System Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs?.results.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        log.level === 'INFO' 
                          ? 'bg-green-100 text-green-800' 
                          : log.level === 'WARNING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.user ? log.user.username : 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 