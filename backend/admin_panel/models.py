from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class BulkUploadTask(models.Model):
    """Model to track bulk user upload tasks"""
    STATUS_CHOICES = (
        ('WAITING', 'Waiting'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed')
    )

    id = models.AutoField(primary_key=True)
    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='WAITING')
    total_rows = models.IntegerField(default=0)
    processed_rows = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Upload Task {self.id} - {self.status}"
    
    @property
    def progress_percentage(self):
        """Calculate the percentage of processed rows"""
        if self.total_rows == 0:
            return 0
        return int((self.processed_rows / self.total_rows) * 100)

class BulkUploadUser(models.Model):
    """Model to store users created or identified during bulk upload"""
    STATUS_CHOICES = (
        ('CREATED', 'Created'),
        ('EXISTING', 'Already Exists')
    )
    
    task = models.ForeignKey(BulkUploadTask, on_delete=models.CASCADE, related_name='users')
    username = models.CharField(max_length=150)
    email = models.EmailField()
    name = models.CharField(max_length=255, blank=True)
    password = models.CharField(max_length=100, blank=True)  # Only stored for new users
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} - {self.task.id} - {self.status}"
