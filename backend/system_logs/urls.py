from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'logs', views.LogViewSet, basename='logs')
router.register(r'roles', views.UserRoleViewSet, basename='roles')
router.register(r'moderator-actions', views.ModeratorActionViewSet, basename='moderator-actions')

urlpatterns = [
    path('', include(router.urls)),
] 