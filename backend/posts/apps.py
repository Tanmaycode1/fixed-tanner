from django.apps import AppConfig


class PostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'posts'
    
    def ready(self):
        """
        Run code when the posts app is ready.
        This is a good place to register signal handlers.
        """
        # Import signal handlers
        import posts.signals
        
        # Set up models that might not have been migrated yet
        from django.db import connection
        from django.db.utils import ProgrammingError, OperationalError
        
        # Check and potentially create Tag model if missing
        try:
            # Check if the model exists in the database
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM posts_tag LIMIT 1")
        except (ProgrammingError, OperationalError):
            # Table doesn't exist, we'll log this for admin awareness
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Posts Tag model may not be migrated yet. Run migrations to enable tag functionality.")
        
        # Check and potentially create UserContentPreference model if missing
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM posts_usercontentpreference LIMIT 1")
        except (ProgrammingError, OperationalError):
            # Table doesn't exist, we'll log this for admin awareness
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("UserContentPreference model may not be migrated yet. Run migrations to enable personalized feeds.")
            
        # Check and potentially create UserInterestGraph model if missing
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM posts_userinterestgraph LIMIT 1")
        except (ProgrammingError, OperationalError):
            # Table doesn't exist, we'll log this for admin awareness
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("UserInterestGraph model may not be migrated yet. Run migrations to enable advanced suggestions.")
