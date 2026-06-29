from django.contrib import admin

from .models import AuditLog, RestaurantSettings


@admin.register(RestaurantSettings)
class RestaurantSettingsAdmin(admin.ModelAdmin):
    list_display = ("name", "currency_code", "vat_percent", "service_charge_percent")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "entity", "entity_id")
    list_filter = ("action", "entity")
    search_fields = ("action", "entity", "entity_id")
    readonly_fields = ("actor", "action", "entity", "entity_id", "detail", "created_at")
