import csv

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.http import StreamingHttpResponse

from apps.accounts.permissions import IsAdminOrAccountant

from . import services


class SalesReportView(APIView):
    """Aggregated sales for a period — totals, trend, and breakdowns."""

    permission_classes = [IsAuthenticated, IsAdminOrAccountant]

    def get(self, request):
        try:
            start, end, label = services.resolve_range(request.query_params)
        except ValueError:
            return Response({"detail": "Invalid date range."}, status=400)
        data = services.sales_report(start, end)
        data["label"] = label
        return Response(data)


class _Echo:
    def write(self, value):
        return value


class StaffMealsReportView(APIView):
    """Per-staff totals of staff meals for the period — accountant settles these."""

    permission_classes = [IsAuthenticated, IsAdminOrAccountant]

    def get(self, request):
        try:
            start, end, label = services.resolve_range(request.query_params)
        except ValueError:
            return Response({"detail": "Invalid date range."}, status=400)
        data = services.staff_meals_report(start, end)
        data["label"] = label
        return Response(data)


class SalesExportView(APIView):
    """Stream the period's paid bills as a CSV download."""

    permission_classes = [IsAuthenticated, IsAdminOrAccountant]

    def get(self, request):
        try:
            start, end, _ = services.resolve_range(request.query_params)
        except ValueError:
            return Response({"detail": "Invalid date range."}, status=400)

        writer = csv.writer(_Echo())
        rows = (writer.writerow(row) for row in services.sales_csv_rows(start, end))
        response = StreamingHttpResponse(rows, content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="sales_{start.isoformat()}_{end.isoformat()}.csv"'
        )
        return response
