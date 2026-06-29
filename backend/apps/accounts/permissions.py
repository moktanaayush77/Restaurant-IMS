"""Role-based DRF permissions."""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Role


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ADMIN)


class IsWaiter(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.WAITER)


class IsChef(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.CHEF)


class IsAdminOrReadOnly(BasePermission):
    """Any authenticated user may read; only admins may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == Role.ADMIN


class IsAdminOrAccountant(BasePermission):
    """Admins and accountants — used for billing and reports."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in (Role.ADMIN, Role.ACCOUNTANT))


class IsAdminOrAccountantReadOnly(BasePermission):
    """Admins get full access; accountants read-only — used for inventory."""

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role == Role.ADMIN:
            return True
        if u.role == Role.ACCOUNTANT:
            return request.method in SAFE_METHODS
        return False
