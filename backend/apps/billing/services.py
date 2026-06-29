"""
Bill generation and payment confirmation.

The software never moves money — it computes what the guest owes, stores it, and
records an admin's confirmation that cash/῾QR was received at the counter. Tax and
service-charge *rates* are snapshotted onto the bill so a later settings change
never rewrites a historical total.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.models import AuditLog, RestaurantSettings
from apps.floor.models import TableStatus
from apps.orders.models import Order, OrderStatus
from apps.orders.services import _free_table_if_idle, broadcast_order

from .models import Bill, PaymentStatus

TWO_DP = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(value).quantize(TWO_DP, rounding=ROUND_HALF_UP)


def compute_totals(subtotal: Decimal, discount: Decimal, sc_pct: Decimal, vat_pct: Decimal) -> dict:
    """Pure tax math, shared by generation and previews.

    Order of operations: discount first, then service charge on the discounted
    amount, then VAT on (discounted + service charge).
    """
    subtotal = _money(subtotal)
    discount = _money(max(Decimal("0"), min(discount, subtotal)))
    taxable = subtotal - discount
    service_charge = _money(taxable * sc_pct / 100)
    vat = _money((taxable + service_charge) * vat_pct / 100)
    total = _money(taxable + service_charge + vat)
    return {
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": service_charge,
        "vat": vat,
        "total": total,
        "service_charge_percent": sc_pct,
        "vat_percent": vat_pct,
    }


@transaction.atomic
def generate_bill(order: Order, *, discount=Decimal("0"), actor=None) -> Bill:
    """Create or refresh an UNPAID bill and move the order/table into billing."""
    if order.status in (OrderStatus.PAID, OrderStatus.CANCELLED):
        raise ValueError("This order is already closed.")

    cfg = RestaurantSettings.load()
    # Staff meals are charged at cost — no service charge or VAT.
    sc_pct = Decimal("0") if order.is_staff_meal else cfg.service_charge_percent
    vat_pct = Decimal("0") if order.is_staff_meal else cfg.vat_percent
    totals = compute_totals(order.subtotal, Decimal(discount or 0), sc_pct, vat_pct)

    bill, created = Bill.objects.select_for_update().get_or_create(order=order, defaults=totals)
    if not created:
        if bill.payment_status == PaymentStatus.PAID:
            return bill  # never re-bill a settled order
        for field, value in totals.items():
            setattr(bill, field, value)
    if not bill.bill_number:
        bill.bill_number = f"B{bill.pk:06d}"
    bill.save()

    if order.status != OrderStatus.BILLED:
        order.status = OrderStatus.BILLED
        order.save(update_fields=["status"])
    if order.table.status != TableStatus.BILLING:
        order.table.status = TableStatus.BILLING
        order.table.save(update_fields=["status"])

    AuditLog.record(actor, "bill.generated", "bill", bill.id, total=str(bill.total))
    broadcast_order(order, "order.billed")
    return bill


@transaction.atomic
def mark_paid(bill: Bill, *, method="", actor=None) -> Bill:
    """Admin confirms the guest paid; the order closes and the table frees up."""
    if bill.payment_status == PaymentStatus.PAID:
        return bill

    bill.payment_status = PaymentStatus.PAID
    bill.payment_method = method or ""
    bill.confirmed_by = actor if getattr(actor, "is_authenticated", False) else None
    bill.paid_at = timezone.now()
    bill.save(update_fields=["payment_status", "payment_method", "confirmed_by", "paid_at"])

    order = bill.order
    order.status = OrderStatus.PAID
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "closed_at"])
    _free_table_if_idle(order)

    # Auto-deduct ingredients for any menu items that have a recipe configured.
    from apps.inventory.services import deduct_for_order

    deduct_for_order(order, actor=actor)

    AuditLog.record(actor, "bill.paid", "bill", bill.id, method=bill.payment_method)
    broadcast_order(order, "order.paid")
    return bill
