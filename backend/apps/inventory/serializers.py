from rest_framework import serializers

from apps.catalog.models import MenuItem

from .models import InventoryItem, RecipeComponent, StockTransaction, StockTxnType


class InventoryItemSerializer(serializers.ModelSerializer):
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "name",
            "unit",
            "quantity",
            "reorder_level",
            "unit_cost",
            "is_active",
            "is_low",
        ]


class StockTransactionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    unit = serializers.CharField(source="item.unit", read_only=True)
    actor_name = serializers.CharField(source="actor.display_name", default="", read_only=True)
    txn_type_display = serializers.CharField(source="get_txn_type_display", read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "item",
            "item_name",
            "unit",
            "txn_type",
            "txn_type_display",
            "quantity",
            "reason",
            "related_order",
            "actor_name",
            "created_at",
        ]
        read_only_fields = fields


class StockMoveSerializer(serializers.Serializer):
    """Input for recording a stock movement against an item."""

    txn_type = serializers.ChoiceField(choices=StockTxnType.choices)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class RecipeComponentSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    unit = serializers.CharField(source="inventory_item.unit", read_only=True)
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)

    class Meta:
        model = RecipeComponent
        fields = [
            "id",
            "menu_item",
            "menu_item_name",
            "inventory_item",
            "inventory_item_name",
            "unit",
            "quantity_per_unit",
        ]

    def validate_menu_item(self, value):
        if not MenuItem.objects.filter(pk=value.pk).exists():
            raise serializers.ValidationError("Unknown menu item.")
        return value
