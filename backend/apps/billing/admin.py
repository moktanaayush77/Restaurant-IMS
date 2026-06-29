from django.contrib import admin

from .models import Bill


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = (
        "bill_number",
        "order",
        "total",
        "payment_status",
        "payment_method",
        "paid_at",
    )
    list_filter = ("payment_status", "payment_method")
    search_fields = ("bill_number",)
