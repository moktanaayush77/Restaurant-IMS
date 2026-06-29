"""Stock movements and optional recipe-based auto-deduction on a completed sale."""

from decimal import Decimal

from django.db import transaction

from apps.core.models import AuditLog
from apps.orders.models import ItemStatus, Order

from .models import InventoryItem, StockTransaction, StockTxnType


@transaction.atomic
def apply_transaction(
    item: InventoryItem,
    txn_type: str,
    quantity,
    *,
    reason: str = "",
    actor=None,
    related_order: Order | None = None,
) -> StockTransaction:
    """
    Record a stock movement and update the item's on-hand quantity.

    - IN     adds to stock (a purchase / delivery)
    - OUT    consumes stock (sale, wastage), never below zero
    - ADJUST sets the on-hand to an absolute corrected count
    """
    quantity = Decimal(str(quantity))
    item = InventoryItem.objects.select_for_update().get(pk=item.pk)

    if txn_type == StockTxnType.IN:
        item.quantity = item.quantity + quantity
    elif txn_type == StockTxnType.OUT:
        item.quantity = max(Decimal("0"), item.quantity - quantity)
    elif txn_type == StockTxnType.ADJUST:
        item.quantity = quantity
    else:
        raise ValueError(f"Unknown transaction type: {txn_type}")

    item.save(update_fields=["quantity", "updated_at"])
    txn = StockTransaction.objects.create(
        item=item,
        txn_type=txn_type,
        quantity=quantity,
        reason=reason,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        related_order=related_order,
    )
    AuditLog.record(actor, "stock.move", "inventory_item", item.id, type=txn_type, qty=str(quantity))
    return txn


def deduct_for_order(order: Order, *, actor=None) -> int:
    """
    Consume ingredients for every non-cancelled line that has a recipe.

    Returns the number of stock movements written. Safe to call when no recipes
    are configured (it simply does nothing). Each menu item already sold won't be
    double-deducted because this is called once, at payment.
    """
    moves = 0
    lines = order.items.exclude(status=ItemStatus.CANCELLED).select_related("menu_item")
    for line in lines:
        for comp in line.menu_item.recipe.select_related("inventory_item").all():
            apply_transaction(
                comp.inventory_item,
                StockTxnType.OUT,
                comp.quantity_per_unit * line.quantity,
                reason=f"Sold · order #{order.id}",
                actor=actor,
                related_order=order,
            )
            moves += 1
    return moves
