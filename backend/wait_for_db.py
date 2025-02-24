import os
import time
import psycopg2

def wait_for_db():
    """Wait for database to be available"""
    print("Waiting for database...")
    while True:
        try:
            psycopg2.connect(
                dbname=os.environ.get('POSTGRES_DB'),
                user=os.environ.get('POSTGRES_USER'),
                password=os.environ.get('POSTGRES_PASSWORD'),
                host=os.environ.get('POSTGRES_HOST'),
                port=os.environ.get('POSTGRES_PORT', 5432)
            )
            break
        except psycopg2.OperationalError:
            print("Database unavailable, waiting 1 second...")
            time.sleep(1)
    print("Database available!")

if __name__ == "__main__":
    wait_for_db() 