from rest_framework.routers import DefaultRouter

from .views import MenuCategoryViewSet, MenuItemViewSet

router = DefaultRouter()
router.register("menu/categories", MenuCategoryViewSet, basename="menu-category")
router.register("menu/items", MenuItemViewSet, basename="menu-item")

urlpatterns = router.urls
