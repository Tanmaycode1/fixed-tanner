"""
Middleware for handling various application-specific issues
"""
import logging
from django.db import transaction
from django.conf import settings
from django.db.models.sql import compiler
from core.db.routers import set_current_request, get_current_request, set_write_operation

logger = logging.getLogger(__name__)

# Patch the SQL compiler to include request method in hints
original_execute_sql = compiler.SQLCompiler.execute_sql

def patched_execute_sql(self, *args, **kwargs):
    request = get_current_request()
    if request and hasattr(self, 'query') and hasattr(self.query, 'model'):
        # Add request method to the hints
        if 'hints' not in kwargs:
            kwargs['hints'] = {}
        kwargs['hints']['request_method'] = request.method
    return original_execute_sql(self, *args, **kwargs)

# Apply the patch
compiler.SQLCompiler.execute_sql = patched_execute_sql

class ThreadLocalRequestMiddleware:
    """
    Middleware that stores the request in thread-local storage.
    This allows the database router to access the current request.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Store the request in thread-local storage
        previous_request = get_current_request()
        set_current_request(request)
        
        # Reset write operations flag for this thread
        set_write_operation(False)
        
        # If this is a write request method, we should use primary database
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Mark this thread as having done a write
            set_write_operation(True)
            # Also set the flag on the request
            setattr(request, '_use_primary_db', True)
        
        try:
            response = self.get_response(request)
            return response
        finally:
            # Reset the thread-local storage to the previous request (or None)
            set_current_request(previous_request)


class ReadOnlyDbErrorMiddleware:
    """
    Middleware to handle ReadOnlyError by forcing operations to use the primary database.
    
    This middleware catches ReadOnlyError exceptions that occur when a write operation
    is attempted on a read-only replica, and retries the operation on the primary database.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # We need to handle potential read-only errors in the database
        try:
            with transaction.atomic():
                response = self.get_response(request)
                return response
                
        except Exception as e:
            error_str = str(e)
            # Check if this is a read-only error
            if "ReadOnlyError" in error_str or "You can't write against a read only replica" in error_str:
                logger.warning(
                    "Caught ReadOnlyError, retrying request with primary database: %s", 
                    error_str
                )
                
                # Set a flag to use primary database for this request
                # This works with our custom router to force writing to primary
                setattr(request, '_use_primary_db', True)
                
                # Also set globally for the thread
                set_write_operation(True)
                
                # Retry the request
                try:
                    response = self.get_response(request)
                    return response
                except Exception as retry_error:
                    logger.error(
                        "Still failed after retrying on primary database: %s", 
                        str(retry_error)
                    )
                    raise
            else:
                # Not a read-only error, re-raise
                raise 