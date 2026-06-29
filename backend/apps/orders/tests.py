"""Order lifecycle (state-machine) tests — the heart of the live pipeline.

These cover the service layer directly: status transitions, line-item status
propagation, table occupancy, and the subtotal snapshot. The channel layer is
the in-memory backend under tests, so broadcasts are exercised but not asserted.
"""

from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import Role, User
from apps.catalog.models import MenuCategory, MenuItem
from apps.floor.models import Table, TableStatus

from . import services
from .models import ItemStatus, Order, OrderStatus


class OrderLifecycleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.waiter = User.objects.create_user("ramesh", role=Role.WAITER)
        cls.chef = User.objects.create_user("bikash", role=Role.CHEF)
        cls.table = Table.objects.create(name="T1")
        cat = MenuCategory.objects.create(name="Mains")
        cls.momo = MenuItem.objects.create(category=cat, name="Chicken Momo", price=Decimal("180"))
        cls.dal = MenuItem.objects.create(category=cat, name="Dal Bhat", price=Decimal("250"))

    def _place(self, **qty):
        items = [
            {"menu_item": self.momo, "quantity": qty.get("momo", 2), "note": ""},
            {"menu_item": self.dal, "quantity": qty.get("dal", 1), "note": "less spicy"},
        ]
        return services.create_order(
            waiter=self.waiter, table=self.table, guest_count=3, note="", items=items
        )

    def test_placing_an_order_seats_the_table_and_snapshots_price(self):
        order = self._place()
        self.table.refresh_from_db()

        self.assertEqual(order.status, OrderStatus.PLACED)
        self.assertEqual(self.table.status, TableStatus.OCCUPIED)
        self.assertEqual(order.items.count(), 2)
        # 2×180 + 1×250
        self.assertEqual(order.subtotal, Decimal("610"))
        # Price/name are snapshotted so later menu edits don't rewrite history.
        line = order.items.get(menu_item=self.momo)
        self.assertEqual(line.unit_price, Decimal("180"))
        self.assertEqual(line.name_snapshot, "Chicken Momo")

    def test_full_happy_path_transitions(self):
        order = self._place()

        services.start_preparing(order, self.chef)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PREPARING)
        self.assertTrue(all(i.status == ItemStatus.PREPARING for i in order.items.all()))

        services.mark_ready(order, self.chef)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.READY)
        self.assertIsNotNone(order.ready_at)
        self.assertTrue(all(i.status == ItemStatus.READY for i in order.items.all()))

        services.mark_served(order, self.waiter)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.SERVED)
        self.assertIsNotNone(order.served_at)
        self.assertTrue(all(i.status == ItemStatus.SERVED for i in order.items.all()))

    def test_adding_a_round_reopens_a_ready_ticket(self):
        order = self._place()
        services.start_preparing(order, self.chef)
        services.mark_ready(order, self.chef)

        services.add_items(
            order, [{"menu_item": self.dal, "quantity": 1, "note": ""}], actor=self.waiter
        )
        order.refresh_from_db()
        # A new round pulls the kitchen back to PREPARING and clears ready_at.
        self.assertEqual(order.status, OrderStatus.PREPARING)
        self.assertIsNone(order.ready_at)
        self.assertEqual(order.items.count(), 3)

    def test_cancelling_frees_the_table_when_no_other_orders(self):
        order = self._place()
        services.cancel_order(order, self.waiter, reason="walked out")
        order.refresh_from_db()
        self.table.refresh_from_db()

        self.assertEqual(order.status, OrderStatus.CANCELLED)
        self.assertEqual(self.table.status, TableStatus.FREE)
        self.assertTrue(all(i.status == ItemStatus.CANCELLED for i in order.items.all()))

    def test_cancelling_keeps_table_occupied_if_another_order_is_active(self):
        first = self._place()
        second = self._place()
        services.cancel_order(first, self.waiter)
        self.table.refresh_from_db()

        # The second order still holds the table.
        self.assertEqual(self.table.status, TableStatus.OCCUPIED)
        self.assertTrue(second.is_active)

    def test_subtotal_ignores_cancelled_lines(self):
        order = self._place(momo=2, dal=1)
        line = order.items.get(menu_item=self.dal)
        line.status = ItemStatus.CANCELLED
        line.save(update_fields=["status"])
        # Only the 2×180 momo counts now.
        self.assertEqual(order.subtotal, Decimal("360"))

    # ---- Per-item (dish-by-dish) flow ---------------------------------- #

    def test_one_ready_item_flips_order_to_ready_others_keep_cooking(self):
        order = self._place()
        momo = order.items.get(menu_item=self.momo)
        dal = order.items.get(menu_item=self.dal)

        services.set_item_status(order, momo, "ready", self.chef)
        order.refresh_from_db()
        # The order signals READY (something to deliver) while dal is untouched.
        self.assertEqual(order.status, OrderStatus.READY)
        self.assertIsNotNone(order.ready_at)
        self.assertEqual(order.items.get(pk=momo.pk).status, ItemStatus.READY)
        self.assertEqual(order.items.get(pk=dal.pk).status, ItemStatus.PENDING)

    def test_serving_a_ready_item_returns_order_to_preparing_if_more_cooking(self):
        order = self._place()
        momo = order.items.get(menu_item=self.momo)
        services.set_item_status(order, momo, "ready", self.chef)
        services.set_item_status(order, momo, "serve", self.waiter)
        order.refresh_from_db()
        # Momo delivered hot; dal still pending, so the order is back to PREPARING.
        self.assertEqual(order.status, OrderStatus.PREPARING)
        self.assertEqual(order.items.get(pk=momo.pk).status, ItemStatus.SERVED)

    def test_full_dish_by_dish_completes_only_when_all_served(self):
        order = self._place()
        momo = order.items.get(menu_item=self.momo)
        dal = order.items.get(menu_item=self.dal)
        for line in (momo, dal):
            services.set_item_status(order, line, "ready", self.chef)
            services.set_item_status(order, line, "serve", self.waiter)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.SERVED)
        self.assertIsNotNone(order.served_at)

    def test_mark_served_only_serves_ready_items(self):
        order = self._place()
        momo = order.items.get(menu_item=self.momo)
        services.set_item_status(order, momo, "ready", self.chef)
        # The order-level "serve" only delivers what's ready, not the still-cooking dal.
        services.mark_served(order, self.waiter)
        order.refresh_from_db()
        self.assertEqual(order.items.get(menu_item=self.momo).status, ItemStatus.SERVED)
        self.assertEqual(order.items.get(menu_item=self.dal).status, ItemStatus.PENDING)
        self.assertEqual(order.status, OrderStatus.PREPARING)

    def test_item_action_rejects_foreign_or_cancelled_item(self):
        order = self._place()
        other = self._place()
        foreign = other.items.first()
        with self.assertRaises(ValueError):
            services.set_item_status(order, foreign, "ready", self.chef)

        line = order.items.first()
        line.status = ItemStatus.CANCELLED
        line.save(update_fields=["status"])
        with self.assertRaises(ValueError):
            services.set_item_status(order, line, "ready", self.chef)
