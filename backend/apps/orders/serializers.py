from rest_framework import serializers

from apps.catalog.models import MenuItem

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item",
            "name_snapshot",
            "unit_price",
            "quantity",
            "note",
            "packed",
            "status",
            "line_total",
            "void_requested_qty",
            "void_reason",
            "cancel_disposition",
        ]
        read_only_fields = ["name_snapshot", "unit_price", "status"]


class OrderItemWriteSerializer(serializers.Serializer):
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1, default=1)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)
    packed = serializers.BooleanField(required=False, default=False)


class OrderSerializer(serializers.ModelSerializer):
    """Full read shape used by every live screen and in WebSocket payloads."""

    items = OrderItemSerializer(many=True, read_only=True)
    table_name = serializers.CharField(source="table.name", read_only=True)
    table_type = serializers.CharField(source="table.table_type", read_only=True)
    waiter_name = serializers.CharField(source="waiter.display_name", default="", read_only=True)
    staff_member_name = serializers.CharField(
        source="staff_member.display_name", default="", read_only=True
    )
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "table",
            "table_name",
            "table_type",
            "waiter",
            "waiter_name",
            "status",
            "guest_count",
            "note",
            "is_staff_meal",
            "staff_member",
            "staff_member_name",
            "items",
            "item_count",
            "subtotal",
            "created_at",
            "ready_at",
            "served_at",
        ]

    def get_item_count(self, obj) -> int:
        return sum(i.quantity for i in obj.items.all() if i.status != "CANCELLED")


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemWriteSerializer(many=True)

    class Meta:
        model = Order
        fields = ["table", "guest_count", "note", "is_staff_meal", "staff_member", "items"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("An order needs at least one item.")
        return value
