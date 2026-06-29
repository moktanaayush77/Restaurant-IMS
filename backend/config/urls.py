"""Root URL configuration. All application APIs are mounted under ``/api/``."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

api_patterns = [
    path("auth/", include("apps.accounts.auth_urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.core.urls")),
    path("", include("apps.catalog.urls")),
    path("", include("apps.floor.urls")),
    path("", include("apps.orders.urls")),
    path("", include("apps.billing.urls")),
    path("", include("apps.inventory.urls")),
    path("", include("apps.reports.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
