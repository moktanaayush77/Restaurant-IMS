from rest_framework import serializers

from .models import MenuCategory, MenuItem


class MenuCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = MenuCategory
        fields = ["id", "name", "sort_order", "is_active", "item_count"]


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "category",
            "category_name",
            "name",
            "description",
            "price",
            "image",
            "is_available",
            "is_packable",
            "sort_order",
        ]
