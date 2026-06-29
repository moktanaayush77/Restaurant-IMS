from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("name_snapshot", "unit_price", "line_total")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "table", "waiter", "status", "guest_count", "created_at")
    list_filter = ("status",)
    inlines = [OrderItemInline]
    date_hierarchy = "created_at"
