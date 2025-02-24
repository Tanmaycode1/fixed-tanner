FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND noninteractive
ENV PYTHONPATH=/app:$PYTHONPATH
ENV DJANGO_SETTINGS_MODULE=core.settings

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    python3-dev \
    ffmpeg \
    libmagic1 \
    gcc \
    g++ \
    make \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install channels==3.0.5 channels-redis==3.4.1 daphne==3.0.2

# Copy scripts
COPY entrypoint.sh run-dev.sh ./
RUN chmod +x entrypoint.sh run-dev.sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/staticfiles/admin/js \
    && mkdir -p /app/media/audio \
    && mkdir -p /app/media/avatars \
    && mkdir -p /app/static \
    && chmod -R 755 /app/staticfiles \
    && chmod -R 755 /app/media \
    && chmod -R 755 /app/static

# Copy the rest of the application
COPY . .

# Verify core module structure
RUN python -c "import core; print('Core module found')"

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]