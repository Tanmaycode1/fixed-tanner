from django.db import connections
from django.db.utils import OperationalError
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

def test_db_connection():
    try:
        db_conn = connections['default']
        db_conn.cursor()
        logger.info("✅ Successfully connected to RDS database!")
        return True
    except OperationalError as e:
        logger.error(f"❌ Failed to connect to RDS: {str(e)}")
        return False

def test_s3_connection():
    try:
        s3 = boto3.client('s3')
        s3.head_bucket(Bucket='neuhu-storage')
        logger.info("✅ Successfully connected to S3 bucket!")
        return True
    except ClientError as e:
        logger.error(f"❌ Failed to connect to S3: {str(e)}")
        return False 