from rest_framework.routers import DefaultRouter

from .views import InventoryItemViewSet, RecipeComponentViewSet, StockTransactionViewSet

router = DefaultRouter()
router.register("inventory/items", InventoryItemViewSet, basename="inventory-item")
router.register("inventory/transactions", StockTransactionViewSet, basename="stock-transaction")
router.register("inventory/recipes", RecipeComponentViewSet, basename="recipe-component")

urlpatterns = router.urls
