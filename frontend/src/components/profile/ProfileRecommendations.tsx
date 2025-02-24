import { User, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestedUsers } from '@/data/mockData';

export function ProfileRecommendations() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Recommended Profiles
      </h3>
      <div className="space-y-4">
        {suggestedUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="relative flex-shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
              )}
              {user.is_verified && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-primary-500 text-white rounded-full p-0.5 border-2 border-white dark:border-gray-800">
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {user.username}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {user.first_name} {user.last_name}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 rounded-full"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
} 