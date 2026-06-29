"""
Order lifecycle operations.

Each mutating operation runs in a transaction, writes an audit entry, and pushes
a live event to the relevant WebSocket groups so every screen updates instantly.
"""

from django.db import transaction
from django.utils import timezone

from apps.core.models import AuditLog
from apps.floor.models import TableStatus

from .models import CancelDisposition, ItemStatus, Order, OrderItem, OrderStatus
from .realtime import GROUP_KITCHEN, GROUP_RECEPTION, broadcast, waiter_group
from .serializers import OrderSerializer


def serialize(order: Order) -> dict:
    return OrderSerializer(order).data


def broadcast_order(order: Order, event: str, extra: dict | None = None) -> None:
    """Push an order event to kitchen, reception and the order's waiter."""
    groups = [GROUP_KITCHEN, GROUP_RECEPTION]
    if order.waiter_id:
        groups.append(waiter_group(order.waiter_id))
    payload = serialize(order)
    if extra:
        payload = {**payload, **extra}
    broadcast(groups, event, payload)


def _recompute_status(order: Order) -> Order:
    """
    Derive the order's status from its line items so the floor can work dish by
    dish. A single READY item flips the order to READY ("food waiting to go out"),
    and the order is only SERVED once every (non-cancelled) item has been served.
    Terminal states (BILLED/PAID/CANCELLED) are never recomputed.
    """
    if order.status in (OrderStatus.BILLED, OrderStatus.PAID, OrderStatus.CANCELLED):
        return order

    statuses = list(order.items.exclude(status=ItemStatus.CANCELLED).values_list("status", flat=True))
    if not statuses:
        return order

    if ItemStatus.READY in statuses:
        new = OrderStatus.READY  # something is ready to deliver right now
    elif all(s == ItemStatus.SERVED for s in statuses):
        new = OrderStatus.SERVED
    elif any(s in (ItemStatus.PREPARING, ItemStatus.SERVED) for s in statuses):
        new = OrderStatus.PREPARING
    else:
        new = OrderStatus.PLACED

    fields = []
    if order.status != new:
        order.status = new
        fields.append("status")
    if new == OrderStatus.READY and order.ready_at is None:
        order.ready_at = timezone.now()
        fields.append("ready_at")
    if new == OrderStatus.SERVED and order.served_at is None:
        order.served_at = timezone.now()
        fields.append("served_at")
    if fields:
        order.save(update_fields=fields)
    return order


ITEM_ACTIONS = {
    "start": ItemStatus.PREPARING,
    "ready": ItemStatus.READY,
    "serve": ItemStatus.SERVED,
    "cancel": ItemStatus.CANCELLED,
}


@transaction.atomic
def set_item_status(order: Order, item: OrderItem, action: str, actor=None) -> Order:
    """Transition a single line item, then roll the order status up from its items."""
    if action not in ITEM_ACTIONS:
        raise ValueError("Unknown item action.")
    if item.order_id != order.id:
        raise ValueError("That item is not on this order.")
    if item.status == ItemStatus.CANCELLED:
        raise ValueError("That item was cancelled.")

    item.status = ITEM_ACTIONS[action]
    item.save(update_fields=["status"])
    _recompute_status(order)

    AuditLog.record(actor, f"order.item_{action}", "order_item", item.id, order=order.id)
    event = {
        "ready": "order.item_ready",
        "serve": "order.item_served",
    }.get(action, "order.updated")
    broadcast_order(order, event, {"item_id": item.id, "item_name": item.name_snapshot})
    return order


@transaction.atomic
def cancel_item_units(
    order: Order, item: OrderItem, quantity, *, actor=None, reason="", disposition=CancelDisposition.VOIDED
) -> Order:
    """
    Cancel `quantity` units of a line. A partial cancel splits the line: the
    original shrinks and a CANCELLED twin holds the voided units, so the cancelled
    portion is preserved and excluded from the bill (subtotal skips CANCELLED).

    `disposition` records how the cancelled units were handled (voided before
    cooking / stashed to reheat / wasted).
    """
    if item.order_id != order.id:
        raise ValueError("That item is not on this order.")
    if item.status == ItemStatus.CANCELLED:
        raise ValueError("That item is already cancelled.")
    if item.status == ItemStatus.SERVED:
        raise ValueError("Served items can't be cancelled — that's a refund.")
    qty = int(quantity)
    if qty < 1 or qty > item.quantity:
        raise ValueError("Invalid cancel quantity.")

    if qty == item.quantity:
        item.status = ItemStatus.CANCELLED
        item.cancel_disposition = disposition
        item.void_requested_qty = 0
        item.void_reason = ""
        item.save(update_fields=["status", "cancel_disposition", "void_requested_qty", "void_reason"])
    else:
        item.quantity -= qty
        item.void_requested_qty = 0
        item.void_reason = ""
        item.save(update_fields=["quantity", "void_requested_qty", "void_reason"])
        OrderItem.objects.create(
            order=order,
            menu_item=item.menu_item,
            name_snapshot=item.name_snapshot,
            unit_price=item.unit_price,
            quantity=qty,
            note=item.note,
            status=ItemStatus.CANCELLED,
            cancel_disposition=disposition,
        )

    _recompute_status(order)
    AuditLog.record(
        actor, "order.item_cancelled", "order_item", item.id,
        order=order.id, qty=qty, reason=reason, disposition=disposition,
    )
    broadcast_order(order, "order.updated", {"item_id": item.id, "item_name": item.name_snapshot})
    return order


@transaction.atomic
def request_item_void(order: Order, item: OrderItem, quantity, *, actor=None, reason="") -> Order:
    """Waiter asks the kitchen to void cooking units — the kitchen must confirm."""
    if item.order_id != order.id:
        raise ValueError("That item is not on this order.")
    if item.status not in (ItemStatus.PREPARING, ItemStatus.READY):
        raise ValueError("Only cooking items need a kitchen void request.")
    qty = int(quantity)
    if qty < 1 or qty > item.quantity:
        raise ValueError("Invalid void quantity.")
    item.void_requested_qty = qty
    item.void_reason = reason
    item.save(update_fields=["void_requested_qty", "void_reason"])
    AuditLog.record(
        actor, "order.void_requested", "order_item", item.id, order=order.id, qty=qty, reason=reason
    )
    broadcast_order(
        order, "order.void_requested",
        {"item_id": item.id, "item_name": item.name_snapshot, "qty": qty, "reason": reason},
    )
    return order


@transaction.atomic
def respond_item_void(
    order: Order, item: OrderItem, approve: bool, *, disposition=CancelDisposition.STASHED, actor=None
) -> Order:
    """
    Kitchen responds to a pending void request:
    - approve=True  → cancel the units, recording `disposition` (STASHED = kept to
      reheat, WASTED = discarded). The dish comes off the bill.
    - approve=False → "can't cancel" (e.g. a plated sizzler): the dish stays on the
      bill and the waiter is notified.
    """
    if item.order_id != order.id:
        raise ValueError("That item is not on this order.")
    if not item.void_requested_qty:
        raise ValueError("No void was requested for this item.")
    if approve:
        if disposition not in (CancelDisposition.STASHED, CancelDisposition.WASTED):
            raise ValueError("Approving a void needs a disposition (stashed or wasted).")
        return cancel_item_units(
            order, item, item.void_requested_qty,
            actor=actor, reason=item.void_reason, disposition=disposition,
        )
    item.void_requested_qty = 0
    item.void_reason = ""
    item.save(update_fields=["void_requested_qty", "void_reason"])
    AuditLog.record(actor, "order.void_declined", "order_item", item.id, order=order.id)
    broadcast_order(
        order, "order.void_declined", {"item_id": item.id, "item_name": item.name_snapshot}
    )
    return order


@transaction.atomic
def create_order(*, waiter, table, guest_count, note, items, is_staff_meal=False, staff_member=None) -> Order:
    order = Order.objects.create(
        table=table,
        waiter=waiter,
        guest_count=guest_count or 1,
        note=note or "",
        is_staff_meal=bool(is_staff_meal),
        staff_member=staff_member if is_staff_meal else None,
    )
    _add_items(order, items)
    # Seating the table.
    if table.status == TableStatus.FREE:
        table.status = TableStatus.OCCUPIED
        table.save(update_fields=["status"])
    AuditLog.record(waiter, "order.placed", "order", order.id, table=table.name)
    broadcast_order(order, "order.placed")
    return order


@transaction.atomic
def add_items(order: Order, items, actor=None) -> Order:
    _add_items(order, items)
    # Adding a round re-opens the ticket for the kitchen.
    if order.status in (OrderStatus.READY, OrderStatus.SERVED):
        order.status = OrderStatus.PREPARING
        order.ready_at = None
        order.save(update_fields=["status", "ready_at"])
    AuditLog.record(actor, "order.items_added", "order", order.id)
    broadcast_order(order, "order.updated")
    return order


def _add_items(order: Order, items) -> None:
    for item in items:
        menu_item = item["menu_item"]
        OrderItem.objects.create(
            order=order,
            menu_item=menu_item,
            name_snapshot=menu_item.name,
            unit_price=menu_item.price,
            quantity=item.get("quantity", 1),
            note=item.get("note", ""),
            packed=bool(item.get("packed", False)) and menu_item.is_packable,
        )


# The order-level actions below are convenience "do the whole ticket at once"
# operations; per-item granularity goes through set_item_status. Both keep the
# order status consistent via _recompute_status.


@transaction.atomic
def start_preparing(order: Order, actor=None) -> Order:
    """Kitchen acknowledges the whole ticket — every uncooked item starts cooking."""
    order.items.filter(status=ItemStatus.PENDING).update(status=ItemStatus.PREPARING)
    _recompute_status(order)
    AuditLog.record(actor, "order.preparing", "order", order.id)
    broadcast_order(order, "order.preparing")
    return order


@transaction.atomic
def mark_ready(order: Order, actor=None) -> Order:
    """Mark every still-cooking item ready (the 'everything's up' shortcut)."""
    order.items.filter(status__in=[ItemStatus.PENDING, ItemStatus.PREPARING]).update(
        status=ItemStatus.READY
    )
    _recompute_status(order)
    AuditLog.record(actor, "order.ready", "order", order.id)
    broadcast_order(order, "order.ready")
    return order


@transaction.atomic
def mark_served(order: Order, actor=None) -> Order:
    """Serve every item that's ready (delivered to the table)."""
    order.items.filter(status=ItemStatus.READY).update(status=ItemStatus.SERVED)
    _recompute_status(order)
    AuditLog.record(actor, "order.served", "order", order.id)
    broadcast_order(order, "order.served")
    return order


@transaction.atomic
def cancel_order(order: Order, actor=None, reason="") -> Order:
    order.status = OrderStatus.CANCELLED
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "closed_at"])
    order.items.update(status=ItemStatus.CANCELLED)
    _free_table_if_idle(order)
    AuditLog.record(actor, "order.cancelled", "order", order.id, reason=reason)
    broadcast_order(order, "order.cancelled")
    return order


def _free_table_if_idle(order: Order) -> None:
    """Set a table back to FREE when it has no other active orders."""
    table = order.table
    still_active = (
        table.orders.filter(
            status__in=[
                OrderStatus.PLACED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED,
                OrderStatus.BILLED,
            ]
        )
        .exclude(pk=order.pk)
        .exists()
    )
    if not still_active:
        table.status = TableStatus.FREE
        table.save(update_fields=["status"])
