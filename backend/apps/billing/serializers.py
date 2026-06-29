from rest_framework import serializers

from apps.orders.serializers import OrderSerializer

from .models import Bill


class BillSerializer(serializers.ModelSerializer):
    """Full bill shape for the billing screen and printable receipt."""

    order_detail = OrderSerializer(source="order", read_only=True)
    table_name = serializers.CharField(source="order.table.name", read_only=True)
    waiter_name = serializers.CharField(source="order.waiter.display_name", default="", read_only=True)
    confirmed_by_name = serializers.CharField(
        source="confirmed_by.display_name", default="", read_only=True
    )

    class Meta:
        model = Bill
        fields = [
            "id",
            "order",
            "order_detail",
            "table_name",
            "waiter_name",
            "bill_number",
            "subtotal",
            "discount",
            "service_charge",
            "vat",
            "total",
            "service_charge_percent",
            "vat_percent",
            "payment_status",
            "payment_method",
            "confirmed_by",
            "confirmed_by_name",
            "paid_at",
            "created_at",
        ]
        read_only_fields = fields


class GenerateBillSerializer(serializers.Serializer):
    order = serializers.IntegerField()
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)


class PayBillSerializer(serializers.Serializer):
    payment_method = serializers.CharField(required=False, allow_blank=True, default="")
