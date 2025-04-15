from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    
    def ready(self):
        """
        Initialize database timeouts when the application starts.
        This helps prevent WebSocket routing timeouts and hanging connections.
        """
        # Import and call the timeout setting function
        from core.db.routers import set_database_timeouts
        set_database_timeouts()
        
        # Let's also set a global variable to track if we're using Channels/ASGI
        import os
        os.environ.setdefault('USING_CHANNELS', 'True') 