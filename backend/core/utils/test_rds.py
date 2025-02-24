import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initial connection parameters (without specific database)
INITIAL_DB_PARAMS = {
    'user': 'postgres',
    'password': 'neuhu-db1234',
    'host': 'neuhu-db.cl2iee4myu5i.us-east-1.rds.amazonaws.com',
    'port': '5432'
}

# Final database parameters
DB_PARAMS = {
    **INITIAL_DB_PARAMS,
    'dbname': 'neuhu'
}

def create_database():
    try:
        # Connect to default postgres database first
        logger.info("Connecting to default postgres database...")
        conn = psycopg2.connect(**INITIAL_DB_PARAMS, dbname='postgres')
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if our database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'neuhu'")
        exists = cursor.fetchone()
        
        if not exists:
            logger.info("Creating database 'neuhu'...")
            cursor.execute('CREATE DATABASE neuhu')
            logger.info("Database created successfully!")
        else:
            logger.info("Database 'neuhu' already exists")
            
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"Failed to create database: {str(e)}")
        return False

def test_rds_connection():
    try:
        # First create database if it doesn't exist
        if not create_database():
            return False
            
        # Now connect to our database
        logger.info("Attempting to connect to neuhu database...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create a test table
        logger.info("Creating test table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_connection (
                id SERIAL PRIMARY KEY,
                test_column VARCHAR(50)
            );
        """)
        
        # Insert a test record
        logger.info("Inserting test data...")
        cursor.execute("""
            INSERT INTO test_connection (test_column)
            VALUES ('Test Successful');
        """)
        
        # Verify the data
        logger.info("Verifying inserted data...")
        cursor.execute("SELECT * FROM test_connection;")
        result = cursor.fetchone()
        logger.info(f"Retrieved data: {result}")
        
        # Drop the test table
        logger.info("Cleaning up - dropping test table...")
        cursor.execute("DROP TABLE test_connection;")
        
        # Close connection
        cursor.close()
        conn.close()
        
        logger.info("✅ RDS Connection test successful!")
        return True
        
    except Exception as e:
        logger.error(f"❌ RDS Connection test failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_rds_connection() 