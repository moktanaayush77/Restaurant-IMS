from rest_framework import serializers

from .models import AuditLog, RestaurantSettings


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantSettings
        fields = [
            "name",
            "address",
            "phone",
            "pan_vat_no",
            "logo",
            "currency_code",
            "currency_symbol",
            "vat_percent",
            "service_charge_percent",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name", default="system")

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "entity",
            "entity_id",
            "detail",
            "created_at",
        ]
