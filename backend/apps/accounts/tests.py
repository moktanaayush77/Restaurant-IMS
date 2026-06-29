"""Staff credential management: PIN and optional password."""

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Role, User
from .serializers import StaffSerializer


class StaffCredentialTests(TestCase):
    def test_create_with_pin_only_has_no_usable_password(self):
        s = StaffSerializer(data={"username": "ram", "role": "WAITER", "pin": "1234"})
        s.is_valid(raise_exception=True)
        user = s.save()
        self.assertTrue(user.check_pin("1234"))
        self.assertFalse(user.has_usable_password())

    def test_create_with_password(self):
        s = StaffSerializer(
            data={"username": "mgr", "role": "WAITER", "pin": "1234", "password": "secret1"}
        )
        s.is_valid(raise_exception=True)
        user = s.save()
        self.assertTrue(user.has_usable_password())
        self.assertTrue(user.check_password("secret1"))
        self.assertTrue(user.check_pin("1234"))

    def test_create_with_password_only(self):
        s = StaffSerializer(data={"username": "cashier", "role": "CHEF", "password": "secret1"})
        s.is_valid(raise_exception=True)
        user = s.save()
        self.assertTrue(user.has_usable_password())
        self.assertFalse(bool(user.pin_hash))

    def test_update_sets_password_without_touching_pin(self):
        user = User.objects.create(username="ram", role=Role.WAITER)
        user.set_pin("1234")
        user.save()
        s = StaffSerializer(user, data={"password": "newpass"}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        user.refresh_from_db()
        self.assertTrue(user.check_password("newpass"))
        self.assertTrue(user.check_pin("1234"))  # PIN untouched

    def test_serializer_reports_credential_flags(self):
        user = User.objects.create(username="ram", role=Role.WAITER)
        user.set_pin("1234")
        user.set_password("pw1234")
        user.save()
        data = StaffSerializer(user).data
        self.assertTrue(data["has_pin"])
        self.assertTrue(data["has_password"])
        self.assertNotIn("password", data)  # write-only, never leaked

    def test_staff_with_password_can_log_in_via_password_endpoint(self):
        user = User.objects.create(username="mgr", role=Role.WAITER, is_active=True)
        user.set_password("secret1")
        user.save()
        res = APIClient().post(
            "/api/auth/login/", {"username": "mgr", "password": "secret1"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["username"], "mgr")
        self.assertIn("access", res.data["tokens"])
