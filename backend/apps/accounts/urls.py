from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import StaffDirectoryView, StaffViewSet

router = DefaultRouter()
router.register("staff", StaffViewSet, basename="staff")

urlpatterns = [
    path("staff-directory/", StaffDirectoryView.as_view(), name="staff-directory"),
    *router.urls,
]
