import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Configure Celery for better task handling
app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,  # Tasks are acknowledged after execution (better for retries)
    worker_prefetch_multiplier=1,  # Don't prefetch more than one task at a time
    
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    
    # Retry settings
    task_publish_retry=True,
    task_publish_retry_policy={
        'max_retries': 3,
        'interval_start': 0,
        'interval_step': 0.2,
        'interval_max': 0.5,
    },
    
    # Periodic task schedule
    beat_schedule={
        # Feed related periodic tasks
        'update-trending-scores': {
            'task': 'posts.tasks.update_trending_scores',
            'schedule': crontab(minute='0', hour='*/3'),  # Every 3 hours
            'args': (500, 10000),  # batch_size, max_posts
            'options': {'expires': 3600},
        },
        'update-user-preferences': {
            'task': 'posts.tasks.update_user_preferences',
            'schedule': crontab(minute='0', hour='*/12'),  # Twice daily
            'args': (100, 10000),  # batch_size, max_users
            'options': {'expires': 7200},
        },
        'update-user-interest-graphs': {
            'task': 'posts.tasks.update_user_interest_graphs',
            'schedule': crontab(minute='0', hour='0'),  # Once daily at midnight
            'args': (50, 1000),  # batch_size, max_users
            'options': {'expires': 10800},
        },
    }
)

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')