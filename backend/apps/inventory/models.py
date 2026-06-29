"""Inventory: stock items, their movements, and optional recipe links to menu items."""

from django.conf import settings
from django.db import models

from apps.catalog.models import MenuItem
from apps.core.models import TimeStampedModel


class InventoryItem(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    unit = models.CharField(max_length=20, default="pcs", help_text="kg, ltr, pcs, …")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    @property
    def is_low(self) -> bool:
        return self.quantity <= self.reorder_level

    def __str__(self) -> str:
        return f"{self.name} ({self.quantity} {self.unit})"


class StockTxnType(models.TextChoices):
    IN = "IN", "Stock in / Purchase"
    OUT = "OUT", "Consumption"
    ADJUST = "ADJUST", "Adjustment"


class StockTransaction(TimeStampedModel):
    item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="transactions"
    )
    txn_type = models.CharField(max_length=8, choices=StockTxnType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=255, blank=True)
    related_order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_txn_type_display()} {self.quantity} {self.item.unit} · {self.item.name}"


class RecipeComponent(TimeStampedModel):
    """How much of an inventory item one unit of a menu item consumes (optional, M4)."""

    menu_item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE, related_name="recipe"
    )
    inventory_item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="used_in"
    )
    quantity_per_unit = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        unique_together = [("menu_item", "inventory_item")]

    def __str__(self) -> str:
        return f"{self.menu_item.name} → {self.quantity_per_unit} {self.inventory_item.unit} {self.inventory_item.name}"
