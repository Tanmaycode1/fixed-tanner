from django.shortcuts import render
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from system_logs.models import SystemLog, UserRole, ModeratorAction
from posts.models import Post
from moderation.models import Report
from .serializers import (
    SystemLogSerializer, UserRoleSerializer, 
    ModeratorActionSerializer, AdminUserSerializer,
    BulkUploadTaskSerializer, BulkUploadTaskUserSerializer,
    AdminPostSerializer
)
from .permissions import IsSuperuserOrAdmin, IsModeratorOrAbove, APIKeyPermission
from django.db.models import Q, Count
from django.db.models.functions import TruncDay
from django.utils import timezone
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import csv
import io
import string
import random
import base64
import json
from django.core.cache import cache
import uuid
from django.core.files.base import ContentFile
from rest_framework.viewsets import GenericViewSet
from rest_framework.pagination import PageNumberPagination
from .models import BulkUploadTask, BulkUploadTaskUser
import logging
from django.http import HttpResponse
from celery import shared_task
from core.celery import app as celery_app

# Set up logger
logger = logging.getLogger(__name__)

User = get_user_model()

@swagger_auto_schema(
    methods=['get'],
    operation_description="Validate API key",
    responses={
        200: openapi.Response(
            description="API key is valid",
            examples={
                "application/json": {
                    "status": "valid"
                }
            }
        ),
        403: "Invalid API key"
    }
)
@api_view(['GET', 'OPTIONS'])
@permission_classes([APIKeyPermission])
def validate_api_key(request):
    """
    Endpoint to validate API key
    Returns 200 if API key is valid, 403 if invalid
    """
    # Handle OPTIONS request
    if request.method == 'OPTIONS':
        return Response(status=status.HTTP_200_OK)
        
    return Response({'status': 'valid'}, status=status.HTTP_200_OK)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class AdminPanelViewSet(GenericViewSet):
    permission_classes = [APIKeyPermission]
    pagination_class = StandardResultsSetPagination

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get admin dashboard statistics",
        responses={
            200: openapi.Response(
                description="Dashboard statistics",
                examples={
                    "application/json": {
                        "users": {
                            "total": 0,
                            "new_24h": 0,
                            "new_7d": 0
                        },
                        "posts": {
                            "total": 0,
                            "new_24h": 0,
                            "reported": 0
                        },
                        "moderation": {
                            "pending_reports": 0,
                            "actions_24h": 0
                        }
                    }
                }
            )
        }
    )
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get admin dashboard statistics"""
        try:
            now = timezone.now()
            last_24h = now - timedelta(hours=24)
            last_7d = now - timedelta(days=7)

            # Get reported posts count from Report model
            reported_posts_count = Report.objects.filter(
                related_object_type='post'
            ).values('related_object_id').distinct().count()

            stats = {
                'users': {
                    'total': User.objects.count(),
                    'new_24h': User.objects.filter(date_joined__gte=last_24h).count(),
                    'new_7d': User.objects.filter(date_joined__gte=last_7d).count(),
                },
                'posts': {
                    'total': Post.objects.count(),
                    'new_24h': Post.objects.filter(created_at__gte=last_24h).count(),
                    'reported': reported_posts_count,
                },
                'moderation': {
                    'pending_reports': Report.objects.filter(status='PENDING').count(),
                    'actions_24h': ModeratorAction.objects.filter(created_at__gte=last_24h).count(),
                }
            }
            return Response(stats)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get system logs with filtering",
        manual_parameters=[
            openapi.Parameter(
                'level', 
                openapi.IN_QUERY,
                description="Log level",
                type=openapi.TYPE_STRING,
                enum=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
            ),
            openapi.Parameter(
                'type', 
                openapi.IN_QUERY,
                description="Log type",
                type=openapi.TYPE_STRING,
                enum=['AUTH', 'USER', 'CONTENT', 'SYSTEM', 'ADMIN']
            ),
        ],
        responses={200: SystemLogSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def live_logs(self, request):
        """Get system logs with filtering"""
        queryset = SystemLog.objects.all()
        
        # Apply filters
        level = request.query_params.get('level')
        type = request.query_params.get('type')
        user_id = request.query_params.get('user_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if level:
            queryset = queryset.filter(level=level.upper())
        if type:
            queryset = queryset.filter(type=type.upper())
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)

        # Paginate results
        page = self.paginate_queryset(queryset)
        serializer = SystemLogSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def generate_strong_password(self):
        """Generate a strong random password"""
        length = 12
        characters = string.ascii_letters + string.digits + string.punctuation
        while True:
            password = ''.join(random.choice(characters) for i in range(length))
            # Check if password has at least one uppercase, one lowercase, one digit and one special char
            if (any(c.isupper() for c in password) and
                any(c.islower() for c in password) and
                any(c.isdigit() for c in password) and
                any(not c.isalnum() for c in password)):
                return password

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get list of bulk upload tasks",
        responses={200: "List of bulk upload tasks"}
    )
    @action(detail=False, methods=['get'])
    def bulk_upload_tasks(self, request):
        """Get list of all bulk upload tasks"""
        try:
            tasks = BulkUploadTask.objects.all()
            page = self.paginate_queryset(tasks)
            serializer = BulkUploadTaskSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['delete'],
        operation_description="Delete all users from a bulk upload task",
        responses={204: 'No Content'}
    )
    @action(detail=False, methods=['delete'])
    def delete_bulk_task_users(self, request):
        """Delete all users created in a specific bulk upload task"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            
            # Get all task users
            task_users = BulkUploadTaskUser.objects.filter(task=task)
            
            # Get all user IDs
            user_ids = task_users.values_list('user_id', flat=True)
            
            # Delete users in batches
            batch_size = 100
            for i in range(0, len(user_ids), batch_size):
                batch_ids = user_ids[i:i + batch_size]
                User.objects.filter(id__in=batch_ids).delete()
            
            # Delete task users
            task_users.delete()

            # Update task status
            task.status = 'DELETED'
            task.save()

            return Response(status=status.HTTP_204_NO_CONTENT)
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'No such task found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Bulk register users from CSV file",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'csv_file': openapi.Schema(type=openapi.TYPE_STRING),
                'file_name': openapi.Schema(type=openapi.TYPE_STRING)
            },
            required=['csv_file', 'file_name']
        ),
        responses={200: "Task started"}
    )
    @action(detail=False, methods=['post'])
    def bulk_register_users(self, request):
        """Register multiple users from a CSV file with batch processing"""
        try:
            csv_file = request.data.get('csv_file', '')
            file_name = request.data.get('file_name', 'bulk_upload.csv')
            if not csv_file:
                return Response({'error': 'CSV file is required'}, status=status.HTTP_400_BAD_REQUEST)

            # Create task record
            task = BulkUploadTask.objects.create(
                file_name=file_name,
                created_by=request.user if request.user.is_authenticated else None
            )

            try:
                # Try different encodings in order of likelihood
                encodings = ['utf-8', 'utf-8-sig', 'latin1', 'iso-8859-1', 'cp1252']
                csv_data = None
                
                for encoding in encodings:
                    try:
                        csv_data = base64.b64decode(csv_file).decode(encoding)
                        # Validate CSV structure
                        csv_reader = csv.reader(io.StringIO(csv_data))
                        header = next(csv_reader)  # Read header to validate structure
                        if not all(field in header for field in ['email', 'username']):
                            continue
                        break
                    except Exception:
                        continue
                
                if csv_data is None:
                    task.status = 'FAILED'
                    task.errors.append('Invalid CSV file format or encoding')
                    task.save()
                    return Response({'error': 'Invalid CSV file format or encoding'}, status=status.HTTP_400_BAD_REQUEST)

            except Exception as e:
                task.status = 'FAILED'
                task.errors.append(f'Error processing CSV file: {str(e)}')
                task.save()
                return Response({'error': f'Error processing CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

            # Start background task
            logger.info(f"Queuing bulk upload task {task.id}")
            process_bulk_upload.apply_async(
                args=[task.id, csv_data],
                task_id=str(task.id),
                countdown=1  # Start after 1 second to ensure the response is sent first
            )

            return Response({
                'task_id': task.id,
                'message': 'Bulk registration started'
            })

        except Exception as e:
            logger.error(f"Error starting bulk upload: {str(e)}")
            return Response(
                {'error': f'Error processing CSV file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get bulk registration progress",
        responses={200: "Progress information"}
    )
    @action(detail=False, methods=['get'])
    def bulk_register_progress(self, request):
        """Get the progress of ongoing bulk registration"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            progress = int(task.processed_users * 100 / task.total_users) if task.total_users > 0 else 0
            
            return Response({
                'status': task.status.lower(),
                'progress': progress,
                'total': task.total_users,
                'processed': task.processed_users
            })
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'No such task found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get bulk registration results",
        responses={200: "Registration results"}
    )
    @action(detail=False, methods=['get'])
    def bulk_register_results(self, request):
        """Get the results of a completed bulk registration"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            if task.status != 'COMPLETED':
                return Response({'error': 'Task not completed yet'}, status=status.HTTP_400_BAD_REQUEST)

            # Get created users from BulkUploadTaskUser model
            task_users = BulkUploadTaskUser.objects.filter(task=task)
            created_users = [
                {
                    'email': user.email,
                    'username': user.username,
                    'password': user.password,
                    'name': user.name or ''
                } for user in task_users
            ]

            return Response({
                'status': task.status.lower(),
                'total': task.total_users,
                'processed': task.processed_users,
                'created_users': created_users,
                'errors': task.errors
            })
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'No such task found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get user details",
        responses={200: AdminUserSerializer()}
    )
    @action(detail=True, methods=['get'])
    def user_details(self, request, pk=None):
        """Get detailed information about a user"""
        try:
            user = User.objects.get(id=pk)
            serializer = AdminUserSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    @swagger_auto_schema(
        methods=['put', 'patch'],
        operation_description="Update user details",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'email': openapi.Schema(type=openapi.TYPE_STRING),
                'username': openapi.Schema(type=openapi.TYPE_STRING),
                'first_name': openapi.Schema(type=openapi.TYPE_STRING),
                'last_name': openapi.Schema(type=openapi.TYPE_STRING),
                'bio': openapi.Schema(type=openapi.TYPE_STRING),
                'is_active': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                'is_staff': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                'is_superuser': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                'account_privacy': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    enum=['PUBLIC', 'PRIVATE']
                ),
                'social_links': openapi.Schema(type=openapi.TYPE_OBJECT),
                'notification_preferences': openapi.Schema(type=openapi.TYPE_OBJECT)
            }
        ),
        responses={200: AdminUserSerializer()}
    )
    @action(detail=True, methods=['put', 'patch'])
    def update_user(self, request, pk=None):
        """Update user details"""
        try:
            user = User.objects.get(id=pk)
            
            # Handle password update if provided
            password = request.data.pop('password', None)
            if password:
                user.set_password(password)
            
            # Remove avatar from request data if present (it should be updated through the avatar endpoint)
            if 'avatar' in request.data:
                del request.data['avatar']
            
            # Update user fields
            serializer = AdminUserSerializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                # If email is being updated, verify it since it's done by admin
                if 'email' in request.data:
                    user.email_verified = True
                
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Update user avatar",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'avatar': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Base64 encoded image file'
                ),
                'file_name': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Original file name with extension'
                )
            },
            required=['avatar', 'file_name']
        ),
        responses={200: AdminUserSerializer()}
    )
    @action(detail=True, methods=['post'])
    def update_avatar(self, request, pk=None):
        """Update user's avatar"""
        try:
            user = User.objects.get(id=pk)
            
            # Get avatar data
            avatar_data = request.data.get('avatar')
            file_name = request.data.get('file_name')
            
            if not avatar_data or not file_name:
                return Response(
                    {'error': 'Both avatar and file_name are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                # Decode base64 image
                format, imgstr = avatar_data.split(';base64,')
                ext = file_name.split('.')[-1]
                
                # Generate unique filename
                file_name = f"{uuid.uuid4()}.{ext}"
                
                # Convert base64 to file
                data = ContentFile(base64.b64decode(imgstr))
                
                # Delete old avatar if exists
                if user.avatar:
                    user.avatar.delete(save=False)
                
                # Save new avatar
                user.avatar.save(file_name, data, save=True)
                
                return Response(AdminUserSerializer(user).data)
                
            except Exception as e:
                return Response(
                    {'error': f'Error processing avatar: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        methods=['delete'],
        operation_description="Remove user avatar",
        responses={200: AdminUserSerializer()}
    )
    @action(detail=True, methods=['delete'])
    def remove_avatar(self, request, pk=None):
        """Remove user's avatar"""
        try:
            user = User.objects.get(id=pk)
            
            if user.avatar:
                user.avatar.delete(save=True)
            
            return Response(AdminUserSerializer(user).data)
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        methods=['delete'],
        operation_description="Delete user",
        responses={204: 'No Content'}
    )
    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        """Delete a user"""
        try:
            user = User.objects.get(id=pk)
            user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get list of users",
        responses={200: AdminUserSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def user_list(self, request):
        """Get list of all users"""
        try:
            users = User.objects.all().order_by('-date_joined')
            page = self.paginate_queryset(users)
            serializer = AdminUserSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Download bulk registration results as CSV",
        responses={
            200: openapi.Response(
                description="CSV file with registration results",
                schema=openapi.Schema(type=openapi.TYPE_FILE)
            )
        }
    )
    @action(detail=False, methods=['get'])
    def bulk_register_download(self, request):
        """Download the results of a completed bulk registration as CSV"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            if task.status != 'COMPLETED':
                return Response({'error': 'Task not completed yet'}, status=status.HTTP_400_BAD_REQUEST)

            # Get users from BulkUploadTaskUser model
            task_users = BulkUploadTaskUser.objects.filter(task=task)

            # Create CSV file
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Email', 'Username', 'Password', 'Name'])  # CSV header

            for user in task_users:
                writer.writerow([user.email, user.username, user.password, user.name or ''])

            output.seek(0)
            response = HttpResponse(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="bulk_registration_results_{task_id}.csv"'
            return response
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'No such task found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get users for a specific bulk upload task",
        responses={200: "List of users for the task"}
    )
    @action(detail=False, methods=['get'])
    def bulk_task_users(self, request):
        """Get users for a specific bulk upload task with pagination"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            
            # Get users from BulkUploadTaskUser model with pagination
            task_users = BulkUploadTaskUser.objects.select_related('user').filter(task=task).order_by('-created_at')
            
            # Get task info
            task_serializer = BulkUploadTaskSerializer(task)
            
            # Use pagination
            page = self.paginate_queryset(task_users)
            serializer = BulkUploadTaskUserSerializer(page, many=True)
            
            # Create response data
            response_data = {
                'count': task_users.count(),
                'next': None,  # Will be set by pagination
                'previous': None,  # Will be set by pagination
                'results': {
                    'task': task_serializer.data,
                    'users': [{
                        'id': user['id'],
                        'username': user['username'],
                        'email': user['email'],
                        'password': user['password'],
                        'name': user['name'],
                        'created_at': user['created_at'],
                        'user_details': user['user_details']
                    } for user in serializer.data],
                    'progress': int(task.processed_users * 100 / task.total_users) if task.total_users > 0 else 0
                }
            }
            
            # Get pagination data
            paginator_response = self.get_paginated_response(serializer.data)
            response_data['next'] = paginator_response.data.get('next')
            response_data['previous'] = paginator_response.data.get('previous')
            
            return Response(response_data)
            
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'No such task found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error fetching bulk task users: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Stop processing a bulk upload task",
        responses={200: "Task stopped successfully"}
    )
    @action(detail=False, methods=['post'])
    def stop_bulk_task_processing(self, request):
        """Stop processing a bulk upload task"""
        task_id = request.query_params.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            task = BulkUploadTask.objects.get(id=task_id)
            if task.status.lower() == 'processing':
                # Update task status
                task.status = 'STOPPED'
                task.errors.append('Processing stopped manually by admin')
                task.save()
                
                # Revoke Celery task
                logger.info(f"Revoking Celery task for bulk upload {task_id}")
                celery_app.control.revoke(str(task_id), terminate=True)
                
                return Response({'message': 'Task processing stopped'})
            else:
                return Response(
                    {'error': 'Task is not in processing state'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except BulkUploadTask.DoesNotExist:
            return Response(
                {'error': 'No such task found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error stopping bulk task: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get list of posts with filtering",
        manual_parameters=[
            openapi.Parameter(
                'user_id', 
                openapi.IN_QUERY,
                description="Filter by user ID",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'start_date', 
                openapi.IN_QUERY,
                description="Filter posts created after this date (YYYY-MM-DD)",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'end_date', 
                openapi.IN_QUERY,
                description="Filter posts created before this date (YYYY-MM-DD)",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'status', 
                openapi.IN_QUERY,
                description="Filter by post status",
                type=openapi.TYPE_STRING,
                enum=['published', 'draft', 'archived'],
                required=False
            ),
            openapi.Parameter(
                'search', 
                openapi.IN_QUERY,
                description="Search in post title and content",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'has_reports', 
                openapi.IN_QUERY,
                description="Filter posts that have reports",
                type=openapi.TYPE_BOOLEAN,
                required=False
            ),
        ],
        responses={200: AdminPostSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def post_list(self, request):
        """Get list of all posts with filtering options"""
        try:
            queryset = Post.objects.select_related('author').prefetch_related('reports')

            # Apply filters
            user_id = request.query_params.get('user_id')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            status = request.query_params.get('status')
            search = request.query_params.get('search')
            has_reports = request.query_params.get('has_reports')

            if user_id:
                queryset = queryset.filter(author_id=user_id)
            if start_date:
                queryset = queryset.filter(created_at__gte=start_date)
            if end_date:
                queryset = queryset.filter(created_at__lte=end_date)
            if status:
                queryset = queryset.filter(status=status)
            if search:
                queryset = queryset.filter(
                    Q(title__icontains=search) | 
                    Q(content__icontains=search)
                )
            if has_reports and has_reports.lower() == 'true':
                queryset = queryset.filter(reports__isnull=False).distinct()

            # Order by most recent first
            queryset = queryset.order_by('-created_at')

            # Paginate results
            page = self.paginate_queryset(queryset)
            serializer = AdminPostSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get post details",
        responses={200: AdminPostSerializer()}
    )
    @action(detail=True, methods=['get'])
    def post_details(self, request, pk=None):
        """Get detailed information about a post"""
        try:
            post = Post.objects.select_related('author').prefetch_related('reports').get(id=pk)
            serializer = AdminPostSerializer(post)
            return Response(serializer.data)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    @swagger_auto_schema(
        methods=['delete'],
        operation_description="Delete post",
        responses={204: 'No Content'}
    )
    @action(detail=True, methods=['delete'])
    def delete_post(self, request, pk=None):
        """Delete a post"""
        try:
            post = Post.objects.get(id=pk)
            post.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Bulk delete posts",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'post_ids': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(type=openapi.TYPE_STRING)
                )
            },
            required=['post_ids']
        ),
        responses={204: 'No Content'}
    )
    @action(detail=False, methods=['post'])
    def bulk_delete_posts(self, request):
        """Delete multiple posts at once"""
        post_ids = request.data.get('post_ids', [])
        if not post_ids:
            return Response(
                {'error': 'No post IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Delete posts in batches to avoid memory issues
            batch_size = 100
            for i in range(0, len(post_ids), batch_size):
                batch = post_ids[i:i + batch_size]
                Post.objects.filter(id__in=batch).delete()

            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get post statistics",
        manual_parameters=[
            openapi.Parameter(
                'start_date', 
                openapi.IN_QUERY,
                description="Start date for stats (YYYY-MM-DD)",
                type=openapi.TYPE_STRING,
                required=False
            ),
            openapi.Parameter(
                'end_date', 
                openapi.IN_QUERY,
                description="End date for stats (YYYY-MM-DD)",
                type=openapi.TYPE_STRING,
                required=False
            ),
        ],
        responses={200: "Post statistics"}
    )
    @action(detail=False, methods=['get'])
    def post_stats(self, request):
        """Get statistics about posts"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = (timezone.now() - timedelta(days=30)).date()
        else:
            try:
                start_date = timezone.datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid start_date format. Use YYYY-MM-DD"}, status=400)
        
        if not end_date:
            end_date = timezone.now().date()
        else:
            try:
                end_date = timezone.datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid end_date format. Use YYYY-MM-DD"}, status=400)
        
        # Get posts in date range
        posts = Post.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        )
        
        # Count by type
        post_types = posts.values('type').annotate(count=Count('id'))
        post_types_dict = {item['type']: item['count'] for item in post_types}
        
        # Posts by day
        posts_by_day = posts.annotate(
            day=TruncDay('created_at')
        ).values('day').annotate(count=Count('id')).order_by('day')
        
        # Engagement stats
        total_likes = sum(post.likes.count() for post in posts)
        total_comments = sum(post.comments.count() for post in posts)
        
        # Top authors
        top_authors = posts.values(
            'author__id', 
            'author__username', 
            'author__first_name', 
            'author__last_name'
        ).annotate(
            post_count=Count('id')
        ).order_by('-post_count')[:5]
        
        # Most liked posts
        most_liked_posts = sorted(
            [(post, post.likes.count()) for post in posts], 
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        most_liked_posts = [
            {
                'id': post.id,
                'title': post.title,
                'type': post.type,
                'likes_count': likes_count,
                'author': post.author.username
            }
            for post, likes_count in most_liked_posts
        ]
        
        # Most commented posts
        most_commented_posts = sorted(
            [(post, post.comments.count()) for post in posts], 
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        most_commented_posts = [
            {
                'id': post.id,
                'title': post.title,
                'type': post.type,
                'comments_count': comments_count,
                'author': post.author.username
            }
            for post, comments_count in most_commented_posts
        ]
        
        return Response({
            'total_posts': posts.count(),
            'post_types': post_types_dict,
            'posts_by_day': list(posts_by_day),
            'engagement': {
                'total_likes': total_likes,
                'total_comments': total_comments,
                'avg_likes_per_post': total_likes / posts.count() if posts.count() > 0 else 0,
                'avg_comments_per_post': total_comments / posts.count() if posts.count() > 0 else 0,
            },
            'top_authors': list(top_authors),
            'most_liked_posts': most_liked_posts,
            'most_commented_posts': most_commented_posts,
        })

class StaffManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [APIKeyPermission]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(
            Q(is_staff=True) | 
            Q(role__isnull=False)
        ).select_related('role')

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Assign role to user",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'role_type': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    enum=['SUPERUSER', 'ADMIN', 'MODERATOR']
                ),
                'permissions': openapi.Schema(
                    type=openapi.TYPE_OBJECT
                )
            },
            required=['role_type']
        ),
        responses={200: UserRoleSerializer()}
    )
    @action(detail=True, methods=['post'])
    def assign_role(self, request, pk=None):
        user = self.get_object()
        role_type = request.data.get('role_type')
        permissions = request.data.get('permissions', {})

        # Validate role assignment permissions
        if not request.user.is_superuser and role_type == 'SUPERUSER':
            return Response(
                {'error': 'Only superusers can assign superuser role'},
                status=status.HTTP_403_FORBIDDEN
            )

        role, created = UserRole.objects.update_or_create(
            user=user,
            defaults={
                'role_type': role_type,
                'permissions': permissions,
                'created_by': request.user
            }
        )

        # Update user staff status
        user.is_staff = True
        if role_type == 'SUPERUSER':
            user.is_superuser = True
        user.save()

        return Response(UserRoleSerializer(role).data)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Remove role from user",
        responses={204: 'No Content'}
    )
    @action(detail=True, methods=['post'])
    def remove_role(self, request, pk=None):
        user = self.get_object()
        
        # Can't remove superuser role unless you're a superuser
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {'error': 'Only superusers can remove superuser role'},
                status=status.HTTP_403_FORBIDDEN
            )

        UserRole.objects.filter(user=user).delete()
        user.is_staff = False
        user.is_superuser = False
        user.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

@celery_app.task(bind=True, name="admin_panel.process_bulk_upload", max_retries=3, ignore_result=False)
def process_bulk_upload(self, task_id, csv_data):
    """Process bulk upload in background with Celery"""
    logger.info(f"Starting bulk upload processing for task ID: {task_id}")
    try:
        task = BulkUploadTask.objects.get(id=task_id)
        
        # Read CSV file
        csv_file = io.StringIO(csv_data)
        reader = list(csv.DictReader(csv_file))
        
        # Update task with total count
        task.total_users = len(reader)
        task.save()
        
        # Validate CSV structure
        required_fields = {'name', 'email', 'username'}
        if not all(field in reader[0].keys() for field in required_fields):
            task.status = 'FAILED'
            task.errors.append(f'CSV must contain the following fields: {", ".join(required_fields)}')
            task.save()
            return
        
        # Process users in batches
        batch_size = 30  # Process 30 users at a time for faster processing
        for i in range(0, len(reader), batch_size):
            # Check if task was stopped
            task.refresh_from_db()
            if task.status == 'STOPPED':
                logger.info(f"Task {task_id} was manually stopped")
                return
                
            batch = reader[i:i + batch_size]
            batch_errors = []
            batch_users = []  # Store users to create in bulk
            batch_task_users = []  # Store BulkUploadTaskUser objects
            
            for row in batch:
                try:
                    # Clean input data
                    email = row['email'].strip()
                    username = row['username'].strip()
                    name = row['name'].strip()
                    
                    # Check if user already exists
                    if User.objects.filter(Q(email=email) | Q(username=username)).exists():
                        batch_errors.append(f"User with email {email} or username {username} already exists - skipped")
                        continue
                    
                    # Generate password
                    password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
                    
                    # Create user instance
                    user = User(
                        email=email,
                        username=username,
                        email_verified=True  # Set email as verified since it's added by admin
                    )
                    
                    # Set optional fields if provided
                    if 'bio' in row and row['bio'].strip():
                        user.bio = row['bio'].strip()
                    
                    # Handle name
                    name_parts = name.split(' ', 1)
                    user.first_name = name_parts[0]
                    if len(name_parts) > 1:
                        user.last_name = name_parts[1]
                    
                    # Set the password
                    user.set_password(password)
                    
                    batch_users.append(user)
                    batch_task_users.append(
                        BulkUploadTaskUser(
                            task=task,
                            email=email,
                            username=username,
                            password=password,  # Store plain password for admin reference
                            name=name
                        )
                    )
                    
                except Exception as e:
                    error_msg = f"Error creating user {row.get('email', 'unknown')}: {str(e)}"
                    logger.error(error_msg)
                    batch_errors.append(error_msg)
            
            try:
                # Bulk create users
                if batch_users:
                    created_users = User.objects.bulk_create(batch_users)
                    
                    # Update task users with created user references
                    for i, user in enumerate(created_users):
                        batch_task_users[i].user = user
                    
                    # Bulk create task users
                    BulkUploadTaskUser.objects.bulk_create(batch_task_users)
                    
                    # Update task progress
                    task.processed_users += len(created_users)
                    task.errors.extend(batch_errors)
                    task.save()
                    
                    # Log progress
                    progress = int(task.processed_users * 100 / task.total_users) if task.total_users > 0 else 0
                    logger.info(f"Task {task_id} progress: {progress}% ({task.processed_users}/{task.total_users})")
            except Exception as e:
                error_msg = f"Error in bulk creation: {str(e)}"
                logger.error(error_msg)
                batch_errors.append(error_msg)
                task.errors.extend(batch_errors)
                task.save()
        
        # Mark as complete if any users were processed
        if task.processed_users > 0:
            task.status = 'COMPLETED'
        else:
            task.status = 'FAILED'
            if not task.errors:
                task.errors.append('No users were processed successfully')
        task.save()
        logger.info(f"Task {task_id} completed with status {task.status}")
        
    except Exception as e:
        error_msg = f"Error processing bulk upload: {str(e)}"
        logger.error(error_msg)
        try:
            task = BulkUploadTask.objects.get(id=task_id)
            task.status = 'FAILED'
            task.errors.append(error_msg)
            task.save()
        except Exception as inner_e:
            logger.error(f"Failed to update task status: {str(inner_e)}")
        
        # Retry the task if appropriate
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task {task_id}, attempt {self.request.retries + 1}")
            raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
