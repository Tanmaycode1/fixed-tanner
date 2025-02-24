"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Filter,
  Settings,
  Trash2,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { notificationApi } from '@/services/api';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Interfaces
interface NotificationSender {
  id: string;
  username: string;
  avatar: string | null;
}

interface NotificationExtraData {
  post_id?: string;
  comment_id?: string;
}

interface Notification {
  id: string;
  sender: NotificationSender;
  notification_type: 'LIKE' | 'COMMENT' | 'FOLLOW';
  message: string;
  redirect_url: string;
  is_read: boolean;
  created_at: string;
  extra_data: NotificationExtraData;
}

interface PaginationData {
  count: number;
  total_pages: number;
  current_page: number;
  has_next: boolean;
  has_previous: boolean;
  next_page: number | null;
  previous_page: number | null;
}

interface NotificationTypeConfig {
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100 }
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [activeTab, selectedType]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getNotifications(1, {
        unread_only: activeTab === 'unread',
        type: selectedType
      });
      
      if (response.success) {
        setNotifications(response.data.results);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await notificationApi.markAllAsRead();
      if (response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await notificationApi.clearAll();
      if (response.success) {
        setNotifications([]);
        toast.success('All notifications cleared');
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  const handleRemoveFilters = () => {
    setSelectedType(null);
    setActiveTab('all');
  };

  const getTypeCounts = () => {
    return notifications.reduce((acc, curr) => {
      acc[curr.notification_type] = (acc[curr.notification_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const typeCounts = getTypeCounts();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        const response = await notificationApi.markAsRead(notification.id);
        if (response.success) {
          setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
          );
        }
      }

      if (notification.redirect_url) {
        router.push(notification.redirect_url);
      } else {
        switch (notification.notification_type) {
          case 'FOLLOW':
            router.push(`/profile/${notification.sender.id}`);
            break;
          case 'LIKE':
          case 'COMMENT':
            if (notification.extra_data?.post_id) {
              router.push(`/posts/${notification.extra_data.post_id}`);
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconConfig: Record<string, NotificationTypeConfig> = {
      LIKE: {
        icon: <Heart className="h-4 w-4" />,
        bgClass: "bg-red-50 dark:bg-red-500/10",
        textClass: "text-red-500 dark:text-red-400"
      },
      COMMENT: {
        icon: <MessageCircle className="h-4 w-4" />,
        bgClass: "bg-blue-50 dark:bg-blue-500/10",
        textClass: "text-blue-500 dark:text-blue-400"
      },
      FOLLOW: {
        icon: <UserPlus className="h-4 w-4" />,
        bgClass: "bg-green-50 dark:bg-green-500/10",
        textClass: "text-green-500 dark:text-green-400"
      }
    };

    const config = iconConfig[type] || {
      icon: <Bell className="h-4 w-4" />,
      bgClass: "bg-gray-50 dark:bg-gray-700",
      textClass: "text-gray-500 dark:text-gray-400"
    };

    return (
      <div className={cn(
        "rounded-full p-2",
        config.bgClass,
        config.textClass
      )}>
        {config.icon}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900/50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="border dark:border-gray-800 shadow-lg">
          {/* Header */}
          <div className="p-4 md:p-6 border-b dark:border-gray-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center justify-between md:justify-start gap-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Notifications</h1>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {/* Mobile Filter Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={notifications.length === 0}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Mark read</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearAll}
                  disabled={notifications.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Clear all</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            </div>

            {/* Tabs and Filter Reset */}
            <div className="flex items-center justify-between gap-4">
              <Tabs 
                value={activeTab} 
                onValueChange={(value) => setActiveTab(value as 'all' | 'unread')} 
                className="w-full max-w-[400px]"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">
                    All
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({notifications.length})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="unread">
                    Unread
                    {unreadCount > 0 && (
                      <span className="ml-2 bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">
                        {unreadCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {(selectedType || activeTab !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFilters}
                  className="text-muted-foreground hover:text-primary whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Remove filters</span>
                  <span className="sm:hidden">Reset</span>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Filters Dropdown */}
          <AnimatePresence>
            {showMobileFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden border-b dark:border-gray-800"
              >
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold mb-3">Filter by Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['LIKE', 'COMMENT', 'FOLLOW'].map((type) => (
                      <Button 
                        key={type}
                        variant={selectedType === type ? "secondary" : "ghost"}
                        className={cn(
                          "justify-start group",
                          selectedType === type && "bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedType(selectedType === type ? null : type);
                          setShowMobileFilters(false);
                        }}
                      >
                        {getNotificationIcon(type)}
                        <span className="ml-2 flex-1">
                          {type.charAt(0) + type.slice(1).toLowerCase()}s
                        </span>
                        {typeCounts[type] > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {typeCounts[type]}
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex">
            {/* Desktop Filter Sidebar */}
            <div className="hidden md:block w-64 p-4 border-r dark:border-gray-800">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-3">Filter by Type</h3>
                  <div className="space-y-2">
                    {['LIKE', 'COMMENT', 'FOLLOW'].map((type) => (
                      <Button 
                        key={type}
                        variant={selectedType === type ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start group",
                          selectedType === type && "bg-primary/10"
                        )}
                        onClick={() => setSelectedType(selectedType === type ? null : type)}
                      >
                        {getNotificationIcon(type)}
                        <span className="ml-2 flex-1 text-left">
                          {type.charAt(0) + type.slice(1).toLowerCase()}s
                        </span>
                        {typeCounts[type] > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {typeCounts[type]}
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t dark:border-gray-800">
                  <h3 className="font-semibold mb-3">Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{notifications.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unread</span>
                      <span className="font-medium">{unreadCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Read</span>
                      <span className="font-medium">{notifications.length - unreadCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1">
              <ScrollArea className="h-[calc(100vh-16rem)]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
                      <Bell className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-center px-4">
                      No {activeTab === 'unread' ? 'unread ' : ''}notifications
                      {selectedType && ` of type ${selectedType.toLowerCase()}`}
                    </h3>
                    <p className="text-muted-foreground text-center mt-2 max-w-sm px-4">
                      {activeTab === 'unread' 
                        ? "You're all caught up! Check back later for new notifications."
                        : "When someone interacts with your content, you'll see it here."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-gray-800">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group transition-colors",
                          !notification.is_read && "bg-primary/5"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-4">
                          <Avatar>
                            <AvatarImage src={notification.sender.avatar || undefined} />
                            <AvatarFallback>
                              {notification.sender.username[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {getNotificationIcon(notification.notification_type)}
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                              {!notification.is_read && (
                                <span className="text-xs text-primary font-medium">New</span>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="h-5 w-5 text-muted-foreground transform transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}