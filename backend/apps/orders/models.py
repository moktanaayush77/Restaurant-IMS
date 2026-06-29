"""Orders and their line items — the live pipeline between waiter, kitchen and reception."""

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.catalog.models import MenuItem
from apps.core.models import TimeStampedModel
from apps.floor.models import Table


class OrderStatus(models.TextChoices):
    PLACED = "PLACED", "Placed"            # sent by waiter, seen by kitchen + reception
    PREPARING = "PREPARING", "Preparing"   # kitchen started cooking
    READY = "READY", "Ready"               # kitchen done, waiter notified
    SERVED = "SERVED", "Served"            # waiter delivered to table
    BILLED = "BILLED", "Billed"            # bill generated, awaiting counter payment
    PAID = "PAID", "Paid / Completed"      # admin confirmed payment
    CANCELLED = "CANCELLED", "Cancelled"


# Statuses that still occupy a table / appear on live boards.
ACTIVE_STATUSES = [
    OrderStatus.PLACED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.BILLED,
]


class ItemStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PREPARING = "PREPARING", "Preparing"
    READY = "READY", "Ready"
    SERVED = "SERVED", "Served"
    CANCELLED = "CANCELLED", "Cancelled"


class CancelDisposition(models.TextChoices):
    """How a cancelled line was handled — drives reporting and 'can it be saved?'."""
    NONE = "", "—"
    VOIDED = "VOIDED", "Voided before cooking"   # never started, no loss
    STASHED = "STASHED", "Stashed to reheat"     # cooked but kept to reuse
    WASTED = "WASTED", "Wasted / discarded"      # cooked and thrown away (loss)


class Order(TimeStampedModel):
    table = models.ForeignKey(Table, on_delete=models.PROTECT, related_name="orders")
    waiter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="orders",
    )
    status = models.CharField(
        max_length=12, choices=OrderStatus.choices, default=OrderStatus.PLACED
    )
    guest_count = models.PositiveSmallIntegerField(default=1)
    note = models.CharField(max_length=255, blank=True)
    # Staff meal: charged to a staff member's salary instead of being paid.
    is_staff_meal = models.BooleanField(default=False)
    staff_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_meals",
    )

    # Lifecycle timestamps (created_at acts as "placed at").
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status"])]

    def __str__(self) -> str:
        return f"Order #{self.pk} · {self.table.name}"

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE_STATUSES

    @property
    def subtotal(self) -> Decimal:
        return sum(
            (line.line_total for line in self.items.all() if line.status != ItemStatus.CANCELLED),
            Decimal("0.00"),
        )


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(
        MenuItem, on_delete=models.PROTECT, related_name="order_lines"
    )
    # Snapshots so historical orders are unaffected by later menu/price edits.
    name_snapshot = models.CharField(max_length=120)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField(default=1)
    note = models.CharField(max_length=255, blank=True)
    packed = models.BooleanField(default=False)  # takeaway / to-pack
    status = models.CharField(
        max_length=10, choices=ItemStatus.choices, default=ItemStatus.PENDING
    )
    # A waiter's pending request to void N cooking units; the kitchen confirms or
    # declines it. 0 = no request outstanding. See orders/services void helpers.
    void_requested_qty = models.PositiveSmallIntegerField(default=0)
    void_reason = models.CharField(max_length=255, blank=True)
    # On a CANCELLED line: how it was disposed of (voided/stashed/wasted). Blank otherwise.
    cancel_disposition = models.CharField(
        max_length=10, choices=CancelDisposition.choices, default=CancelDisposition.NONE, blank=True
    )

    class Meta:
        ordering = ["created_at"]

    def save(self, *args, **kwargs):
        if not self.name_snapshot:
            self.name_snapshot = self.menu_item.name
        if self.unit_price is None:
            self.unit_price = self.menu_item.price
        super().save(*args, **kwargs)

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity

    def __str__(self) -> str:
        return f"{self.quantity}× {self.name_snapshot}"
