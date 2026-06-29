"""Custom user model with roles and a fast numeric-PIN login for floor staff."""

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Admin / Reception"
    WAITER = "WAITER", "Waiter"
    CHEF = "CHEF", "Chef / Kitchen"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"  # billing + reports + read-only inventory


class User(AbstractUser):
    """
    A single user table for everyone.

    - Admins authenticate with username + password (Django's standard hash).
    - Waiters and chefs authenticate with username + a short numeric PIN, hashed
      with the same machinery and stored separately so it can be reset by an admin
      without touching the password field.
    """

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.WAITER)
    phone = models.CharField(max_length=40, blank=True)
    pin_hash = models.CharField(max_length=128, blank=True, default="")

    @property
    def display_name(self) -> str:
        full = self.get_full_name().strip()
        return full or self.username

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    # -- PIN helpers --------------------------------------------------------- #
    def set_pin(self, raw_pin: str) -> None:
        self.pin_hash = make_password(str(raw_pin))

    def check_pin(self, raw_pin: str) -> bool:
        if not self.pin_hash:
            return False
        return check_password(str(raw_pin), self.pin_hash)

    def __str__(self) -> str:
        return f"{self.display_name} ({self.get_role_display()})"
