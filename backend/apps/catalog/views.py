from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.accounts.permissions import IsAdminOrReadOnly
from apps.core.models import AuditLog

from .models import MenuCategory, MenuItem
from .serializers import MenuCategorySerializer, MenuItemSerializer


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = MenuCategory.objects.all()
        if self.request.query_params.get("active") == "true":
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "category.create", "category", obj.id, name=obj.name)

    def perform_update(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "category.update", "category", obj.id)


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = MenuItem.objects.select_related("category")
        params = self.request.query_params
        if params.get("active") == "true":
            qs = qs.filter(is_available=True, category__is_active=True)
        if category := params.get("category"):
            qs = qs.filter(category_id=category)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "item.create", "item", obj.id, name=obj.name)

    def perform_update(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "item.update", "item", obj.id)

    def perform_destroy(self, instance):
        AuditLog.record(self.request.user, "item.delete", "item", instance.id, name=instance.name)
        instance.delete()
