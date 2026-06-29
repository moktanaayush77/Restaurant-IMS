from django.urls import path

from .views import BrandingView, HealthView, RestaurantSettingsView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("branding/", BrandingView.as_view(), name="branding"),
    path("settings/", RestaurantSettingsView.as_view(), name="settings"),
]
