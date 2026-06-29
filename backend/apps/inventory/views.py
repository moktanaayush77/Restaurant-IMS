from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrAccountantReadOnly
from apps.core.models import AuditLog

from . import services
from .models import InventoryItem, RecipeComponent, StockTransaction
from .serializers import (
    InventoryItemSerializer,
    RecipeComponentSerializer,
    StockMoveSerializer,
    StockTransactionSerializer,
)


class InventoryItemViewSet(viewsets.ModelViewSet):
    """Stock items: admins manage, accountants read-only, floor staff have no
    access (F8 — quantities/costs/suppliers must not leak). A narrow waiter-facing
    'beverage stock' view is deferred (needs a category field); see open-decisions."""

    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminOrAccountantReadOnly]

    def get_queryset(self):
        qs = InventoryItem.objects.all()
        params = self.request.query_params
        if params.get("active") == "true":
            qs = qs.filter(is_active=True)
        if params.get("low") == "true":
            # is_low is a property, so filter in Python-friendly SQL terms.
            from django.db.models import F

            qs = qs.filter(quantity__lte=F("reorder_level"))
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "inventory.create", "inventory_item", obj.id, name=obj.name)

    def perform_update(self, serializer):
        obj = serializer.save()
        AuditLog.record(self.request.user, "inventory.update", "inventory_item", obj.id)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def move(self, request, pk=None):
        """Record a stock IN / OUT / ADJUST and return the updated item."""
        item = self.get_object()
        payload = StockMoveSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.apply_transaction(
            item,
            payload.validated_data["txn_type"],
            payload.validated_data["quantity"],
            reason=payload.validated_data.get("reason", ""),
            actor=request.user,
        )
        item.refresh_from_db()
        return Response(InventoryItemSerializer(item).data)


class StockTransactionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only ledger of stock movements (movements are created via item `move`)."""

    serializer_class = StockTransactionSerializer
    permission_classes = [IsAdminOrAccountantReadOnly]

    def get_queryset(self):
        qs = StockTransaction.objects.select_related("item", "actor")
        if item := self.request.query_params.get("item"):
            qs = qs.filter(item_id=item)
        return qs


class RecipeComponentViewSet(viewsets.ModelViewSet):
    """Links a menu item to the inventory it consumes; drives auto-deduction."""

    serializer_class = RecipeComponentSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = RecipeComponent.objects.select_related("inventory_item", "menu_item")
        if mi := self.request.query_params.get("menu_item"):
            qs = qs.filter(menu_item_id=mi)
        return qs
