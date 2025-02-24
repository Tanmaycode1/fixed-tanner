from django.core.management.base import BaseCommand
from core.utils.test_connections import test_db_connection, test_s3_connection

class Command(BaseCommand):
    help = 'Test AWS RDS and S3 connections'

    def handle(self, *args, **options):
        self.stdout.write('Testing connections...')
        
        if test_db_connection():
            self.stdout.write(self.style.SUCCESS('RDS Connection: SUCCESS ✅'))
        else:
            self.stdout.write(self.style.ERROR('RDS Connection: FAILED ❌'))
            
        if test_s3_connection():
            self.stdout.write(self.style.SUCCESS('S3 Connection: SUCCESS ✅'))
        else:
            self.stdout.write(self.style.ERROR('S3 Connection: FAILED ❌')) 