from django.urls import path

from .views import SalesExportView, SalesReportView, StaffMealsReportView

urlpatterns = [
    path("reports/sales/", SalesReportView.as_view(), name="sales-report"),
    path("reports/sales/export/", SalesExportView.as_view(), name="sales-export"),
    path("reports/staff-meals/", StaffMealsReportView.as_view(), name="staff-meals-report"),
]
