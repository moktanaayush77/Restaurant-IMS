"""
Sales reporting over *paid* bills.

Revenue is recognised when an admin confirms payment (``Bill.paid_at``), so every
figure here reconciles with money actually taken at the counter. Item- and
category-level breakdowns use the order-line snapshots, so historical menu edits
never distort past reports.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.billing.models import Bill, PaymentStatus
from apps.orders.models import ItemStatus, Order, OrderItem, OrderStatus

LINE_TOTAL = ExpressionWrapper(
    F("unit_price") * F("quantity"), output_field=DecimalField(max_digits=14, decimal_places=2)
)


def resolve_range(params) -> tuple[date, date, str]:
    """Turn query params into an inclusive [start, end] date range and a label."""
    today = timezone.localdate()
    start_s, end_s = params.get("start"), params.get("end")
    if start_s and end_s:
        return date.fromisoformat(start_s), date.fromisoformat(end_s), "Custom range"

    period = params.get("period", "30d")
    table = {
        "today": (today, "Today"),
        "7d": (today - timedelta(days=6), "Last 7 days"),
        "30d": (today - timedelta(days=29), "Last 30 days"),
        "year": (today.replace(month=1, day=1), "This year"),
        "all": (date(2000, 1, 1), "All time"),
    }
    start, label = table.get(period, table["30d"])
    return start, today, label


def _paid_bills(start: date, end: date):
    return Bill.objects.filter(
        payment_status=PaymentStatus.PAID, paid_at__date__range=(start, end)
    )


def staff_meals_report(start: date, end: date) -> dict:
    """Per-staff total of staff meals in the range — what the accountant deducts."""
    orders = (
        Order.objects.filter(
            is_staff_meal=True,
            staff_member__isnull=False,
            created_at__date__range=(start, end),
        )
        .exclude(status=OrderStatus.CANCELLED)
        .select_related("staff_member")
        .prefetch_related("items")
    )
    by_staff: dict[int, dict] = {}
    for o in orders:
        s = o.staff_member
        row = by_staff.setdefault(
            s.id, {"staff": s.display_name, "orders": 0, "total": Decimal("0")}
        )
        row["orders"] += 1
        row["total"] += o.subtotal
    rows = sorted(by_staff.values(), key=lambda r: r["total"], reverse=True)
    grand = sum((r["total"] for r in rows), Decimal("0"))
    return {
        "rows": [
            {"staff": r["staff"], "orders": r["orders"], "total": _f(r["total"])} for r in rows
        ],
        "grand_total": _f(grand),
    }


def _f(value) -> float:
    return float(value or 0)


def sales_report(start: date, end: date) -> dict:
    bills = _paid_bills(start, end)

    totals = bills.aggregate(
        gross=Sum("total"),
        net=Sum("subtotal"),
        discount=Sum("discount"),
        service_charge=Sum("service_charge"),
        vat=Sum("vat"),
        orders=Count("id"),
        avg_bill=Avg("total"),
    )

    by_day = [
        {"date": row["day"].isoformat(), "total": _f(row["total"]), "orders": row["orders"]}
        for row in bills.annotate(day=TruncDate("paid_at"))
        .values("day")
        .annotate(total=Sum("total"), orders=Count("id"))
        .order_by("day")
    ]

    by_payment = [
        {"method": row["payment_method"] or "OTHER", "total": _f(row["total"]), "count": row["count"]}
        for row in bills.values("payment_method")
        .annotate(total=Sum("total"), count=Count("id"))
        .order_by("-total")
    ]

    by_waiter = [
        {
            "waiter": (f"{r['order__waiter__first_name']} {r['order__waiter__last_name']}".strip()
                       or r["order__waiter__username"] or "—"),
            "orders": r["orders"],
            "revenue": _f(r["revenue"]),
        }
        for r in bills.values(
            "order__waiter__username",
            "order__waiter__first_name",
            "order__waiter__last_name",
        )
        .annotate(orders=Count("id"), revenue=Sum("total"))
        .order_by("-revenue")
    ]

    # Item / category breakdowns from the lines of paid orders.
    paid_lines = OrderItem.objects.filter(
        order__bill__payment_status=PaymentStatus.PAID,
        order__bill__paid_at__date__range=(start, end),
    ).exclude(status=ItemStatus.CANCELLED)

    by_item = [
        {"name": r["name_snapshot"], "quantity": r["qty"], "revenue": _f(r["revenue"])}
        for r in paid_lines.values("name_snapshot")
        .annotate(qty=Sum("quantity"), revenue=Sum(LINE_TOTAL))
        .order_by("-revenue")[:20]
    ]

    by_category = [
        {"name": r["menu_item__category__name"] or "—", "revenue": _f(r["revenue"])}
        for r in paid_lines.values("menu_item__category__name")
        .annotate(revenue=Sum(LINE_TOTAL))
        .order_by("-revenue")
    ]

    items_sold = paid_lines.aggregate(n=Sum("quantity"))["n"] or 0

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "totals": {
            "gross": _f(totals["gross"]),
            "net": _f(totals["net"]),
            "discount": _f(totals["discount"]),
            "service_charge": _f(totals["service_charge"]),
            "vat": _f(totals["vat"]),
            "orders": totals["orders"] or 0,
            "items_sold": int(items_sold),
            "avg_bill": _f(totals["avg_bill"]),
        },
        "by_day": by_day,
        "by_payment": by_payment,
        "by_waiter": by_waiter,
        "by_item": by_item,
        "by_category": by_category,
    }


def sales_csv_rows(start: date, end: date):
    """Yield rows (lists) for a per-bill CSV export."""
    yield ["Bill", "Paid at", "Table", "Waiter", "Subtotal", "Discount", "Service", "VAT", "Total", "Method"]
    bills = (
        _paid_bills(start, end)
        .select_related("order", "order__table", "order__waiter")
        .order_by("paid_at")
    )
    for b in bills:
        yield [
            b.bill_number,
            timezone.localtime(b.paid_at).strftime("%Y-%m-%d %H:%M") if b.paid_at else "",
            b.order.table.name if b.order and b.order.table else "",
            b.order.waiter.display_name if b.order and b.order.waiter else "",
            b.subtotal,
            b.discount,
            b.service_charge,
            b.vat,
            b.total,
            b.payment_method or "",
        ]
