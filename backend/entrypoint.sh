#!/bin/bash
set -e

# Create necessary directories
mkdir -p /app/staticfiles/admin/js
mkdir -p /app/media/audio
mkdir -p /app/media/avatars
mkdir -p /app/static
mkdir -p /app/migrations

# Set permissions
chmod -R 755 /app/staticfiles
chmod -R 755 /app/media
chmod -R 755 /app/static

wait_for_service() {
    local host="$1"
    local port="$2"
    local service="$3"
    
    echo "Waiting for $service..."
    while ! nc -z "$host" "$port"; do
        echo "Waiting for $service at $host:$port..."
        sleep 1
    done
    echo "$service is up!"
}

# Debug information
echo "Current directory: $(pwd)"
echo "Python path: $PYTHONPATH"
echo "Django settings module: $DJANGO_SETTINGS_MODULE"
ls -la /app/core/

# Wait for essential services
wait_for_service db 5432 "PostgreSQL"
wait_for_service redis 6379 "Redis"

# Wait for database (use wait_for_db.py if it exists, otherwise use wait_for_service)
if [ -f "wait_for_db.py" ]; then
    python wait_for_db.py
else
    echo "wait_for_db.py not found, using basic check"
    wait_for_service db 5432 "Database"
fi

# Download NLTK data required for advanced search
python -m nltk.downloader punkt stopwords wordnet

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser if needed
python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin');
    print('Superuser created.');
else:
    print('Superuser already exists.');
"

# Start Daphne with debug logging
exec daphne -v2 -b 0.0.0.0 -p 8000 core.asgi:application