export const mockPosts = [
  {
    id: "1",
    type: "NEWS",
    title: "The Future of Web Development in 2024",
    description: "Exploring the latest trends in web development, including AI-powered development tools, WebAssembly advancements, and the rise of Edge computing...",
    image: "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&auto=format&fit=crop&q=60",
    audio_file: null,
    author: {
      id: "auth1",
      username: "alexdev",
      first_name: "Alex",
      last_name: "Chen",
      email: "alex@example.com",
      bio: "Senior Web Developer | Tech Enthusiast",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=60"
    },
    created_at: "2024-01-24T16:05:54.238419Z",
    updated_at: "2024-01-24T16:05:54.238449Z",
    comments_count: 2,
    likes_count: 234,
    is_liked: false,
    trending_data: {
      score: 0.338606959183493,
      view_count: 1200,
      like_count: 234,
      comment_count: 2,
      share_count: 45
    }
  },
  {
    id: "2",
    type: "AUDIO",
    title: "Tech Talk: AI Revolution",
    description: "A deep dive into how artificial intelligence is transforming different industries and what to expect in the coming years.",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=60",
    audio_file: "/media/audio/tech-talk.mp3",
    author: {
      id: "auth2",
      username: "techinsights",
      first_name: "Sarah",
      last_name: "Miller",
      email: "sarah@techinsights.com",
      bio: "Tech Analyst | AI Researcher",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=60"
    },
    created_at: "2024-01-24T14:05:54.238419Z",
    updated_at: "2024-01-24T14:05:54.238449Z",
    comments_count: 1,
    likes_count: 156,
    is_liked: true,
    trending_data: {
      score: 0.287606959183493,
      view_count: 800,
      like_count: 156,
      comment_count: 1,
      share_count: 23
    }
  },
  {
    id: "3",
    type: "NEWS",
    title: "Maximizing Developer Productivity",
    description: "Learn about the best practices, tools, and techniques that can help developers boost their productivity while maintaining code quality...",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=60",
    audio_file: null,
    author: {
      id: "auth3",
      username: "devweekly",
      first_name: "David",
      last_name: "Kumar",
      email: "david@devweekly.com",
      bio: "Developer Advocate | Technical Writer",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=60"
    },
    created_at: "2024-01-24T12:05:54.238419Z",
    updated_at: "2024-01-24T12:05:54.238449Z",
    comments_count: 0,
    likes_count: 189,
    is_liked: false,
    trending_data: {
      score: 0.298606959183493,
      view_count: 950,
      like_count: 189,
      comment_count: 0,
      share_count: 34
    }
  }
];

export const trendingTopics = [
  { id: "1", name: "Web Development", postCount: 2453, color: "blue" },
  { id: "2", name: "Machine Learning", postCount: 1832, color: "purple" },
  { id: "3", name: "DevOps", postCount: 1654, color: "green" },
  { id: "4", name: "Cybersecurity", postCount: 1243, color: "red" },
  { id: "5", name: "Blockchain", postCount: 986, color: "orange" }
];

export const suggestedUsers = [
  {
    id: "1",
    username: "sarahj",
    first_name: "Sarah",
    last_name: "Johnson",
    email: "sarah@google.com",
    bio: "Tech Lead @ Google",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=60",
    followers_count: 12400,
    is_verified: true
  },
  {
    id: "2",
    username: "mchen",
    first_name: "Michael",
    last_name: "Chen",
    email: "michael@research.ai",
    bio: "AI Researcher",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=60",
    followers_count: 8900,
    is_verified: false
  },
  {
    id: "3",
    username: "emmad",
    first_name: "Emma",
    last_name: "Davis",
    email: "emma@tech.co",
    bio: "Senior Developer",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=60",
    followers_count: 15600,
    is_verified: true
  }
];

// Types for TypeScript support
export interface Author {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  bio: string;
  avatar: string | null;
}

export interface TrendingData {
  score: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export interface Post {
  id: string;
  type: 'NEWS' | 'AUDIO';
  title: string;
  description: string;
  image: string | null;
  audio_file: string | null;
  author: Author;
  created_at: string;
  updated_at: string;
  comments_count: number;
  likes_count: number;
  is_liked: boolean;
  trending_data: TrendingData;
}

export interface TrendingTopic {
  id: string;
  name: string;
  postCount: number;
  color: string;
}

export interface SuggestedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  bio: string;
  avatar: string | null;
  followers_count: number;
  is_verified: boolean;
}