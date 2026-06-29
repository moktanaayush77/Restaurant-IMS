"""The menu: categories and the items guests order."""

from django.db import models

from apps.core.models import TimeStampedModel


class MenuCategory(TimeStampedModel):
    name = models.CharField(max_length=80, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Menu categories"

    def __str__(self) -> str:
        return self.name


class MenuItem(TimeStampedModel):
    category = models.ForeignKey(
        MenuCategory, on_delete=models.PROTECT, related_name="items"
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to="menu/", blank=True, null=True)
    is_available = models.BooleanField(default=True)
    # Can this be packed for takeaway? False for drinks and sizzlers.
    is_packable = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["category__sort_order", "sort_order", "name"]
        unique_together = [("category", "name")]

    def __str__(self) -> str:
        return self.name
