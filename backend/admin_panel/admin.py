from django.contrib import admin
from .models import BulkUploadTask, BulkUploadUser

@admin.register(BulkUploadTask)
class BulkUploadTaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'file_name', 'total_rows', 'processed_rows', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('file_name',)
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)

@admin.register(BulkUploadUser)
class BulkUploadUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'username', 'email', 'name', 'status', 'created_at')
    list_filter = ('created_at', 'task__status', 'status')
    search_fields = ('email', 'username', 'name')
    raw_id_fields = ('task',)
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task')

    def task_status(self, obj):
        return obj.task.status
    task_status.admin_order_field = 'task__status'
    task_status.short_description = 'Task Status'
