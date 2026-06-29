"""
Seed packaged/countable beverages into inventory (cold drinks, beers, wine,
spirits). Made-to-order drinks (coffee, frappe, mojito, etc.) are intentionally
excluded — those are tracked via their ingredients, not as finished stock.

Idempotent: matches on item name, so it's safe to re-run and safe against either
the local SQLite DB or Supabase. Quantities/costs start at 0 for staff to fill in.
"""

from django.core.management.base import BaseCommand

from apps.inventory.models import InventoryItem

SPIRIT_SIZES = ["750ml", "Half", "Quarter"]
DOMESTIC_SPIRITS = [
    "Signature Premier",
    "Signature Rare",
    "Ruslan Vodka",
    "M.T 8848 Vodka",
    "Old Durbar Gold",
    "Old Durbar Black",
    "Kala Pattha",
    "Sky Vodka",
]
IMPORTED_SPIRITS = ["Black Label", "Jack Daniel's", "Double Black"]


def beverage_rows() -> list[tuple[str, str]]:
    """Returns (name, unit) for every packaged beverage stock item."""
    rows: list[tuple[str, str]] = []

    # Cold drinks — each flavour/size is its own SKU you count separately.
    for flavour in ["Coke", "Fanta", "Sprite", "Dew"]:
        rows.append((f"{flavour} (Regular)", "bottle"))
        rows.append((f"{flavour} (Jumbo)", "bottle"))
    rows += [("Red Bull Red", "can"), ("Red Bull Blue", "can"), ("Apple Cider", "bottle")]

    # Beers
    for beer in [
        "Carlsberg Beer",
        "Tuborg Beer (Gold)",
        "Tuborg Beer (Strong)",
        "Tuborg Beer (330ml)",
        "Gorkha Beer (650ml)",
        "Gorkha Beer (330ml)",
        "Nepal Ice",
        "Arna Beer",
    ]:
        rows.append((beer, "bottle"))

    # Wine — stocked as bottles (glasses are poured from a bottle).
    for wine in ["Big Master", "Robertson", "Jacob's Creek", "Porto"]:
        rows.append((f"{wine} (Wine)", "bottle"))

    # Spirits — each bottle size is a separate SKU you purchase/count.
    for spirit in DOMESTIC_SPIRITS + IMPORTED_SPIRITS:
        for size in SPIRIT_SIZES:
            rows.append((f"{spirit} ({size})", "bottle"))
    rows.append(("Tequila Shot", "shot"))

    return rows


class Command(BaseCommand):
    help = "Seed packaged beverages (cold drinks, beer, wine, spirits) into inventory."

    def handle(self, *args, **options):
        rows = beverage_rows()
        created = 0
        for name, unit in rows:
            _, made = InventoryItem.objects.get_or_create(
                name=name,
                defaults={
                    "unit": unit,
                    "quantity": 0,
                    "reorder_level": 0,
                    "unit_cost": 0,
                    "is_active": True,
                },
            )
            created += 1 if made else 0

        self.stdout.write(
            self.style.SUCCESS(
                f"Beverages: {created} new of {len(rows)} packaged items "
                f"(inventory now has {InventoryItem.objects.count()} items total). "
                "Set quantities and unit costs in Admin > Inventory."
            )
        )
