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
    BulkUploadTaskSerializer, BulkUploadUserSerializer,
    AdminPostSerializer
)
from .permissions import IsSuperuserOrAdmin, IsModeratorOrAbove, APIKeyPermission
from django.db.models import Q, Count, OuterRef, Subquery, Sum, Avg
from django.db.models.functions import TruncDay, Greatest, Coalesce
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Case, When, Value, F
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
from .models import BulkUploadTask, BulkUploadUser
import logging
from django.http import HttpResponse
from celery import shared_task
from core.celery import app as celery_app
import threading
from django.db import transaction, DatabaseError, connection
from functools import wraps
import asyncio
import time
import concurrent.futures

# Set up logger
logger = logging.getLogger(__name__)

User = get_user_model()

def with_transaction(f):
    """Decorator to wrap a view method in a transaction with proper error handling"""
    @wraps(f)
    def wrapped(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return f(self, request, *args, **kwargs)
        except DatabaseError as e:
            logger.error(f"Database error in {f.__name__}: {str(e)}", exc_info=True)
            return Response(
                {'error': f"Database error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"Error in {f.__name__}: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    return wrapped

def async_operation(f):
    """Decorator to run a method asynchronously using ThreadPoolExecutor"""
    @wraps(f)
    def wrapped(self, request, *args, **kwargs):
        # For delete operations and other write operations, use this
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
        try:
            future = executor.submit(f, self, request, *args, **kwargs)
            return future.result(timeout=10)  # 10 second timeout
        except concurrent.futures.TimeoutError:
            logger.warning(f"Async operation {f.__name__} is taking longer than expected")
            return Response(
                {'message': 'Operation started but taking longer than expected. Check status later.'},
                status=status.HTTP_202_ACCEPTED
            )
        except Exception as e:
            logger.error(f"Error in async operation {f.__name__}: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            executor.shutdown(wait=False)
    return wrapped

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
            task_users = BulkUploadUser.objects.filter(task=task)
            
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

            # Get created users from BulkUploadUser model
            task_users = BulkUploadUser.objects.filter(task=task)
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
    @with_transaction
    @async_operation
    def delete_user(self, request, pk=None):
        """Delete a user with proper transaction management"""
        try:
            # Check if user exists first to avoid acquiring lock unnecessarily
            if not User.objects.filter(id=pk).exists():
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Lock the user record to prevent concurrent modification
            with transaction.atomic():
                user = User.objects.select_for_update().get(id=pk)
                
                # Log the action before deletion
                logger.info(f"Admin deleting user {user.username} (ID: {user.id})")
                
                # Create moderator action record
                if hasattr(request.user, 'id'):
                    ModeratorAction.objects.create(
                        moderator=request.user,
                        action_type='USER_DELETE',
                        target_id=str(user.id),
                        target_type='USER',
                        details=f"Deleted user {user.username}"
                    )
                
                # Delete user - this will cascade to all related objects
                user_id = user.id
                username = user.username
                user.delete()
                
                # Log success
                logger.info(f"Successfully deleted user {username} (ID: {user_id})")
                
                # Return success
                return Response(status=status.HTTP_204_NO_CONTENT)
                
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting user {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': f"Failed to delete user: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

            # Get users from BulkUploadUser model
            task_users = BulkUploadUser.objects.filter(task=task)

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
            
            # Get users from BulkUploadUser model with pagination
            task_users = BulkUploadUser.objects.select_related('user').filter(task=task).order_by('-created_at')
            
            # Get task info
            task_serializer = BulkUploadTaskSerializer(task)
            
            # Use pagination
            page = self.paginate_queryset(task_users)
            serializer = BulkUploadUserSerializer(page, many=True)
            
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
    @with_transaction
    @async_operation
    def delete_post(self, request, pk=None):
        """Delete a post with proper transaction management"""
        try:
            # Check if post exists first to avoid acquiring lock unnecessarily
            if not Post.objects.filter(id=pk).exists():
                return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Lock the post record to prevent concurrent modification
            with transaction.atomic():
                post = Post.objects.select_for_update().get(id=pk)
                
                # Store info for logging
                post_id = post.id
                post_title = post.title
                author_id = post.author.id if post.author else None
                
                # Log the action before deletion
                logger.info(f"Admin deleting post {post_title} (ID: {post_id})")
                
                # Create moderator action record
                if hasattr(request.user, 'id'):
                    ModeratorAction.objects.create(
                        moderator=request.user,
                        action_type='POST_DELETE',
                        target_id=str(post_id),
                        target_type='POST',
                        details=f"Deleted post '{post_title}' by user ID {author_id}"
                    )
                
                # Delete post - this will cascade to all related objects
                post.delete()
                
                # Log success
                logger.info(f"Successfully deleted post {post_title} (ID: {post_id})")
                
                # Return success
                return Response(status=status.HTTP_204_NO_CONTENT)
                
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deleting post {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': f"Failed to delete post: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        responses={202: 'Accepted'}
    )
    @action(detail=False, methods=['post'])
    def bulk_delete_posts(self, request):
        """Delete multiple posts using background processing for better performance"""
        post_ids = request.data.get('post_ids', [])
        if not post_ids:
            return Response(
                {'error': 'No post IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Create a unique operation ID for tracking
            operation_id = str(uuid.uuid4())
            
            # Store the total number of posts for progress tracking
            total_posts = len(post_ids)
            cache.set(f"bulk_delete_{operation_id}_total", total_posts, 3600)
            cache.set(f"bulk_delete_{operation_id}_completed", 0, 3600)
            cache.set(f"bulk_delete_{operation_id}_status", "PROCESSING", 3600)
            
            # Start background task
            task = celery_app.send_task(
                'admin_panel.tasks.bulk_delete_posts', 
                args=[post_ids, operation_id, request.user.id if hasattr(request.user, 'id') else None]
            )
            
            return Response({
                'message': f'Bulk delete operation started with {total_posts} posts',
                'operation_id': operation_id,
                'task_id': task.id
            }, status=status.HTTP_202_ACCEPTED)
            
        except Exception as e:
            logger.error(f"Error starting bulk delete: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Check status of bulk delete operation",
        manual_parameters=[
            openapi.Parameter(
                'operation_id', 
                openapi.IN_QUERY,
                description="Operation ID returned when starting the bulk delete",
                type=openapi.TYPE_STRING,
                required=True
            ),
        ],
        responses={200: "Operation status"}
    )
    @action(detail=False, methods=['get'])
    def bulk_delete_status(self, request):
        """Get status of a bulk delete operation"""
        operation_id = request.query_params.get('operation_id')
        if not operation_id:
            return Response({'error': 'operation_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get progress from cache
            total = cache.get(f"bulk_delete_{operation_id}_total")
            completed = cache.get(f"bulk_delete_{operation_id}_completed")
            op_status = cache.get(f"bulk_delete_{operation_id}_status")
            errors = cache.get(f"bulk_delete_{operation_id}_errors", [])
            
            if total is None:
                return Response({'error': 'Operation not found or expired'}, status=status.HTTP_404_NOT_FOUND)
            
            progress = int((completed / total) * 100) if total > 0 else 0
            
            return Response({
                'operation_id': operation_id,
                'status': op_status,
                'progress': progress,
                'completed': completed,
                'total': total,
                'errors': errors
            })
            
        except Exception as e:
            logger.error(f"Error getting bulk delete status: {str(e)}", exc_info=True)
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
        from django.core.cache import cache
        import hashlib
        import json
        
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
        
        # Create cache key based on dates
        cache_key = f"post_stats_{start_date}_{end_date}"
        cached_result = cache.get(cache_key)
        
        if cached_result:
            logger.info(f"Returning cached post stats for {start_date} to {end_date}")
            return Response(cached_result)
        
        try:
            # Get posts in date range with optimized query
            posts_query = Post.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            )
            
            # Get the count without fetching all objects
            total_posts = posts_query.count()
            
            if total_posts == 0:
                logger.info(f"No posts found between {start_date} and {end_date}")
                empty_result = {
                    'total_posts': 0,
                    'post_types': {},
                    'posts_by_day': [],
                    'engagement': {
                        'total_likes': 0,
                        'total_comments': 0,
                        'avg_likes_per_post': 0,
                        'avg_comments_per_post': 0,
                    },
                    'top_authors': [],
                    'most_liked_posts': [],
                    'most_commented_posts': [],
                }
                # Cache the empty result for 1 hour
                cache.set(cache_key, empty_result, 3600)
                return Response(empty_result)
            
            # Count by type - database level aggregation
            post_types = posts_query.values('type').annotate(count=Count('id'))
            post_types_dict = {item['type']: item['count'] for item in post_types}
            
            # Posts by day - database level aggregation
            posts_by_day = posts_query.annotate(
                day=TruncDay('created_at')
            ).values('day').annotate(count=Count('id')).order_by('day')
            
            # Get engagement stats at database level instead of Python loop
            likes_count_subquery = PostInteraction.objects.filter(
                post=OuterRef('pk'),
                interaction_type='LIKE'
            ).values('post').annotate(count=Count('*')).values('count')
            
            comments_count_subquery = Comment.objects.filter(
                post=OuterRef('pk')
            ).values('post').annotate(count=Count('*')).values('count')
            
            engagement_stats = posts_query.annotate(
                likes_count=Coalesce(Subquery(likes_count_subquery), 0),
                comments_count=Coalesce(Subquery(comments_count_subquery), 0)
            ).aggregate(
                total_likes=Sum('likes_count'),
                total_comments=Sum('comments_count'),
                avg_likes=Avg('likes_count'),
                avg_comments=Avg('comments_count')
            )
            
            # Top authors - database level aggregation
            top_authors = posts_query.values(
                'author__id', 
                'author__username', 
                'author__first_name', 
                'author__last_name'
            ).annotate(
                post_count=Count('id')
            ).order_by('-post_count')[:5]
            
            # Most liked posts - use the annotated likes_count from above
            most_liked_posts = posts_query.annotate(
                likes_count=Coalesce(Subquery(likes_count_subquery), 0)
            ).order_by('-likes_count')[:5]
            
            most_liked_posts_data = [
                {
                    'id': post.id,
                    'title': post.title,
                    'type': post.type,
                    'likes_count': post.likes_count,
                    'author': post.author.username
                }
                for post in most_liked_posts
            ]
            
            # Most commented posts - use the annotated comments_count from above
            most_commented_posts = posts_query.annotate(
                comments_count=Coalesce(Subquery(comments_count_subquery), 0)
            ).order_by('-comments_count')[:5]
            
            most_commented_posts_data = [
                {
                    'id': post.id,
                    'title': post.title,
                    'type': post.type,
                    'comments_count': post.comments_count,
                    'author': post.author.username
                }
                for post in most_commented_posts
            ]
            
            result = {
                'total_posts': total_posts,
                'post_types': post_types_dict,
                'posts_by_day': list(posts_by_day),
                'engagement': {
                    'total_likes': engagement_stats['total_likes'] or 0,
                    'total_comments': engagement_stats['total_comments'] or 0,
                    'avg_likes_per_post': engagement_stats['avg_likes'] or 0,
                    'avg_comments_per_post': engagement_stats['avg_comments'] or 0,
                },
                'top_authors': list(top_authors),
                'most_liked_posts': most_liked_posts_data,
                'most_commented_posts': most_commented_posts_data,
            }
            
            # Cache the result for 30 minutes
            cache.set(cache_key, result, 30 * 60)
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error getting post stats: {str(e)}", exc_info=True)
            return Response(
                {'error': f"Error retrieving post statistics: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        methods=['get'],
        operation_description="Search for users and posts with advanced relevance scoring",
        manual_parameters=[
            openapi.Parameter(
                'q', 
                openapi.IN_QUERY,
                description="Search query",
                type=openapi.TYPE_STRING,
                required=True
            ),
            openapi.Parameter(
                'type', 
                openapi.IN_QUERY,
                description="Type of content to search for",
                type=openapi.TYPE_STRING,
                enum=['all', 'users', 'posts'],
                default='all'
            ),
        ],
        responses={
            200: openapi.Response(
                description="Search results",
                examples={
                    "application/json": {
                        "success": True,
                        "data": {
                            "users": [],
                            "posts": []
                        }
                    }
                }
            )
        }
    )
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Advanced search endpoint for admin panel with API key authentication"""
        try:
            query = request.GET.get('q', '').strip()
            search_type = request.GET.get('type', 'all').lower()
            use_simple_search = request.GET.get('simple', '').lower() == 'true'

            logger.info(f"Admin search request - query: {query}, type: {search_type}, use_simple_search: {use_simple_search}")

            if not query:
                logger.info("Empty query, returning empty results")
                return Response({
                    'success': True,
                    'data': {
                        'posts': [],
                        'users': []
                    }
                })

            results = {
                'posts': [],
                'users': []
            }

            # Import the SearchViewSet and simple_search function
            from search.views import SearchViewSet, simple_search
            search_viewset = SearchViewSet()
            search_viewset.request = request

            # Get users if requested
            if search_type in ['all', 'users']:
                try:
                    if use_simple_search:
                        # Use simple search directly
                        simple_user_results = simple_search(query, User, ['username', 'first_name', 'last_name', 'email', 'bio'], 40)
                        results['users'] = AdminUserSerializer(
                            simple_user_results,
                            many=True,
                            context={'request': request}
                        ).data
                    else:
                        # First try the advanced search from SearchViewSet
                        users_results = search_viewset._search_users(query)
                        # Convert to admin serializer format
                        user_ids = [user['id'] for user in users_results]
                        
                        if user_ids:
                            users = User.objects.filter(id__in=user_ids)
                            results['users'] = AdminUserSerializer(
                                users,
                                many=True,
                                context={'request': request}
                            ).data
                        
                        # Fallback to a basic search if we got no results
                        if not results['users']:
                            logger.info(f"No users found with advanced search, trying simple search for '{query}'")
                            simple_user_results = simple_search(query, User, ['username', 'first_name', 'last_name', 'email', 'bio'], 40)
                            results['users'] = AdminUserSerializer(
                                simple_user_results,
                                many=True,
                                context={'request': request}
                            ).data
                    
                    logger.info(f"Found {len(results['users'])} users")
                except Exception as e:
                    logger.error(f"Error searching users: {str(e)}", exc_info=True)

            # Get posts if requested
            if search_type in ['all', 'posts']:
                try:
                    if use_simple_search:
                        # Use simple search directly
                        simple_post_results = simple_search(query, Post, ['title', 'description', 'content'], 40)
                        results['posts'] = AdminPostSerializer(
                            simple_post_results,
                            many=True,
                            context={'request': request}
                        ).data
                    else:
                        # First try the advanced search from SearchViewSet
                        posts_results = search_viewset._search_posts(query)
                        # Convert to admin serializer format
                        post_ids = [post['id'] for post in posts_results]
                        
                        if post_ids:
                            posts = Post.objects.filter(id__in=post_ids)
                            results['posts'] = AdminPostSerializer(
                                posts,
                                many=True,
                                context={'request': request}
                            ).data
                        
                        # Fallback to a basic search if we got no results
                        if not results['posts']:
                            logger.info(f"No posts found with advanced search, trying simple search for '{query}'")
                            simple_post_results = simple_search(query, Post, ['title', 'description', 'content'], 40)
                            results['posts'] = AdminPostSerializer(
                                simple_post_results,
                                many=True,
                                context={'request': request}
                            ).data
                    
                    logger.info(f"Found {len(results['posts'])} posts")
                except Exception as e:
                    logger.error(f"Error searching posts: {str(e)}", exc_info=True)

            return Response({
                'success': True,
                'data': results
            })

        except Exception as e:
            logger.error(f"Admin search error: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': "An error occurred while searching",
                'data': {
                    'posts': [],
                    'users': []
                }
            }, status=500)

    @swagger_auto_schema(
        methods=['post'],
        operation_description="Create a post for any user",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'user_id': openapi.Schema(type=openapi.TYPE_STRING, description='ID of the user to create the post for'),
                'type': openapi.Schema(type=openapi.TYPE_STRING, enum=['NEWS', 'AUDIO'], description='Type of post'),
                'title': openapi.Schema(type=openapi.TYPE_STRING, description='Post title'),
                'description': openapi.Schema(type=openapi.TYPE_STRING, description='Post description'),
                'image': openapi.Schema(type=openapi.TYPE_STRING, description='Base64 encoded image file'),
                'audio_file': openapi.Schema(type=openapi.TYPE_STRING, description='Base64 encoded audio file (required for AUDIO posts)'),
                'file_name': openapi.Schema(type=openapi.TYPE_STRING, description='Original file name with extension'),
                'audio_file_name': openapi.Schema(type=openapi.TYPE_STRING, description='Original audio file name with extension')
            },
            required=['user_id', 'type', 'title', 'description']
        ),
        responses={201: AdminPostSerializer()}
    )
    @action(detail=False, methods=['post'])
    def create_post(self, request):
        """Create a post for any user"""
        try:
            # Get required fields
            user_id = request.data.get('user_id')
            post_type = request.data.get('type')
            title = request.data.get('title')
            description = request.data.get('description')
            
            # Validate required fields
            if not user_id:
                return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            if not post_type:
                return Response({'error': 'type is required'}, status=status.HTTP_400_BAD_REQUEST)
            if not title:
                return Response({'error': 'title is required'}, status=status.HTTP_400_BAD_REQUEST)
            if not description:
                return Response({'error': 'description is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the user
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Create post instance
            post = Post(
                author=user,
                type=post_type,
                title=title,
                description=description
            )
            
            # Handle image upload if provided
            image_data = request.data.get('image')
            file_name = request.data.get('file_name')
            
            if image_data and file_name:
                try:
                    # Decode base64 image
                    if ';base64,' in image_data:
                        format, imgstr = image_data.split(';base64,')
                        ext = file_name.split('.')[-1]
                        
                        # Generate unique filename
                        image_file_name = f"{uuid.uuid4()}.{ext}"
                        
                        # Convert base64 to file
                        data = ContentFile(base64.b64decode(imgstr))
                        
                        # Save image
                        post.image.save(image_file_name, data, save=False)
                except Exception as e:
                    return Response(
                        {'error': f'Error processing image: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Handle audio file upload for AUDIO posts
            if post_type == 'AUDIO':
                audio_data = request.data.get('audio_file')
                audio_file_name = request.data.get('audio_file_name')
                
                if not audio_data or not audio_file_name:
                    return Response(
                        {'error': 'audio_file and audio_file_name are required for AUDIO posts'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    # Decode base64 audio
                    if ';base64,' in audio_data:
                        format, audiostr = audio_data.split(';base64,')
                        ext = audio_file_name.split('.')[-1]
                        
                        # Generate unique filename
                        audio_file_name = f"{uuid.uuid4()}.{ext}"
                        
                        # Convert base64 to file
                        data = ContentFile(base64.b64decode(audiostr))
                        
                        # Save audio file
                        post.audio_file.save(audio_file_name, data, save=False)
                except Exception as e:
                    return Response(
                        {'error': f'Error processing audio file: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Save the post
            post.save()
            
            # Log the action
            logger.info(f"Admin created post {post.id} for user {user.username}")
            
            # Return the serialized post
            serializer = AdminPostSerializer(post, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating post: {str(e)}")
            return Response(
                {'error': f'Error creating post: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
            batch_task_users = []  # Store BulkUploadUser objects
            
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
                        BulkUploadUser(
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
                    BulkUploadUser.objects.bulk_create(batch_task_users)
                    
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

class BulkUploadViewSet(viewsets.ViewSet):
    """ViewSet for handling bulk user uploads"""
    permission_classes = [APIKeyPermission]
    
    @swagger_auto_schema(
        methods=['post'],
        operation_description="Upload CSV file with user data",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'csv_file': openapi.Schema(type=openapi.TYPE_STRING, description='Base64 encoded CSV file'),
                'file_name': openapi.Schema(type=openapi.TYPE_STRING, description='Name of the file')
            },
            required=['csv_file', 'file_name']
        ),
        responses={200: BulkUploadTaskSerializer()}
    )
    @action(detail=False, methods=['post'])
    def upload_users(self, request):
        """Upload a CSV file with user data (name, username, email)"""
        try:
            csv_file = request.data.get('csv_file', '')
            file_name = request.data.get('file_name', 'users.csv')
            
            if not csv_file:
                return Response({'error': 'CSV file is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Create a new upload task
            task = BulkUploadTask.objects.create(
                file_name=file_name,
                status='WAITING'
            )
            
            try:
                # Decode the base64 CSV file
                csv_data = base64.b64decode(csv_file).decode('utf-8')
                
                # Parse CSV to count rows and validate structure
                csv_reader = csv.reader(io.StringIO(csv_data))
                header = next(csv_reader)  # Read header
                
                # Validate required columns
                required_columns = ['name', 'username', 'email']
                if not all(col in header for col in required_columns):
                    task.status = 'FAILED'
                    task.save()
                    return Response({
                        'error': f'CSV must contain columns: {", ".join(required_columns)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Count rows
                rows = list(csv_reader)
                task.total_rows = len(rows)
                task.save()
                
                # Start processing in background
                self._process_csv_in_background(task.id, csv_data)
                
                return Response(BulkUploadTaskSerializer(task).data)
                
            except Exception as e:
                task.status = 'FAILED'
                task.save()
                return Response({'error': f'Error processing CSV: {str(e)}'}, 
                               status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({'error': f'Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_csv_in_background(self, task_id, csv_data):
        """Start a background thread to process the CSV data"""
        thread = threading.Thread(target=self._process_csv_data, args=(task_id, csv_data))
        thread.daemon = True
        thread.start()
    
    def _process_csv_data(self, task_id, csv_data):
        """Process CSV data in a background thread"""
        try:
            # Get the task
            task = BulkUploadTask.objects.get(id=task_id)
            
            # Check if there are any tasks in processing state
            processing_tasks = BulkUploadTask.objects.filter(status='PROCESSING')
            if processing_tasks.exists() and task.id != processing_tasks.first().id:
                # Keep in waiting state, will be processed later
                return
            
            # Update task status to processing
            task.status = 'PROCESSING'
            task.save()
            
            # Parse CSV
            csv_file = io.StringIO(csv_data)
            reader = csv.DictReader(csv_file)
            rows = list(reader)
            
            # Process in batches of 20
            batch_size = 20
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i+batch_size]
                
                # Create threads for parallel processing
                threads = []
                for row in batch:
                    thread = threading.Thread(
                        target=self._process_user_row,
                        args=(task, row)
                    )
                    threads.append(thread)
                    thread.start()
                
                # Wait for all threads to complete
                for thread in threads:
                    thread.join()
                
                # Update processed count
                task.processed_rows += len(batch)
                task.save()
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.save()
            
            # Check if there are any waiting tasks and process the next one
            waiting_tasks = BulkUploadTask.objects.filter(status='WAITING').order_by('created_at')
            if waiting_tasks.exists():
                next_task = waiting_tasks.first()
                # We need to store the CSV data somewhere to process the next task
                # For now, we'll just mark it as failed
                next_task.status = 'FAILED'
                next_task.save()
                
        except Exception as e:
            logger.error(f"Error processing task {task_id}: {str(e)}")
            try:
                task = BulkUploadTask.objects.get(id=task_id)
                task.status = 'FAILED'
                task.save()
            except:
                pass
    
    def _process_user_row(self, task, row):
        """Process a single user row from the CSV"""
        try:
            # Clean input data
            email = row.get('email', '').strip()
            username = row.get('username', '').strip()
            name = row.get('name', '').strip()
            
            if not email or not username:
                return
            
            # Check if user already exists
            user_exists = User.objects.filter(Q(email=email) | Q(username=username)).exists()
            
            if user_exists:
                # User already exists, just record it
                BulkUploadUser.objects.create(
                    task=task,
                    username=username,
                    email=email,
                    name=name,
                    status='EXISTING'
                )
            else:
                # Generate a random password
                password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
                
                # Create the user
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password
                )
                
                # Set name if provided
                if name:
                    name_parts = name.split(' ', 1)
                    user.first_name = name_parts[0]
                    if len(name_parts) > 1:
                        user.last_name = name_parts[1]
                    user.save()
                
                # Record the user in our table
                BulkUploadUser.objects.create(
                    task=task,
                    username=username,
                    email=email,
                    name=name,
                    password=password,  # Store plain password for admin reference
                    status='CREATED'
                )
        except Exception as e:
            logger.error(f"Error processing user row: {str(e)}")
    
    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get upload task progress",
        responses={200: BulkUploadTaskSerializer()}
    )
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get the progress of a specific upload task"""
        try:
            task = BulkUploadTask.objects.get(id=pk)
            return Response(BulkUploadTaskSerializer(task).data)
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get all upload tasks",
        responses={200: BulkUploadTaskSerializer(many=True)}
    )
    @action(detail=False, methods=['get'])
    def tasks(self, request):
        """Get all upload tasks"""
        tasks = BulkUploadTask.objects.all()
        return Response(BulkUploadTaskSerializer(tasks, many=True).data)
    
    @swagger_auto_schema(
        methods=['get'],
        operation_description="Get users for a specific upload task",
        responses={200: BulkUploadUserSerializer(many=True)}
    )
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users for a specific upload task"""
        try:
            task = BulkUploadTask.objects.get(id=pk)
            users = BulkUploadUser.objects.filter(task=task)
            return Response(BulkUploadUserSerializer(users, many=True).data)
        except BulkUploadTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@celery_app.task(name="admin_panel.tasks.bulk_delete_posts", bind=True, max_retries=3)
def bulk_delete_posts(self, post_ids, operation_id, user_id=None):
    """Celery task to delete posts in bulk with proper error handling and progress tracking"""
    logger.info(f"Starting bulk delete of {len(post_ids)} posts")
    
    # Initialize counters
    total = len(post_ids)
    completed = 0
    errors = []
    
    # Get admin user if provided
    admin_user = None
    if user_id:
        try:
            admin_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.warning(f"Admin user {user_id} not found for logging")
    
    try:
        # Process in batches to avoid memory issues
        batch_size = 50
        for i in range(0, total, batch_size):
            batch = post_ids[i:i + min(batch_size, total - i)]
            
            # Process each post individually to handle errors gracefully
            for post_id in batch:
                try:
                    with transaction.atomic():
                        # Get post with lock
                        try:
                            post = Post.objects.select_for_update(nowait=True).get(id=post_id)
                        except Post.DoesNotExist:
                            errors.append(f"Post {post_id} not found")
                            continue
                        
                        # Create ModeratorAction
                        if admin_user:
                            ModeratorAction.objects.create(
                                moderator=admin_user,
                                action_type='POST_DELETE',
                                target_id=str(post.id),
                                target_type='POST',
                                details=f"Bulk deleted post '{post.title}'"
                            )
                        
                        # Delete the post
                        post.delete()
                        completed += 1
                        
                        # Update progress in cache
                        cache.set(f"bulk_delete_{operation_id}_completed", completed, 3600)
                        
                except Exception as e:
                    error_msg = f"Error deleting post {post_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            # Prevent transaction log buildup
            transaction.commit()
                
            # Sleep briefly to prevent database overload
            time.sleep(0.1)
    
    except Exception as e:
        logger.error(f"Bulk deletion failed: {str(e)}", exc_info=True)
        cache.set(f"bulk_delete_{operation_id}_status", "FAILED", 3600)
        cache.set(f"bulk_delete_{operation_id}_errors", [str(e)] + errors, 3600)
        raise
    
    # Update final status
    final_status = "COMPLETED" if completed == total else "COMPLETED_WITH_ERRORS"
    cache.set(f"bulk_delete_{operation_id}_status", final_status, 3600)
    if errors:
        cache.set(f"bulk_delete_{operation_id}_errors", errors, 3600)
    
    logger.info(f"Bulk delete completed: {completed}/{total} posts deleted")
    return {
        'status': final_status,
        'completed': completed,
        'total': total,
        'errors': errors
    }
