#!/bin/bash
set -e

# Run the entrypoint script to set up environment
source /app/entrypoint.sh

# Start Daphne with reload flag
exec watchmedo auto-restart --directory=/app --pattern="*.py" --recursive -- daphne -v2 -b 0.0.0.0 -p 8000 core.asgi:application