from django.db import connection
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrReadOnly

from .models import RestaurantSettings
from .serializers import RestaurantSettingsSerializer


class HealthView(APIView):
    """Liveness + DB readiness. Doubles as the keep-alive target: pinging this
    every ~10 min keeps Render awake AND issues a query so Supabase doesn't pause."""

    permission_classes = [AllowAny]
    throttle_classes = []  # never throttle health checks / keep-alive pings

    def get(self, request):
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_ok = False
        return Response(
            {"status": "ok" if db_ok else "degraded", "service": "restaurant-api", "db": db_ok},
            status=200 if db_ok else 503,
        )


class BrandingView(APIView):
    """Public, read-only venue identity for login screens and headers."""

    permission_classes = [AllowAny]

    def get(self, request):
        s = RestaurantSettings.load()
        logo = s.logo.url if s.logo else None
        return Response(
            {
                "name": s.name,
                "address": s.address,
                "phone": s.phone,
                "logo": logo,
                "currency_code": s.currency_code,
                "currency_symbol": s.currency_symbol,
            }
        )


class RestaurantSettingsView(generics.RetrieveUpdateAPIView):
    """Any authenticated user may read settings; only admins may change them."""

    serializer_class = RestaurantSettingsSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_object(self):
        return RestaurantSettings.load()
