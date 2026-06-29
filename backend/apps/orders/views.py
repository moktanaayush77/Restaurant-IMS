from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.floor.models import Table

from .models import ACTIVE_STATUSES, CancelDisposition, ItemStatus, Order, OrderItem, OrderStatus
from .serializers import (
    OrderCreateSerializer,
    OrderItemWriteSerializer,
    OrderSerializer,
)
from . import services


def _require(user, *roles):
    if user.role not in roles:
        raise PermissionDenied("Your role can't perform this action.")


class OrderViewSet(viewsets.ModelViewSet):
    """The live order pipeline. Reads are open to staff; transitions are role-gated."""

    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        qs = (
            Order.objects.select_related("table", "waiter")
            .prefetch_related("items")
            .all()
        )
        params = self.request.query_params

        if params.get("scope") == "active":
            qs = qs.filter(status__in=ACTIVE_STATUSES)
        # Kitchen only cares about tickets not yet served.
        if params.get("scope") == "kitchen":
            qs = qs.filter(status__in=[OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY])
        # Tickets the kitchen finished today (used for the KDS completed counter).
        if params.get("done") == "today":
            qs = qs.filter(ready_at__date=timezone.localdate())
        if params.get("mine") == "true":
            qs = qs.filter(waiter=self.request.user)
        if table := params.get("table"):
            qs = qs.filter(table_id=table)
        if s := params.get("status"):
            qs = qs.filter(status=s)
        return qs.order_by("created_at")

    def create(self, request, *args, **kwargs):
        _require(request.user, Role.WAITER, Role.ADMIN)
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = services.create_order(
            waiter=request.user,
            table=data["table"],
            guest_count=data.get("guest_count", 1),
            note=data.get("note", ""),
            items=data["items"],
            is_staff_meal=data.get("is_staff_meal", False),
            staff_member=data.get("staff_member"),
        )
        return Response(services.serialize(order), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_items(self, request, pk=None):
        _require(request.user, Role.WAITER, Role.ADMIN)
        order = self.get_object()
        if order.status in (OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.BILLED):
            return Response({"detail": "This order is closed."}, status=400)
        items = OrderItemWriteSerializer(many=True, data=request.data.get("items", []))
        items.is_valid(raise_exception=True)
        if not items.validated_data:
            return Response({"detail": "No items provided."}, status=400)
        order = services.add_items(order, items.validated_data, actor=request.user)
        return Response(services.serialize(order))

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        _require(request.user, Role.CHEF, Role.ADMIN)
        return Response(services.serialize(services.start_preparing(self.get_object(), request.user)))

    @action(detail=True, methods=["post"])
    def ready(self, request, pk=None):
        _require(request.user, Role.CHEF, Role.ADMIN)
        return Response(services.serialize(services.mark_ready(self.get_object(), request.user)))

    @action(detail=True, methods=["post"])
    def serve(self, request, pk=None):
        _require(request.user, Role.WAITER, Role.ADMIN)
        return Response(services.serialize(services.mark_served(self.get_object(), request.user)))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        _require(request.user, Role.WAITER, Role.ADMIN)
        reason = request.data.get("reason", "")
        return Response(services.serialize(services.cancel_order(self.get_object(), request.user, reason)))

    @action(detail=True, methods=["post"])
    def cancel_item(self, request, pk=None):
        """Cancel units of a single line. Not-yet-started (PENDING) units cancel
        immediately; cooking units (PREPARING/READY) raise a kitchen void request
        the kitchen must confirm. Served lines can't be cancelled here."""
        _require(request.user, Role.WAITER, Role.ADMIN)
        order = self.get_object()
        item = get_object_or_404(OrderItem, pk=request.data.get("item"), order=order)
        qty = request.data.get("quantity", item.quantity)
        reason = request.data.get("reason", "")
        try:
            if item.status == ItemStatus.PENDING:
                services.cancel_item_units(order, item, qty, actor=request.user, reason=reason)
            elif item.status in (ItemStatus.PREPARING, ItemStatus.READY):
                services.request_item_void(order, item, qty, actor=request.user, reason=reason)
            else:
                return Response(
                    {"detail": "Served or cancelled items can't be cancelled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.serialize(order))

    @action(detail=True, methods=["post"])
    def void_respond(self, request, pk=None):
        """Kitchen responds to a void request: approve with a disposition
        (stash/waste) to cancel, or decline ('can't cancel' — stays on the bill)."""
        _require(request.user, Role.CHEF, Role.ADMIN)
        order = self.get_object()
        item = get_object_or_404(OrderItem, pk=request.data.get("item"), order=order)
        approve = bool(request.data.get("approve"))
        disposition = request.data.get("disposition", CancelDisposition.STASHED)
        try:
            services.respond_item_void(
                order, item, approve, disposition=disposition, actor=request.user
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.serialize(order))

    @action(detail=True, methods=["post"])
    def item(self, request, pk=None):
        """Transition a single line item — lets the kitchen send dishes out one at
        a time and the waiter serve them as they're ready, instead of all at once."""
        order = self.get_object()
        item = get_object_or_404(OrderItem, pk=request.data.get("item"), order=order)
        op = request.data.get("action")
        # Cooking transitions are the chef's; serving/cancelling are the waiter's.
        if op in ("start", "ready"):
            _require(request.user, Role.CHEF, Role.ADMIN)
        else:
            _require(request.user, Role.WAITER, Role.ADMIN)
        try:
            services.set_item_status(order, item, op, actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.serialize(order))
