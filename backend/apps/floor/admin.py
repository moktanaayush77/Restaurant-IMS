from django.contrib import admin

from .models import Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("name", "table_type", "section", "capacity", "status", "is_active")
    list_filter = ("table_type", "status", "section", "is_active")
    list_editable = ("status", "is_active")
    search_fields = ("name",)
