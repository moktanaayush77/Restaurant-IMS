"""Dining tables — the physical seats orders are attached to."""

from django.db import models

from apps.core.models import TimeStampedModel


class TableType(models.TextChoices):
    NORMAL = "NORMAL", "Normal"
    CABIN = "CABIN", "Cabin"


class TableStatus(models.TextChoices):
    FREE = "FREE", "Free"
    OCCUPIED = "OCCUPIED", "Occupied"
    BILLING = "BILLING", "Billing"


class Table(TimeStampedModel):
    name = models.CharField(max_length=40, unique=True)
    table_type = models.CharField(
        max_length=10, choices=TableType.choices, default=TableType.NORMAL
    )
    section = models.CharField(max_length=40, blank=True, help_text="Floor or area")
    capacity = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(
        max_length=10, choices=TableStatus.choices, default=TableStatus.FREE
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name
