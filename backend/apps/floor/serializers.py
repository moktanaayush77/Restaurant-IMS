from rest_framework import serializers

from .models import Table


class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = [
            "id",
            "name",
            "table_type",
            "section",
            "capacity",
            "status",
            "sort_order",
            "is_active",
        ]
        read_only_fields = ["status"]
