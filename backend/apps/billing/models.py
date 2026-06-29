"""Bills — calculated and stored in-app; payment itself happens at the counter."""

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class PaymentStatus(models.TextChoices):
    UNPAID = "UNPAID", "Unpaid"
    PAID = "PAID", "Paid"


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Cash"
    CARD = "CARD", "Card"
    ESEWA = "ESEWA", "eSewa"
    KHALTI = "KHALTI", "Khalti"
    BANK = "BANK", "Bank / QR"
    STAFF = "STAFF", "Staff (salary deduction)"
    OTHER = "OTHER", "Other"


class Bill(TimeStampedModel):
    """
    A snapshot of what the guest owes. The software never processes money — it
    computes and stores the amount; an admin confirms payment after the guest
    pays at the counter.
    """

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="bill")
    bill_number = models.CharField(max_length=20, unique=True, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Rates captured at generation time so a later settings change won't alter old bills.
    service_charge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    payment_status = models.CharField(
        max_length=8, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )
    payment_method = models.CharField(
        max_length=8, choices=PaymentMethod.choices, blank=True
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_bills",
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.bill_number or f"Bill for order #{self.order_id}"
