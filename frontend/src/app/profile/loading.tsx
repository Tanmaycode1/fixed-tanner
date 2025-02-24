import { Card } from '@/components/ui/card';

export default function LoadingProfile() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header Skeleton */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            
            <div className="flex-1 w-full">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-2 w-48" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-4 w-32" />
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-4" />
              <div className="flex flex-wrap gap-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-32" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-40" />
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-16 mx-auto" />
            </Card>
          ))}
        </div>

        {/* Account Details Skeleton */}
        <Card className="p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-4 w-40" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-32" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}