from django.contrib import admin

from .models import InventoryItem, RecipeComponent, StockTransaction


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "quantity", "unit", "reorder_level", "is_low", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "item", "txn_type", "quantity", "actor")
    list_filter = ("txn_type",)
    date_hierarchy = "created_at"


@admin.register(RecipeComponent)
class RecipeComponentAdmin(admin.ModelAdmin):
    list_display = ("menu_item", "inventory_item", "quantity_per_unit")
