from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role

User = get_user_model()


def tokens_for(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class UserSerializer(serializers.ModelSerializer):
    """Public-facing user shape returned to the client."""

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "email",
            "phone",
            "role",
            "is_active",
        ]


class StaffSerializer(serializers.ModelSerializer):
    """Read/update shape for managing waiters and chefs."""

    display_name = serializers.CharField(read_only=True)
    pin = serializers.CharField(write_only=True, required=False, min_length=4, max_length=6)
    password = serializers.CharField(
        write_only=True, required=False, min_length=8, style={"input_type": "password"}
    )
    has_pin = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "phone",
            "role",
            "is_active",
            "pin",
            "password",
            "has_pin",
            "has_password",
            "date_joined",
        ]
        read_only_fields = ["date_joined"]

    def get_has_pin(self, obj) -> bool:
        return bool(obj.pin_hash)

    def get_has_password(self, obj) -> bool:
        return obj.has_usable_password()

    def validate_role(self, value):
        if value == Role.ADMIN:
            raise serializers.ValidationError("Use the admin tools to manage admins.")
        return value

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("PIN must be digits only.")
        return value

    def validate_password(self, value):
        # Run staff passwords through Django's configured validators
        # (length, common-password, numeric-only) instead of bypassing them.
        try:
            django_validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        pin = validated_data.pop("pin", None)
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if pin:
            user.set_pin(pin)
        # A password is optional; staff log in by PIN unless an admin sets one.
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        pin = validated_data.pop("pin", None)
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if pin:
            instance.set_pin(pin)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    """Admin login with username + password."""

    username = serializers.CharField()
    password = serializers.CharField(style={"input_type": "password"}, write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        attrs["user"] = user
        return attrs


class PinLoginSerializer(serializers.Serializer):
    """Floor-staff login with username + numeric PIN (waiter / chef)."""

    username = serializers.CharField()
    pin = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            user = User.objects.get(username__iexact=attrs["username"], is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid username or PIN.")
        if user.role in (Role.ADMIN, Role.ACCOUNTANT):
            raise serializers.ValidationError("This account signs in with a password.")
        if not user.check_pin(attrs["pin"]):
            raise serializers.ValidationError("Invalid username or PIN.")
        attrs["user"] = user
        return attrs
