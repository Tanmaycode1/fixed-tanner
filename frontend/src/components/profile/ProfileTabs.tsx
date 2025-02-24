import { useState } from 'react';
import { motion } from 'framer-motion';
import { Grid, PlayCircle, Newspaper, Bookmark, Image, Heart, MessageCircle } from 'lucide-react';
import type { UserProfile } from '@/types/user';

interface ProfileTabsProps {
  profile: UserProfile;
}

const tabs = [
  { id: 'posts', label: 'Posts', icon: Grid },
  { id: 'articles', label: 'Articles', icon: Newspaper },
  { id: 'audio', label: 'Audio', icon: PlayCircle },
  { id: 'saved', label: 'Saved', icon: Bookmark },
];

const mockPosts = [
  {
    id: 1,
    type: 'image',
    thumbnail: '/posts/1.jpg',
    likes: 234,
    comments: 18
  },
  {
    id: 2,
    type: 'audio',
    thumbnail: '/posts/2.jpg',
    likes: 156,
    comments: 12
  },
  // Add more mock posts...
];

export function ProfileTabs({ profile }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState('posts');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {mockPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group relative"
              >
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt={`Post ${post.id}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
                    <Image className="w-8 h-8" />
                  </div>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 flex items-center justify-center space-x-6">
                    <div className="flex items-center text-white">
                      <Heart className="w-6 h-6 mr-2" />
                      <span className="text-sm font-medium">{post.likes}</span>
                    </div>
                    <div className="flex items-center text-white">
                      <MessageCircle className="w-6 h-6 mr-2" />
                      <span className="text-sm font-medium">{post.comments}</span>
                    </div>
                  </div>
                </div>

                {/* Post Type Indicator */}
                {post.type === 'audio' && (
                  <div className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-full">
                    <PlayCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        );
      // Add cases for other tabs...
      default:
        return null;
    }
  };

  return (
    <div className="mt-8">
      {/* Enhanced Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-around md:justify-start md:gap-8 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <tab.icon className="w-5 h-5" />
                <span className="hidden md:inline">{tab.label}</span>
                {/* Add count badges */}
                {tab.id === 'posts' && (
                  <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                    24
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </div>
    </div>
  );
} 