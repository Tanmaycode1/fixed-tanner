"""
Database-related decorators for views.
"""
import functools
import logging
from django.db import transaction
from core.db.routers import set_write_operation

logger = logging.getLogger(__name__)

def use_primary_database(view_func):
    """
    Decorator that forces a view to use the primary database.
    
    This is useful for views that require read-after-write consistency,
    or for views that perform writes but might be mistakenly routed to
    read-only replicas due to Django's connection handling.
    
    Example:
        @use_primary_database
        def my_view(request):
            # This view will always use the primary database
            pass
    """
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Set a flag on the request to use the primary database
        setattr(request, '_use_primary_db', True)
        
        # Also mark thread as having writes to maintain consistency
        # across the request lifecycle
        set_write_operation(True)
        
        # Run the view function inside a transaction to ensure
        # all database operations use the same connection
        with transaction.atomic():
            try:
                return view_func(request, *args, **kwargs)
            except Exception as e:
                # Check for read-only errors
                error_str = str(e)
                if "ReadOnlyError" in error_str or "You can't write against a read only replica" in error_str:
                    logger.warning(
                        "Caught ReadOnlyError in decorated view, retrying with stronger primary DB enforcement: %s",
                        error_str
                    )
                    # Setting this global option ensures all future database operations 
                    # use the primary database for the remainder of the process
                    from django.conf import settings
                    settings.REPLICA_FORCE_PRIMARY_DATABASE = True
                    
                    # Re-try the view function
                    return view_func(request, *args, **kwargs)
                else:
                    # Re-raise other exceptions
                    raise
            
    return wrapper

class UsePrimaryDatabaseMixin:
    """
    Class decorator/mixin to force all view methods to use the primary database.
    
    This mixin is particularly useful for ViewSets that need to ensure
    all operations go to the primary database to avoid ReadOnlyError.
    
    Example:
        class MyViewSet(UsePrimaryDatabaseMixin, viewsets.ModelViewSet):
            # All view methods will use the primary database
            pass
    """
    
    def dispatch(self, request, *args, **kwargs):
        # Set a flag on the request to use the primary database
        setattr(request, '_use_primary_db', True)
        
        # Mark thread as having writes
        set_write_operation(True)
        
        # Run the view function inside a transaction for consistency
        with transaction.atomic():
            try:
                return super().dispatch(request, *args, **kwargs)
            except Exception as e:
                # Check for read-only errors
                error_str = str(e)
                if "ReadOnlyError" in error_str or "You can't write against a read only replica" in error_str:
                    logger.warning(
                        "Caught ReadOnlyError in mixin, retrying with stronger primary DB enforcement: %s",
                        error_str
                    )
                    # Force primary DB globally
                    from django.conf import settings
                    settings.REPLICA_FORCE_PRIMARY_DATABASE = True
                    
                    # Re-try the request
                    return super().dispatch(request, *args, **kwargs)
                else:
                    # Re-raise other exceptions
                    raise 