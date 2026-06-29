"""Cross-cutting models: a timestamp base, restaurant settings, and an audit log."""

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base adding created/updated timestamps to every concrete model."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class RestaurantSettings(models.Model):
    """Singleton holding venue-wide configuration (one row, pk=1)."""

    name = models.CharField(max_length=120, default="My Restaurant")
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    pan_vat_no = models.CharField("PAN/VAT number", max_length=40, blank=True)
    logo = models.ImageField(upload_to="branding/", blank=True, null=True)

    currency_code = models.CharField(max_length=8, default="NPR")
    currency_symbol = models.CharField(max_length=8, default="Rs")
    # Percentages applied at billing time.
    vat_percent = models.DecimalField(max_digits=5, decimal_places=2, default=13)
    service_charge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=10
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restaurant settings"
        verbose_name_plural = "Restaurant settings"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "RestaurantSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AuditLog(models.Model):
    """Append-only record of meaningful actions across the system."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_entries",
    )
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=80, blank=True)
    entity_id = models.CharField(max_length=40, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "entity_id"])]

    def __str__(self) -> str:
        who = self.actor.username if self.actor else "system"
        return f"{who} · {self.action} · {self.entity}#{self.entity_id}"

    @classmethod
    def record(cls, actor, action, entity="", entity_id="", **detail):
        is_auth = bool(actor and getattr(actor, "is_authenticated", False))
        return cls.objects.create(
            actor=actor if is_auth else None,
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            detail=detail,
        )
