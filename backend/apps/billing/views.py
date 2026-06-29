from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.orders.models import Order

from . import services
from .models import Bill, PaymentStatus
from .serializers import BillSerializer, GenerateBillSerializer, PayBillSerializer


def _require(user, *roles):
    if user.role not in roles:
        raise PermissionDenied("Your role can't perform this action.")


class BillViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Bills are read by admins; waiters generate them, admins confirm payment."""

    permission_classes = [IsAuthenticated]
    serializer_class = BillSerializer

    def get_queryset(self):
        qs = Bill.objects.select_related("order", "order__table", "order__waiter", "confirmed_by")
        params = self.request.query_params
        if ps := params.get("payment_status"):
            qs = qs.filter(payment_status=ps)
        if order := params.get("order"):
            qs = qs.filter(order_id=order)
        return qs

    @action(detail=False, methods=["post"])
    def generate(self, request):
        _require(request.user, Role.WAITER, Role.ADMIN, Role.ACCOUNTANT)
        payload = GenerateBillSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        order = get_object_or_404(Order, pk=payload.validated_data["order"])
        try:
            bill = services.generate_bill(
                order, discount=payload.validated_data.get("discount", 0), actor=request.user
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BillSerializer(bill).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        _require(request.user, Role.ADMIN, Role.ACCOUNTANT)
        bill = self.get_object()
        if bill.payment_status == PaymentStatus.PAID:
            return Response({"detail": "This bill is already paid."}, status=400)
        payload = PayBillSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        bill = services.mark_paid(
            bill, method=payload.validated_data.get("payment_method", ""), actor=request.user
        )
        return Response(BillSerializer(bill).data)
