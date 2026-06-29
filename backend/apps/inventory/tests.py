"""Stock movements and recipe-based auto-deduction on payment."""

from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import Role, User
from apps.billing import services as billing_services
from apps.catalog.models import MenuCategory, MenuItem
from apps.floor.models import Table
from apps.orders import services as order_services

from . import services
from .models import InventoryItem, RecipeComponent, StockTransaction, StockTxnType


class StockMovementTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", role=Role.ADMIN)
        self.item = InventoryItem.objects.create(
            name="Flour", unit="kg", quantity=Decimal("10"), reorder_level=Decimal("5")
        )

    def test_stock_in_adds_and_logs(self):
        services.apply_transaction(self.item, StockTxnType.IN, 5, actor=self.admin)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, Decimal("15.000"))
        self.assertEqual(StockTransaction.objects.count(), 1)

    def test_stock_out_subtracts_and_clamps_at_zero(self):
        services.apply_transaction(self.item, StockTxnType.OUT, 4, actor=self.admin)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, Decimal("6.000"))

        services.apply_transaction(self.item, StockTxnType.OUT, 100, actor=self.admin)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, Decimal("0.000"))

    def test_adjust_sets_absolute_quantity(self):
        services.apply_transaction(self.item, StockTxnType.ADJUST, Decimal("3.5"), actor=self.admin)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, Decimal("3.500"))

    def test_is_low_flag(self):
        self.assertFalse(self.item.is_low)  # 10 > 5
        services.apply_transaction(self.item, StockTxnType.OUT, 6, actor=self.admin)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_low)  # 4 <= 5


class RecipeDeductionTests(TestCase):
    def setUp(self):
        self.waiter = User.objects.create_user("ramesh", role=Role.WAITER)
        self.admin = User.objects.create_user("admin", role=Role.ADMIN)
        self.table = Table.objects.create(name="T1")
        cat = MenuCategory.objects.create(name="Mains")
        self.momo = MenuItem.objects.create(category=cat, name="Momo", price=Decimal("180"))
        self.wrapper = InventoryItem.objects.create(
            name="Momo wrapper", unit="pcs", quantity=Decimal("100")
        )
        RecipeComponent.objects.create(
            menu_item=self.momo, inventory_item=self.wrapper, quantity_per_unit=Decimal("10")
        )

    def _serve(self, qty):
        order = order_services.create_order(
            waiter=self.waiter,
            table=self.table,
            guest_count=2,
            note="",
            items=[{"menu_item": self.momo, "quantity": qty, "note": ""}],
        )
        order_services.start_preparing(order, self.waiter)
        order_services.mark_ready(order, self.waiter)
        order_services.mark_served(order, self.waiter)
        return order

    def test_deduct_for_order_consumes_ingredients(self):
        order = self._serve(qty=3)
        moves = services.deduct_for_order(order, actor=self.admin)
        self.wrapper.refresh_from_db()
        # 3 momos × 10 wrappers = 30 consumed from 100.
        self.assertEqual(moves, 1)
        self.assertEqual(self.wrapper.quantity, Decimal("70.000"))

    def test_payment_triggers_auto_deduction(self):
        order = self._serve(qty=2)
        bill = billing_services.generate_bill(order, actor=self.waiter)
        billing_services.mark_paid(bill, method="CASH", actor=self.admin)
        self.wrapper.refresh_from_db()
        # 2 × 10 = 20 consumed on the completed sale.
        self.assertEqual(self.wrapper.quantity, Decimal("80.000"))

    def test_no_recipe_means_no_deduction(self):
        plain = MenuItem.objects.create(
            category=self.momo.category, name="Cola", price=Decimal("60")
        )
        order = order_services.create_order(
            waiter=self.waiter,
            table=self.table,
            guest_count=1,
            note="",
            items=[{"menu_item": plain, "quantity": 5, "note": ""}],
        )
        moves = services.deduct_for_order(order, actor=self.admin)
        self.assertEqual(moves, 0)
