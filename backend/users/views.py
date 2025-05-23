from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import User, UserProfile,Notification
from .serializers import UserSerializer, UserCreateSerializer, UserProfileSerializer, UserPublicProfileSerializer,NotificationSerializer
from core.decorators import handle_exceptions, paginate_response
from core.utils.response import api_response, error_response, ErrorCode
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from PIL import Image
from io import BytesIO
import logging
from rest_framework.authentication import BasicAuthentication
from django.core.paginator import Paginator
from django.db.models import Exists, OuterRef, Q, Count
from core.utils.test_connections import test_s3_connection
from core.utils.file_handlers import handle_uploaded_file
import uuid

logger = logging.getLogger(__name__)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['send_verification_otp', 'verify_email_otp']:
            return [AllowAny()]
        return super().get_permissions()

    @handle_exceptions
    @paginate_response
    def list(self, request, *args, **kwargs):
        """Get list of all users"""
        return self.get_queryset()

    @handle_exceptions
    def create(self, request, *args, **kwargs):
        """Create a new user"""
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check if email is verified
        email = request.data.get('email')
        if not User.objects.filter(email=email, email_verified=True).exists():
            return api_response(
                success=False,
                message="Email must be verified before registration",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        
        user = serializer.save()
        return api_response(
            message="User created successfully",
            data=self.get_serializer(user).data,
            status_code=status.HTTP_201_CREATED
        )

    @handle_exceptions
    def retrieve(self, request, pk=None):
        """Get user details by ID"""
        user = self.get_object()
        serializer = self.get_serializer(user)
        return api_response(
            message="User details retrieved successfully",
            data=serializer.data
        )

    @handle_exceptions
    def update(self, request, pk=None):
        """Update user details"""
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return api_response(
            message="User updated successfully",
            data=serializer.data
        )

    @handle_exceptions
    def partial_update(self, request, pk=None):
        """Partial update user details"""
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return api_response(
            message="User partially updated successfully",
            data=serializer.data
        )

    @handle_exceptions
    def destroy(self, request, pk=None):
        """Delete user"""
        user = self.get_object()
        user.delete()
        return api_response(
            message="User deleted successfully"
        )

    @handle_exceptions
    @action(detail=True, methods=['POST'])
    def follow(self, request, pk=None):
     """Follow a user"""
     try:
        user_to_follow = self.get_object()
        
        # Check if trying to follow self
        if request.user == user_to_follow:
            return Response({
                'success': False,
                'message': 'Cannot follow yourself'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if already following
        if request.user.following.filter(id=user_to_follow.id).exists():
            return Response({
                'success': False,
                'message': f'Already following {user_to_follow.username}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Add to following
        request.user.following.add(user_to_follow)
        
        # Create notification
        user_to_follow.create_follow_notification(request.user)
        
        return Response({
            'success': True,
            'message': f'Now following {user_to_follow.username}'
        })
        
     except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


    @handle_exceptions
    @action(detail=True, methods=['POST'])
    def unfollow(self, request, pk=None):
        """Unfollow a user"""
        try:
            user_to_unfollow = self.get_object()
            
            # Check if not following
            if not request.user.following.filter(id=user_to_unfollow.id).exists():
                return Response({
                    'success': False,
                    'message': f'Not following {user_to_unfollow.username}'
                }, status=status.HTTP_400_BAD_REQUEST)

            request.user.following.remove(user_to_unfollow)
            
            return Response({
                'success': True,
                'message': f'Unfollowed {user_to_unfollow.username}'
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @handle_exceptions
    @action(detail=False, methods=['GET'])
    def followers(self, request):
        """Get list of followers"""
        try:
            page_size = int(request.query_params.get('page_size', 10))
            page = int(request.query_params.get('page', 1))
            
            followers = User.objects.filter(following=request.user).annotate(
                is_followed=Exists(
                    request.user.following.filter(
                        id=OuterRef('id')
                    )
                )
            )
            
            paginator = Paginator(followers, page_size)
            current_page = paginator.page(page)
            
            serializer = UserSerializer(current_page.object_list, many=True, context={'request': request})
            
            return api_response(
                success=True,
                message="Followers retrieved successfully",
                data={
                    'results': serializer.data,
                    'count': followers.count(),
                    'total_pages': paginator.num_pages,
                    'current_page': page,
                    'has_next': current_page.has_next(),
                    'has_previous': current_page.has_previous()
                }
            )
        except Exception as e:
            logger.error(f"Error fetching followers: {str(e)}")
            return api_response(
                success=False,
                message="Failed to fetch followers",
                error_code=ErrorCode.API_ERROR,
                status_code=status.HTTP_400_BAD_REQUEST
            )

    @handle_exceptions
    @action(detail=False, methods=['GET'])
    def following(self, request):
        """Get list of users being followed"""
        try:
            page_size = int(request.query_params.get('page_size', 10))
            page = int(request.query_params.get('page', 1))
            
            following = request.user.following.all()
            # For following list, all users are followed by definition
            for user in following:
                user.is_followed = True
            
            paginator = Paginator(following, page_size)
            current_page = paginator.page(page)
            
            serializer = UserSerializer(current_page.object_list, many=True, context={'request': request})
            
            return api_response(
                success=True,
                message="Following list retrieved successfully",
                data={
                    'results': serializer.data,
                    'count': following.count(),
                    'total_pages': paginator.num_pages,
                    'current_page': page,
                    'has_next': current_page.has_next(),
                    'has_previous': current_page.has_previous()
                }
            )
        except Exception as e:
            logger.error(f"Error fetching following: {str(e)}")
            return api_response(
                success=False,
                message="Failed to fetch following list",
                error_code=ErrorCode.API_ERROR,
                status_code=status.HTTP_400_BAD_REQUEST
            )

    @handle_exceptions
    @action(detail=False, methods=['GET'])
    def me(self, request):
        """Get own profile details"""
        return api_response(
            message="Profile retrieved successfully",
            data=self.get_serializer(request.user).data
        )

    @handle_exceptions
    @action(detail=False, methods=['PUT', 'PATCH'])
    def update_profile(self, request):
        """Update profile details"""
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return api_response(
            message="Profile updated successfully",
            data=serializer.data
        )

    @handle_exceptions
    @action(detail=False, methods=['GET'])
    def search(self, request):
        """Search users by username or email"""
        query = request.query_params.get('q', '')
        if not query:
            return api_response(
                success=False,
                message="Search query is required",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        )
        serializer = self.get_serializer(users, many=True)
        return api_response(
            message="Search results",
            data=serializer.data
        )

    @handle_exceptions
    @action(detail=False, methods=['GET'])
    def suggestions(self, request):
        """
        Get user suggestions based on an advanced algorithm
        
        Query parameters:
        - limit: Number of suggestions to return (default: 10)
        - algorithm: One of 'graph' (interest graph), 'similar' (similar users), 'random' (random users)
                    or 'all' (blend of all algorithms) (default: 'all')
        - exclude_following: Whether to exclude users already followed (default: true)
        """
        try:
            # Parse query parameters
            limit = min(int(request.query_params.get('limit', 10)), 50)  # Cap at 50
            algorithm = request.query_params.get('algorithm', 'all').lower()
            exclude_following = request.query_params.get('exclude_following', 'true').lower() == 'true'
            
            # Base queryset for users
            user_queryset = User.objects.exclude(id=request.user.id)
            
            # Exclude users already followed if requested
            if exclude_following:
                user_queryset = user_queryset.exclude(followers=request.user)
            
            # Track suggestion sources for analytics
            suggestion_sources = []
            suggested_user_ids = set()
            
            # Dictionary to track final suggestions with score
            suggested_users_with_score = {}
            
            # 1. Get suggestions from interest graph if available
            if algorithm in ['graph', 'all']:
                try:
                    # Import from posts app to avoid circular imports
                    from posts.models import UserInterestGraph
                    
                    # Get or create interest graph
                    interest_graph = UserInterestGraph.get_or_create_for_user(request.user)
                    
                    # Get suggested users from graph
                    graph_suggestions = interest_graph.get_suggested_users(limit=limit*2)  # Get more than needed for blending
                    
                    if graph_suggestions:
                        suggestion_sources.append('graph')
                        
                        # Add graph suggestions with score
                        for user_id, weight in graph_suggestions:
                            if user_id not in suggested_user_ids:
                                suggested_users_with_score[user_id] = {
                                    'score': weight * 10.0,  # Scale up for consistent scoring
                                    'source': 'graph'
                                }
                                suggested_user_ids.add(user_id)
                except Exception as e:
                    # Log error but continue with other algorithms
                    logger.warning(f"Error getting graph suggestions: {str(e)}")
            
            # 2. Get similar users based on common followers/following
            if algorithm in ['similar', 'all'] and len(suggested_user_ids) < limit*2:
                try:
                    # Get users who are followed by people the current user follows
                    # (friends of friends)
                    following_users = request.user.following.all()
                    
                    if following_users.exists():
                        # Get users followed by people I follow, with count of how many follow them
                        similar_users = User.objects.filter(
                            followers__in=following_users
                        ).exclude(
                            id=request.user.id
                        ).exclude(
                            id__in=suggested_user_ids
                        )
                        
                        if exclude_following:
                            similar_users = similar_users.exclude(followers=request.user)
                        
                        similar_users = similar_users.annotate(
                            common_count=Count('followers')
                        ).order_by('-common_count')[:limit]
                        
                        if similar_users.exists():
                            suggestion_sources.append('similar')
                            
                            # Add similar users with score based on common connections
                            for user in similar_users:
                                if str(user.id) not in suggested_user_ids:
                                    suggested_users_with_score[str(user.id)] = {
                                        'score': user.common_count * 5.0,  # Scale for consistent scoring
                                        'source': 'similar'
                                    }
                                    suggested_user_ids.add(str(user.id))
                except Exception as e:
                    logger.warning(f"Error getting similar user suggestions: {str(e)}")
            
            # 3. Get random suggestions if needed to fill out the results
            if algorithm in ['random', 'all'] and len(suggested_user_ids) < limit:
                try:
                    # Number of random suggestions needed
                    random_count = limit - len(suggested_user_ids)
                    
                    if random_count > 0:
                        # Get random users excluding those already included
                        random_users = user_queryset.exclude(
                            id__in=suggested_user_ids
                        ).order_by('?')[:random_count]
                        
                        if random_users.exists():
                            suggestion_sources.append('random')
                            
                            # Add random users with low score
                            for user in random_users:
                                if str(user.id) not in suggested_user_ids:
                                    suggested_users_with_score[str(user.id)] = {
                                        'score': 1.0,  # Low base score
                                        'source': 'random'
                                    }
                                    suggested_user_ids.add(str(user.id))
                except Exception as e:
                    logger.warning(f"Error getting random user suggestions: {str(e)}")
            
            # If we still have no suggestions, fall back to random users
            if not suggested_users_with_score:
                random_users = user_queryset.order_by('?')[:limit]
                suggestion_sources.append('fallback_random')
                
                for user in random_users:
                    suggested_users_with_score[str(user.id)] = {
                        'score': 1.0,
                        'source': 'fallback_random'
                    }
            
            # Sort suggestions by score
            sorted_suggestions = sorted(
                suggested_users_with_score.items(), 
                key=lambda x: x[1]['score'],
                reverse=True
            )
            
            # Limit to requested number
            final_suggestions = sorted_suggestions[:limit]
            
            # Get user objects in one query
            suggested_user_ids = [uuid.UUID(user_id) for user_id, _ in final_suggestions]
            suggested_users = User.objects.filter(id__in=suggested_user_ids)
            
            # Create ordered dict to preserve sorting
            ordered_users = []
            user_dict = {str(user.id): user for user in suggested_users}
            
            for user_id, user_data in final_suggestions:
                if user_id in user_dict:
                    ordered_users.append(user_dict[user_id])
            
            # Serialize users
            serializer = UserSerializer(ordered_users, many=True, context={'request': request})
            
            # Track suggestion algorithm usage for analytics
            logger.info(f"User suggestion sources: {', '.join(suggestion_sources)}")
            
            return Response({
                'success': True,
                'data': serializer.data,
                'metadata': {
                    'sources': suggestion_sources,
                    'count': len(serializer.data)
                }
            })
            
        except Exception as e:
            logger.error(f"Error generating user suggestions: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Fallback to simple random suggestions
            fallback_users = User.objects.exclude(
                id=request.user.id
            ).order_by('?')[:5]
            
            serializer = UserSerializer(fallback_users, many=True, context={'request': request})
            
            return Response({
                'success': True,
                'data': serializer.data,
                'metadata': {
                    'sources': ['fallback'],
                    'count': len(serializer.data)
                }
            })




@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def send_verification_otp(request):
    """Send email verification OTP"""
    email = request.data.get('email')
    if not email:
        return Response({
            'success': False,
            'message': "Email is required"
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Create temporary user if doesn't exist
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'is_active': False
            }
        )
        
        if user.generate_and_send_otp():
            return Response({
                'success': True,
                'message': "OTP sent successfully"
            })
        return Response({
            'success': False,
            'message': "Failed to send OTP"
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def verify_email_otp(request):
    """Verify email with OTP"""
    email = request.data.get('email')
    otp = request.data.get('otp')

    if not email or not otp:
        return Response({
            'success': False,
            'message': "Email and OTP are required"
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        if user.verify_email_with_otp(otp):
            # Mark email as verified
            user.email_verified = True
            user.save()
            return Response({
                'success': True,
                'message': "Email verified successfully"
            })
        return Response({
            'success': False,
            'message': "Invalid or expired OTP"
        }, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': "User not found"
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def check_email(request, email):
    """Check if email exists and is verified"""
    try:
        user = User.objects.get(email=email)
        return Response({
            'success': True,
            'email_verified': user.email_verified
        })
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': "User not found"
        }, status=status.HTTP_404_NOT_FOUND)        

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_avatar(request):
    """Update user's avatar"""
    try:
        avatar = request.FILES.get('avatar')
        if not avatar:
            return error_response(
                "No image file provided", 
                ErrorCode.REQUIRED_FIELD
            )

        # Validate file type
        if not avatar.content_type.startswith('image/'):
            return error_response(
                "Invalid file type. Please upload an image", 
                ErrorCode.INVALID_IMAGE
            )

        try:
            # Handle avatar upload
            avatar_path = handle_uploaded_file(
                avatar,
                directory=f'avatars/{request.user.id}',
                is_image=True
            )
            
            # Delete old avatar if exists
            if request.user.avatar:
                try:
                    default_storage.delete(request.user.avatar.name)
                except Exception as e:
                    logger.warning(f"Error deleting old avatar: {e}")
            
            # Update user's avatar field
            request.user.avatar = avatar_path
            request.user.save()
            
            # Get the full URL
            avatar_url = default_storage.url(avatar_path)
            
            return Response({
                'success': True,
                'data': {
                    'avatar_url': avatar_url
                },
                'message': 'Avatar updated successfully'
            })
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return error_response(
                "Error processing image", 
                ErrorCode.INVALID_IMAGE
            )
            
    except Exception as e:
        logger.error(f"Error updating avatar: {e}")
        return error_response(
            str(e), 
            ErrorCode.UNKNOWN_ERROR, 
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    """Get user's profile"""
    serializer = UserProfileSerializer(request.user)
    return Response({
        'success': True,
        'data': serializer.data
    })

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update user's profile"""
    allowed_fields = [
        'first_name',
        'last_name',
        'bio',
        'social_links',
        'account_privacy',
        # Add profile fields
        'phone',
        'location',
        'birth_date',
        'website',
        'gender',
        'occupation',
        'company',
        'education'
    ]

    filtered_data = {
        k: v for k, v in request.data.items() 
        if k in allowed_fields
    }

    serializer = UserProfileSerializer(
        request.user, 
        data=filtered_data, 
        partial=True
    )
    
    if serializer.is_valid():
        serializer.save()
        return Response({
            'success': True,
            'data': serializer.data,
            'message': 'Profile updated successfully'
        })
    
    return error_response(
        "Invalid data provided", 
        ErrorCode.INVALID_FORMAT, 
        errors=serializer.errors
    )  

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile_view(request, user_id):
    """Get specific user's profile by ID"""
    logger.info(f"Fetching profile for user_id: {user_id}")
    
    try:
        # Get the requested user
        user = get_object_or_404(User, id=user_id)
        logger.info(f"Found user: {user.username}")
        
        # Base user data
        data = {
            'id': str(user.id),
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'bio': user.bio,
            'avatar': user.avatar.url if user.avatar else None,
            'social_links': user.social_links,
            'account_privacy': user.account_privacy,
            'is_verified': user.is_verified,
            
            # Add counts
            'followers_count': user.followers.count(),
            'following_count': user.following.count(),
            
            # Add profile data
            'phone': user.profile.phone,
            'location': user.profile.location,
            'birth_date': user.profile.birth_date,
            'website': user.profile.website,
            'gender': user.profile.gender,
            'occupation': user.profile.occupation,
            'company': user.profile.company,
            'education': user.profile.education,
            
            # Add follow status if not own profile
            'is_followed': request.user.following.filter(id=user.id).exists() if request.user.id != user.id else None
        }
            
        logger.info(f"Successfully retrieved profile for user: {user.username}")
        
        return api_response(
            success=True,
            message="User profile retrieved successfully",
            data=data
        )
        
    except User.DoesNotExist:
        logger.error(f"User not found with id: {user_id}")
        return api_response(
            success=False,
            message="User not found",
            status_code=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error fetching user profile: {str(e)}")
        return api_response(
            success=False,
            message=f"Failed to fetch user profile: {str(e)}",
            status_code=status.HTTP_400_BAD_REQUEST
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    query = request.GET.get('q', '').strip()
    if len(query) < 2:
        return Response({
            'success': True,
            'data': []
        })

    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query)
    ).exclude(
        id=request.user.id
    )[:10]

    data = []
    for user in users:
        user_data = {
            'id': str(user.id),
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar.url if user.avatar else None
        }
        data.append(user_data)

    return Response({
        'success': True,
        'data': data
    })

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Check if this is a schema generation request
        if getattr(self, 'swagger_fake_view', False):
            # Return empty queryset for schema generation
            return Notification.objects.none()
            
        return self.request.user.notifications.all()

    @handle_exceptions
    def list(self, request):
        """Get all notifications"""
        page_size = int(request.query_params.get('page_size', 10))
        page = int(request.query_params.get('page', 1))
        
        notifications = self.get_queryset()
        
        paginator = Paginator(notifications, page_size)
        current_page = paginator.page(page)
        
        serializer = self.get_serializer(current_page.object_list, many=True)
        
        return api_response(
            message="Notifications retrieved successfully",
            data={
                'results': serializer.data,
                'count': notifications.count(),
                'total_pages': paginator.num_pages,
                'current_page': page,
                'has_next': current_page.has_next(),
                'has_previous': current_page.has_previous(),
                'unread_count': request.user.get_unread_notifications_count()
            }
        )

    @action(detail=False, methods=['POST'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        request.user.mark_all_notifications_as_read()
        return api_response(message="All notifications marked as read")

    @action(detail=True, methods=['POST'])
    def mark_read(self, request, pk=None):
        """Mark single notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return api_response(message="Notification marked as read")

    @action(detail=False, methods=['DELETE'])
    def clear_all(self, request):
        """Delete all notifications"""
        self.get_queryset().delete()
        return api_response(message="All notifications cleared successfully")

def upload_file(request):
    if test_s3_connection():
        logger.info("S3 connection verified before upload")
    # ... rest of your upload code
