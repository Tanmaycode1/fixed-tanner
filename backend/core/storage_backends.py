from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class StaticStorage(S3Boto3Storage):
    """
    Storage for static files.
    """
    location = settings.AWS_STATIC_LOCATION
    file_overwrite = True  # For static files, we want to overwrite
    default_acl = None  # Don't set ACL, use bucket defaults
    querystring_auth = False  # Don't add auth tokens to URLs
    
    def _get_security_token(self):
        # Fix for the issue with HeadObject operation
        return None


class MediaStorage(S3Boto3Storage):
    """
    Storage for user-uploaded files.
    """
    location = ''  # No location prefix needed, paths are already structured in the upload handlers
    file_overwrite = False  # Don't overwrite media files with the same name
    default_acl = None  # Don't set ACL, use bucket defaults
    querystring_auth = False  # Don't add auth tokens to URLs
    
    def _get_security_token(self):
        # Fix for the issue with HeadObject operation
        return None 