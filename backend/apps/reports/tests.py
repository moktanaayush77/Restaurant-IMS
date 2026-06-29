"""Sales report aggregation over paid bills."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.billing import services as billing_services
from apps.catalog.models import MenuCategory, MenuItem
from apps.core.models import RestaurantSettings
from apps.floor.models import Table
from apps.orders import services as order_services

from . import services


class SalesReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.waiter = User.objects.create_user("ramesh", first_name="Ramesh", role=Role.WAITER)
        cls.admin = User.objects.create_user("admin", role=Role.ADMIN)
        cat = MenuCategory.objects.create(name="Mains")
        cls.momo = MenuItem.objects.create(category=cat, name="Momo", price=Decimal("100"))
        cfg = RestaurantSettings.load()
        cfg.service_charge_percent = Decimal("0")
        cfg.vat_percent = Decimal("0")
        cfg.save()

    def _sell(self, qty, method="CASH"):
        table = Table.objects.create(name=f"T{Table.objects.count() + 1}")
        order = order_services.create_order(
            waiter=self.waiter,
            table=table,
            guest_count=1,
            note="",
            items=[{"menu_item": self.momo, "quantity": qty, "note": ""}],
        )
        order_services.mark_served(order, self.waiter)
        bill = billing_services.generate_bill(order, actor=self.waiter)
        return billing_services.mark_paid(bill, method=method, actor=self.admin)

    def test_totals_and_breakdowns(self):
        self._sell(2, method="CASH")  # 200
        self._sell(3, method="CARD")  # 300

        today = timezone.localdate()
        report = services.sales_report(today, today)

        self.assertEqual(report["totals"]["gross"], 500.0)
        self.assertEqual(report["totals"]["orders"], 2)
        self.assertEqual(report["totals"]["items_sold"], 5)
        self.assertEqual(report["totals"]["avg_bill"], 250.0)

        # One item, one category, one waiter.
        self.assertEqual(report["by_item"][0]["name"], "Momo")
        self.assertEqual(report["by_item"][0]["quantity"], 5)
        self.assertEqual(report["by_item"][0]["revenue"], 500.0)
        self.assertEqual(report["by_category"][0]["name"], "Mains")
        self.assertEqual(report["by_waiter"][0]["waiter"], "Ramesh")
        self.assertEqual(report["by_waiter"][0]["revenue"], 500.0)

        methods = {r["method"]: r["total"] for r in report["by_payment"]}
        self.assertEqual(methods["CASH"], 200.0)
        self.assertEqual(methods["CARD"], 300.0)

    def test_unpaid_orders_are_excluded(self):
        self._sell(2)  # paid → counts
        # An order that's served but never paid must not appear in revenue.
        table = Table.objects.create(name="T99")
        order = order_services.create_order(
            waiter=self.waiter, table=table, guest_count=1, note="",
            items=[{"menu_item": self.momo, "quantity": 9, "note": ""}],
        )
        order_services.mark_served(order, self.waiter)
        billing_services.generate_bill(order, actor=self.waiter)  # billed, not paid

        today = timezone.localdate()
        report = services.sales_report(today, today)
        self.assertEqual(report["totals"]["gross"], 200.0)
        self.assertEqual(report["totals"]["orders"], 1)

    def test_by_day_groups_across_dates(self):
        b_today = self._sell(1)
        b_old = self._sell(2)
        # Backdate one payment to yesterday.
        yesterday = timezone.now() - timedelta(days=1)
        type(b_old).objects.filter(pk=b_old.pk).update(paid_at=yesterday)

        start = (timezone.localdate() - timedelta(days=2))
        end = timezone.localdate()
        report = services.sales_report(start, end)
        self.assertEqual(len(report["by_day"]), 2)
        self.assertEqual(report["totals"]["gross"], 300.0)

    def test_csv_rows_include_header_and_each_bill(self):
        self._sell(1)
        self._sell(1)
        today = timezone.localdate()
        rows = list(services.sales_csv_rows(today, today))
        self.assertEqual(rows[0][0], "Bill")  # header
        self.assertEqual(len(rows), 3)  # header + 2 bills
