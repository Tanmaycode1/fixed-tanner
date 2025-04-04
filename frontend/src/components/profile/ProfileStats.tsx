"use client";



interface ProfileStatsProps {
  postCount: number;
  followersCount: number;
  followingCount: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  isPublicProfile?: boolean;
}

export function ProfileStats({
  postCount,
  followersCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
  isPublicProfile = false
}: ProfileStatsProps) {
  const StatItem = ({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) => (
    <div 
      className={`flex flex-col items-center ${!isPublicProfile && onClick ? 'cursor-pointer hover:opacity-75' : ''}`}
      onClick={!isPublicProfile && onClick ? onClick : undefined}
    >
      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );

  return (
    <div className="flex gap-8">
      <StatItem label="Posts" value={postCount} />
      <StatItem 
        label="Followers" 
        value={followersCount} 
        onClick={!isPublicProfile ? onFollowersClick : undefined} 
      />
      <StatItem 
        label="Following" 
        value={followingCount} 
        onClick={!isPublicProfile ? onFollowingClick : undefined} 
      />
    </div>
  );
} 