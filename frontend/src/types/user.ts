export interface UserProfile {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string;
  avatar_url?: string | null;
  social_links: Record<string, string>;
  account_privacy: 'PUBLIC' | 'PRIVATE';
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  post_count: number;
  phone?: string;
  location?: string;
  birth_date?: string | null;
  website?: string;
  gender?: string;
  occupation?: string;
  company?: string;
  education?: string;
  is_followed?: boolean;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  bio?: string;
  phone?: string;
  location?: string;
  birth_date?: string;
  website?: string;
  gender?: string;
  occupation?: string;
  company?: string;
  education?: string;
  social_links?: Record<string, string>;
  account_privacy?: string;
}

export interface SearchUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  bio?: string;
  online?: boolean;
  created_at: string;
  updated_at: string;
  last_seen?: string;
} 