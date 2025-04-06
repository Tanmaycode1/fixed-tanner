# Advanced Feed and User Suggestion Algorithms

This document outlines the implementation of advanced feed and user suggestion algorithms introduced in this update.

## 🔄 New Models

### 1. Tag
Simple tagging model to categorize posts and enable content-based recommendations.

### 2. UserContentPreference
Tracks user content type preferences (news vs audio), recency preferences, diversity preferences, and tag preferences. This model learns from user behavior and updates automatically.

### 3. UserInterestGraph
Implements a weighted graph approach to track relationships between users. The graph considers:
- Direct connections (following/followers)
- Common interactions (liking the same posts)
- Content similarity
- Second-degree connections (friends of friends)

## 🌟 Feed Algorithm Overview

The new feed algorithm provides multiple sections and personalized content:

### Sections:
1. **Following**: Content from users you follow, with personalization based on interactions
2. **Recommended**: Personalized content based on your interest graph
3. **Trending**: Popular content based on an advanced trending score algorithm
4. **Discover**: Random content with recency bias to help discover new users

### Relevance Scoring:
For each section, posts are scored based on:
- Base score (likes, comments)
- Recency score (newer content scores higher)
- Interaction score (trending metrics)
- Personalization score (content type preferences, tag matches)
- Interest graph score (for recommended section)

### Infinite Scrolling Support:
- Pagination parameters control loading more content
- Metadata included for client to know if more content exists
- Post IDs tracking prevents duplicate content across sections

## 👥 User Suggestion Algorithm

The user suggestion system has three main approaches that can be used individually or combined:

1. **Interest Graph**: Suggests users based on weighted connections in your interest graph
2. **Similar Users**: Finds users followed by people you follow
3. **Random**: Provides random suggestions to diversify recommendations

The algorithm provides metadata about which sources were used for transparency.

## ⏰ Background Tasks

Several Celery tasks run periodically:

1. `update_trending_scores`: Calculates trending scores for posts (every 3 hours)
2. `update_user_preferences`: Updates user content preferences (twice daily)
3. `update_user_interest_graphs`: Updates user interest graphs (daily)
4. `record_post_view`: Records post views asynchronously (on demand)

## 🚀 Getting Started

These features are automatically available once you run migrations:

```bash
python manage.py makemigrations posts
python manage.py migrate
```

## 📊 API Endpoints

### Feed:
- `GET /api/posts/feed/`: Get the feed with multiple sections
   - Parameters:
      - `page`: Page number (default: 1)
      - `section`: One of 'following', 'recommended', 'trending', 'discover', 'all' (default: 'all')
      - `limit`: Number of posts per section (default: 10)
      - `personalize`: Whether to apply user preferences (default: true)
      - `debug`: Set to 'true' for detailed scoring info (default: false)

### Post Views:
- `POST /api/posts/{post_id}/record_view/`: Record a view asynchronously
   - Parameters:
      - `view_duration`: Optional duration in seconds

### User Suggestions:
- `GET /api/users/suggestions/`: Get user suggestions
   - Parameters:
      - `limit`: Number of suggestions (default: 10)
      - `algorithm`: One of 'graph', 'similar', 'random', 'all' (default: 'all')
      - `exclude_following`: Whether to exclude users already followed (default: true)

## 🔄 Automatic Updates

The system uses Django signals to automatically:
- Update user preferences when they interact with posts
- Update interest graphs when users follow/unfollow others
- Update interest graphs when users like posts

## 📈 Performance Considerations

- Database indexes added to all query fields for performance
- Batched processing for background tasks
- Caching used where appropriate
- Asynchronous processing for view recording
- Task throttling for resource-intensive operations

## 📝 Debugging

Use the `debug=true` parameter in the feed API to see detailed scoring information for each post in the response. 