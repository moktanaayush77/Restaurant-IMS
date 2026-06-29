"""
Import the menu from a CSV (Category, Item, Variant, Price_NPR, Notes).

- Re-runnable: matches on (category, name) and updates in place.
- Deactivates the existing menu first, then activates exactly what's in the CSV,
  so the old demo items disappear without being deleted (order history keeps its
  FK references intact).
- Variant becomes part of the name: "Veg Momo" + "Steam" -> "Veg Momo (Steam)".
- Rows with no price are imported but marked unavailable (need a price set).
- Descriptive Notes become the item description; price-quality notes
  ("Handwritten", "unclear", ...) are ignored.

Usage:  python manage.py import_menu [--file scripts/menu_items.csv]
"""

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import MenuCategory, MenuItem

# Notes that describe price legibility, not the dish — don't use as descriptions.
META_NOTE_HINTS = ("handwritten", "printed", "unclear", "unreadable", "obscured", "struck", "digit", "column")

# Categories that can't be packed for takeaway (drinks + shisha). Sizzlers are
# excluded by name. Everything else is packable.
NON_PACKABLE_CATEGORIES = {
    "Black Coffee Varieties", "Milk Coffee Varieties", "Coffee Alternative",
    "Cold Coffee Varieties", "Frappe", "Mojitos", "Mocktails", "Iced Tea / Refreshers",
    "Cold Drink", "Beers", "Wine", "Shisha", "Domestic Spirits", "Imported Spirits",
}


class Command(BaseCommand):
    help = "Import/refresh the menu from a CSV file."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(settings.BASE_DIR / "scripts" / "menu_items.csv"))

    @transaction.atomic
    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"CSV not found: {path}"))
            return

        # Hide the current menu; the CSV below re-activates what it contains.
        MenuItem.objects.update(is_available=False)
        MenuCategory.objects.update(is_active=False)

        cat_order: dict[str, int] = {}
        item_order: dict[str, int] = {}
        created = updated = needs_price = 0
        missing = []

        with path.open(newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                cat_name = (row.get("Category") or "").strip()
                item = (row.get("Item") or "").strip()
                variant = (row.get("Variant") or "").strip()
                price_raw = (row.get("Price_NPR") or "").strip()
                notes = (row.get("Notes") or "").strip()
                if not cat_name or not item:
                    continue

                if cat_name not in cat_order:
                    cat_order[cat_name] = len(cat_order)
                category, _ = MenuCategory.objects.update_or_create(
                    name=cat_name,
                    defaults={"is_active": True, "sort_order": cat_order[cat_name]},
                )

                name = f"{item} ({variant})" if variant else item
                name = name[:120]

                if price_raw:
                    try:
                        price = Decimal(price_raw)
                        available = True
                    except InvalidOperation:
                        price, available = Decimal("0"), False
                else:
                    price, available = Decimal("0"), False
                if not available:
                    needs_price += 1
                    missing.append(f"{cat_name} / {name}")

                description = "" if (not notes or any(h in notes.lower() for h in META_NOTE_HINTS)) else notes

                packable = cat_name not in NON_PACKABLE_CATEGORIES and "sizzler" not in name.lower()

                item_order[cat_name] = item_order.get(cat_name, 0) + 1
                _, was_created = MenuItem.objects.update_or_create(
                    category=category,
                    name=name,
                    defaults={
                        "price": price,
                        "description": description,
                        "is_available": available,
                        "is_packable": packable,
                        "sort_order": item_order[cat_name],
                    },
                )
                created += int(was_created)
                updated += int(not was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Menu imported: {created} new, {updated} updated across "
                f"{len(cat_order)} categories. {needs_price} item(s) need a price (left unavailable)."
            )
        )
        for m in missing:
            self.stdout.write(f"  needs price: {m}")
