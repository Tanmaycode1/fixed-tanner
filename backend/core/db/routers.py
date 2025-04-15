"""
Database routers to properly handle read/write operations with database replicas.
"""
import logging
import random
import threading
import sys
from django.conf import settings
from threading import local

logger = logging.getLogger(__name__)

# Thread-local storage for request context
_thread_local = local()

def get_current_request():
    """Get the current request from thread local storage."""
    return getattr(_thread_local, 'request', None)

def set_current_request(request):
    """Set the current request in thread local storage."""
    _thread_local.request = request

# Set to track write operations in the current thread
_write_operations = threading.local()

def set_write_operation(flag=True):
    """Mark that a write operation has occurred in this request cycle"""
    _write_operations.has_write = flag

def has_write_operation():
    """Check if a write operation has occurred in this request cycle"""
    return getattr(_write_operations, 'has_write', False)

def is_celery_worker():
    """Check if current process is a Celery worker"""
    # Check if running in a Celery worker process
    return 'celery' in sys.argv[0].lower() or any('celery' in arg.lower() for arg in sys.argv)

class PrimaryReplicaRouter:
    """
    A router that sends all write operations to the primary database and
    distributes read operations across replicas.
    
    This prevents the "ReadOnlyError: You can't write against a read only replica"
    error that can occur when write operations are mistakenly sent to replica databases.
    """
    
    def db_for_read(self, model, **hints):
        """
        For read operations, randomly select a database from all available databases.
        This allows load balancing across replicas.
        """
        # Check if running in a Celery task and should use primary
        if is_celery_worker() and getattr(settings, 'CELERY_TASK_DB_PRIMARY', False):
            logger.debug("Using primary database for Celery task read operation")
            return 'default'
            
        # Check if certain models should always use primary
        model_name = model.__name__.lower()
        sensitive_models = [
            'post', 'user', 'comment', 'notification', 'postinteraction', 
            'trendingscore', 'usercontentpreference', 'userinterestgraph'
        ]
        
        # Models that frequently experience read-after-write issues
        # should use primary for all operations
        if model_name in sensitive_models and hasattr(settings, 'DB_SENSITIVE_MODELS_USE_PRIMARY') and settings.DB_SENSITIVE_MODELS_USE_PRIMARY:
            return 'default'
        
        # Check if we should force the primary database
        request = get_current_request()
        if request and getattr(request, '_use_primary_db', False):
            logger.debug("Forcing read operation to primary database due to _use_primary_db flag")
            return 'default'
        
        # If there was a write operation in this thread, use primary for reads too
        # This avoids read-after-write inconsistency
        if has_write_operation():
            logger.debug("Using primary database for read after write operation")
            return 'default'
            
        # If the settings has a flag to force primary, use it
        if getattr(settings, 'REPLICA_FORCE_PRIMARY_DATABASE', False):
            return 'default'
        
        # Check for a hint about the request method
        if hints.get('request_method') in ['POST', 'PUT', 'PATCH', 'DELETE']:
            logger.debug("Using primary database for read in write-based request method")
            return 'default'
            
        # If the application has replica databases configured, use them
        available_dbs = list(settings.DATABASES.keys())
        
        # If there's a read operation that follows a write, keep using the primary
        if hints.get('instance') and not getattr(hints['instance'], '_state', None).adding:
            return 'default'
            
        if len(available_dbs) > 1:
            # If replicas are explicitly defined, prioritize them for reads
            replicas = [db for db in available_dbs if 'replica' in db]
            if replicas:
                return random.choice(replicas)
        
        # Default to the primary database if no replicas are configured
        return 'default'
    
    def db_for_write(self, model, **hints):
        """
        Always send write operations to the primary database.
        """
        # Mark that a write operation has occurred
        set_write_operation(True)
        
        # All writes should go to the primary database
        return 'default'
    
    def allow_relation(self, obj1, obj2, **hints):
        """
        Allow relations if both objects are using the same database or if
        either one is using the primary database.
        """
        # If we don't know the database, allow the relation by default
        if not hasattr(obj1, '_state') or not hasattr(obj2, '_state'):
            return True
            
        # Allow relations if both objects are from the same database
        if obj1._state.db == obj2._state.db:
            return True
        
        # Allow relations if either object is from the primary database
        if obj1._state.db == 'default' or obj2._state.db == 'default':
            return True
        
        return None
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        All migrations should be applied only to the primary database.
        """
        # Only run migrations on the primary database
        return db == 'default'

def set_database_timeouts():
    """
    Set reasonable timeouts for database operations to prevent hanging connections.
    This should be called during Django startup.
    """
    logger = logging.getLogger(__name__)
    
    from django.db import connections
    
    for connection in connections.all():
        try:
            with connection.cursor() as cursor:
                # Set a default statement timeout to prevent hanging queries
                # 10 seconds is a reasonable default for most operations
                cursor.execute("SET statement_timeout = '10000';")  # 10 seconds
        except Exception as e:
            # Log but don't crash if this fails
            logger.warning(f"Could not set timeout for connection {connection}: {e}") 