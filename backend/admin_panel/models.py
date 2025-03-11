from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class BulkUploadTask(models.Model):
    STATUS_CHOICES = (
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('DELETED', 'Deleted'),
        ('STOPPED', 'Stopped')
    )

    id = models.AutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PROCESSING')
    total_users = models.IntegerField(default=0)
    processed_users = models.IntegerField(default=0)
    created_users = models.JSONField(default=list)  # Store list of created users with their credentials
    errors = models.JSONField(default=list)  # Store list of errors
    file_name = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bulk Upload {self.id} - {self.status}"

class BulkUploadTaskUser(models.Model):
    task = models.ForeignKey(BulkUploadTask, on_delete=models.CASCADE, related_name='users')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_uploads')
    email = models.EmailField()
    username = models.CharField(max_length=150)
    password = models.CharField(max_length=100)
    name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('task', 'user')
        
    def __str__(self):
        return f"{self.username} - {self.task.id}"
