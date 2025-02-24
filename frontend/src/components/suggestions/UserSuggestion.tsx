import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import { FollowButton } from '@/components/ui/follow-button';

interface UserSuggestionProps {
  user: {
    id: string;
    username: string;
    avatar?: string;
    email: string;
    first_name?: string;
    last_name?: string;
    is_followed?: boolean;
  };
  onFollowChange: () => void;
}

export function UserSuggestion({ user, onFollowChange }: UserSuggestionProps) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/profile/${user.username}`}>
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.username}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link 
          href={`/profile/${user.username}`}
          className="font-medium text-gray-900 dark:text-white hover:underline truncate block"
        >
          {user.username}
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user.email}
        </p>
      </div>
      <FollowButton 
        userId={user.id}
        username={user.username}
        isFollowing={user.is_followed || false}
        onFollowChange={onFollowChange}
      />
    </div>
  );
} 