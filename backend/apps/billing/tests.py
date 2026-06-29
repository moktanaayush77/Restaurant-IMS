"""Billing math and the generate → pay flow."""

from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import Role, User
from apps.catalog.models import MenuCategory, MenuItem
from apps.core.models import RestaurantSettings
from apps.floor.models import Table, TableStatus
from apps.orders import services as order_services
from apps.orders.models import OrderStatus

from . import services
from .models import Bill, PaymentStatus


class BillingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.waiter = User.objects.create_user("ramesh", role=Role.WAITER)
        cls.admin = User.objects.create_user("admin", role=Role.ADMIN)
        cls.table = Table.objects.create(name="T1")
        cat = MenuCategory.objects.create(name="Mains")
        cls.momo = MenuItem.objects.create(category=cat, name="Momo", price=Decimal("180"))
        cls.dal = MenuItem.objects.create(category=cat, name="Dal", price=Decimal("250"))
        # Lock known rates for deterministic math: 10% service, 13% VAT.
        cfg = RestaurantSettings.load()
        cfg.service_charge_percent = Decimal("10")
        cfg.vat_percent = Decimal("13")
        cfg.save()

    def _served_order(self):
        order = order_services.create_order(
            waiter=self.waiter,
            table=self.table,
            guest_count=2,
            note="",
            items=[
                {"menu_item": self.momo, "quantity": 2, "note": ""},  # 360
                {"menu_item": self.dal, "quantity": 1, "note": ""},  # 250
            ],
        )
        order_services.start_preparing(order, self.waiter)
        order_services.mark_ready(order, self.waiter)
        order_services.mark_served(order, self.waiter)
        return order

    def test_bill_totals_apply_service_charge_then_vat(self):
        order = self._served_order()
        bill = services.generate_bill(order, actor=self.waiter)
        order.refresh_from_db()
        self.table.refresh_from_db()

        # subtotal 610 → +10% service (61) → +13% VAT on 671 (87.23) → 758.23
        self.assertEqual(bill.subtotal, Decimal("610.00"))
        self.assertEqual(bill.service_charge, Decimal("61.00"))
        self.assertEqual(bill.vat, Decimal("87.23"))
        self.assertEqual(bill.total, Decimal("758.23"))
        self.assertTrue(bill.bill_number)
        self.assertEqual(order.status, OrderStatus.BILLED)
        self.assertEqual(self.table.status, TableStatus.BILLING)

    def test_discount_reduces_the_taxable_base(self):
        order = self._served_order()
        bill = services.generate_bill(order, discount=Decimal("110"), actor=self.waiter)
        # taxable 500 → service 50 → VAT on 550 = 71.50 → total 621.50
        self.assertEqual(bill.discount, Decimal("110.00"))
        self.assertEqual(bill.service_charge, Decimal("50.00"))
        self.assertEqual(bill.vat, Decimal("71.50"))
        self.assertEqual(bill.total, Decimal("621.50"))

    def test_regenerating_an_unpaid_bill_updates_in_place(self):
        order = self._served_order()
        first = services.generate_bill(order, actor=self.waiter)
        again = services.generate_bill(order, discount=Decimal("60"), actor=self.waiter)
        self.assertEqual(first.pk, again.pk)
        self.assertEqual(again.discount, Decimal("60.00"))
        self.assertEqual(Bill.objects.filter(order=order).count(), 1)

    def test_paying_closes_the_order_and_frees_the_table(self):
        order = self._served_order()
        bill = services.generate_bill(order, actor=self.waiter)
        paid = services.mark_paid(bill, method="CASH", actor=self.admin)
        order.refresh_from_db()
        self.table.refresh_from_db()

        self.assertEqual(paid.payment_status, PaymentStatus.PAID)
        self.assertEqual(paid.payment_method, "CASH")
        self.assertEqual(paid.confirmed_by, self.admin)
        self.assertIsNotNone(paid.paid_at)
        self.assertEqual(order.status, OrderStatus.PAID)
        self.assertIsNotNone(order.closed_at)
        self.assertEqual(self.table.status, TableStatus.FREE)

    def test_cannot_rebill_a_paid_order(self):
        order = self._served_order()
        bill = services.generate_bill(order, actor=self.waiter)
        services.mark_paid(bill, method="CASH", actor=self.admin)
        # A closed (paid) order is refused outright.
        with self.assertRaises(ValueError):
            services.generate_bill(order, discount=Decimal("500"), actor=self.waiter)
