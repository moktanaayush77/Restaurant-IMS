from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import AuditLog

from .models import Role, User
from .permissions import IsAdmin
from .serializers import (
    LoginSerializer,
    PinLoginSerializer,
    StaffSerializer,
    UserSerializer,
    tokens_for,
)


class _AuthBase(APIView):
    permission_classes = [AllowAny]
    serializer_class = None

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        AuditLog.record(user, "login", "user", user.id, role=user.role)
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens_for(user)},
            status=status.HTTP_200_OK,
        )


class LoginView(_AuthBase):
    """Admin/staff password login."""

    throttle_scope = "login"
    serializer_class = LoginSerializer


class PinLoginView(_AuthBase):
    """Waiter/chef PIN login."""

    throttle_scope = "pin_login"
    serializer_class = PinLoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class StaffDirectoryView(APIView):
    """Active staff (id + name + role) so a waiter can attribute a staff meal.
    Names only — no credentials — so it's safe for any authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.filter(is_active=True).order_by("first_name", "username")
        return Response(
            [{"id": u.id, "display_name": u.display_name, "role": u.role} for u in users]
        )


class LogoutView(APIView):
    """Revoke a refresh token on logout by blacklisting it (best-effort)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # already expired/invalid — nothing to revoke
        AuditLog.record(request.user, "logout", "user", request.user.id)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class StaffViewSet(viewsets.ModelViewSet):
    """Admin management of floor staff (waiters & chefs) and their PINs."""

    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.filter(
        role__in=[Role.WAITER, Role.CHEF, Role.ACCOUNTANT]
    ).order_by("is_active", "first_name", "username")

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.record(self.request.user, "staff.create", "user", user.id, role=user.role)

    def perform_update(self, serializer):
        user = serializer.save()
        AuditLog.record(self.request.user, "staff.update", "user", user.id)

    def perform_destroy(self, instance):
        # Soft-delete: deactivate rather than remove, to preserve order history.
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        AuditLog.record(self.request.user, "staff.deactivate", "user", instance.id)

    @action(detail=True, methods=["post"])
    def reset_pin(self, request, pk=None):
        user = self.get_object()
        pin = str(request.data.get("pin", ""))
        if not (pin.isdigit() and 4 <= len(pin) <= 6):
            return Response(
                {"pin": ["PIN must be 4–6 digits."]}, status=status.HTTP_400_BAD_REQUEST
            )
        user.set_pin(pin)
        user.save(update_fields=["pin_hash"])
        AuditLog.record(request.user, "staff.reset_pin", "user", user.id)
        return Response({"status": "PIN updated."})
