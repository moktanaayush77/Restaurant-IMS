"""
Seed a realistic demo dataset: an admin, floor staff with PINs, tables, and a menu.

Idempotent — safe to run repeatedly. Credentials are printed at the end.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role
from apps.catalog.models import MenuCategory, MenuItem
from apps.core.models import RestaurantSettings
from apps.floor.models import Table, TableType

User = get_user_model()

STAFF = [
    # username, name, role, pin
    ("ramesh", "Ramesh Thapa", Role.WAITER, "1111"),
    ("sita", "Sita Gurung", Role.WAITER, "2222"),
    ("bikash", "Bikash Rai", Role.CHEF, "3333"),
]

TABLES = [
    ("T1", TableType.NORMAL, "Ground Floor", 4),
    ("T2", TableType.NORMAL, "Ground Floor", 4),
    ("T3", TableType.NORMAL, "Ground Floor", 2),
    ("T4", TableType.NORMAL, "Ground Floor", 6),
    ("Cabin 1", TableType.CABIN, "First Floor", 8),
    ("Cabin 2", TableType.CABIN, "First Floor", 6),
]

MENU = {
    "Momo": [
        ("Steam Chicken Momo", "180"),
        ("Jhol Buff Momo", "200"),
        ("C. Veg Momo", "160"),
    ],
    "Snacks": [
        ("Chicken Chilli", "320"),
        ("Paneer Chilli", "300"),
        ("French Fries", "150"),
    ],
    "Main Course": [
        ("Chicken Thakali Set", "450"),
        ("Veg Thakali Set", "350"),
        ("Buff Sekuwa", "380"),
    ],
    "Beverages": [
        ("Masala Tea", "60"),
        ("Coke (250ml)", "80"),
        ("Lassi", "120"),
    ],
}


class Command(BaseCommand):
    help = "Seed demo data (admin, staff, tables, menu)."

    @transaction.atomic
    def handle(self, *args, **options):
        settings_obj = RestaurantSettings.load()
        if settings_obj.name == "My Restaurant":
            settings_obj.name = "Himalayan Spice Restaurant"
            settings_obj.address = "Lakeside, Pokhara"
            settings_obj.phone = "061-555000"
            settings_obj.save()

        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={"role": Role.ADMIN, "is_staff": True, "is_superuser": True,
                      "first_name": "Restaurant", "last_name": "Admin"},
        )
        if created:
            admin.set_password("admin123")
            admin.save()
            self.stdout.write(self.style.SUCCESS("Created admin / admin123"))

        for username, name, role, pin in STAFF:
            first, _, last = name.partition(" ")
            user, was_new = User.objects.get_or_create(
                username=username,
                defaults={"role": role, "first_name": first, "last_name": last},
            )
            user.set_pin(pin)
            user.is_active = True
            user.save()
            if was_new:
                self.stdout.write(f"  staff: {username} ({role}) PIN {pin}")

        for i, (name, ttype, section, cap) in enumerate(TABLES):
            Table.objects.get_or_create(
                name=name,
                defaults={"table_type": ttype, "section": section,
                          "capacity": cap, "sort_order": i},
            )

        for ci, (cat_name, items) in enumerate(MENU.items()):
            category, _ = MenuCategory.objects.get_or_create(
                name=cat_name, defaults={"sort_order": ci}
            )
            for ii, (item_name, price) in enumerate(items):
                MenuItem.objects.get_or_create(
                    category=category,
                    name=item_name,
                    defaults={"price": Decimal(price), "sort_order": ii},
                )

        self.stdout.write(self.style.SUCCESS("\nDemo data ready."))
        self.stdout.write("  Admin login : admin / admin123")
        self.stdout.write("  Waiter PIN  : ramesh / 1111, sita / 2222")
        self.stdout.write("  Chef PIN    : bikash / 3333")
