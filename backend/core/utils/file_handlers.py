import os
from uuid import uuid4
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

def handle_uploaded_file(file, directory='uploads', is_image=True, max_size=5*1024*1024):
    """
    Handle file upload with image processing and validation
    
    Args:
        file: The uploaded file
        directory: Target directory within media storage
        is_image: Whether to process as image
        max_size: Maximum file size in bytes (default 5MB)
    """
    try:
        # Validate file size
        if file.size > max_size:
            raise ValueError(f"File size too large. Maximum size is {max_size/1024/1024}MB")

        # Generate unique filename
        ext = os.path.splitext(file.name)[1].lower()
        filename = f"{uuid4().hex}{ext}"
        
        # Full path including directory
        file_path = f"{directory}/{filename}"

        if is_image:
            # Process image
            img = Image.open(file)
            
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too large (max 1000x1000)
            if img.height > 1000 or img.width > 1000:
                output_size = (1000, 1000)
                img.thumbnail(output_size)
            
            # Save to BytesIO
            img_io = BytesIO()
            img.save(img_io, format='JPEG', quality=85)
            img_io.seek(0)
            
            # Save using default storage
            saved_path = default_storage.save(file_path, ContentFile(img_io.getvalue()))
        else:
            # Save non-image file directly
            saved_path = default_storage.save(file_path, file)

        return saved_path

    except Exception as e:
        logger.error(f"Error handling uploaded file: {str(e)}")
        raise 