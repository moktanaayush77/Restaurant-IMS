from rest_framework import viewsets

from apps.accounts.permissions import IsAdminOrReadOnly
from apps.core.models import AuditLog

from .models import Table
from .serializers import TableSerializer


class TableViewSet(viewsets.ModelViewSet):
    """Tables are readable by all staff; only admins create/edit/remove them."""

    serializer_class = TableSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Table.objects.all()
        # Staff apps only care about active tables; admin sees everything.
        if self.request.query_params.get("active") == "true":
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        table = serializer.save()
        AuditLog.record(self.request.user, "table.create", "table", table.id, name=table.name)

    def perform_update(self, serializer):
        table = serializer.save()
        AuditLog.record(self.request.user, "table.update", "table", table.id)

    def perform_destroy(self, instance):
        AuditLog.record(self.request.user, "table.delete", "table", instance.id, name=instance.name)
        instance.delete()
