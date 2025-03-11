from django.contrib import admin
from .models import BulkUploadTask, BulkUploadTaskUser

@admin.register(BulkUploadTask)
class BulkUploadTaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'file_name', 'total_users', 'processed_users', 'created_at', 'created_by')
    list_filter = ('status', 'created_at')
    search_fields = ('file_name', 'created_by__username', 'created_by__email')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('created_by')

@admin.register(BulkUploadTaskUser)
class BulkUploadTaskUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'username', 'email', 'name', 'created_at')
    list_filter = ('created_at', 'task__status')
    search_fields = ('email', 'username', 'name')
    raw_id_fields = ('task', 'user')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task', 'user')

    def task_status(self, obj):
        return obj.task.status
    task_status.admin_order_field = 'task__status'
    task_status.short_description = 'Task Status'
