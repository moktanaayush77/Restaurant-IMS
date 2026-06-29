"""Project-level WebSocket URL routing."""

from apps.orders.routing import websocket_urlpatterns as order_ws

websocket_urlpatterns = [
    *order_ws,
]
