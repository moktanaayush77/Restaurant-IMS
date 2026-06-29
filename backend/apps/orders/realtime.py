"""
Helpers for pushing live events to the role-scoped WebSocket groups.

Groups:
  - "kitchen"      every chef / KDS screen
  - "reception"    every admin / reception board
  - "waiters"      all waiters (broad notices)
  - "waiter_<id>"  a single waiter (targeted "order ready" pings)
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

GROUP_KITCHEN = "kitchen"
GROUP_RECEPTION = "reception"
GROUP_WAITERS = "waiters"


def waiter_group(user_id) -> str:
    return f"waiter_{user_id}"


def broadcast(groups, event_type: str, payload: dict) -> None:
    """Send ``payload`` to one or more groups as a ``live_event`` message."""
    layer = get_channel_layer()
    if layer is None:
        return
    if isinstance(groups, str):
        groups = [groups]
    message = {"type": "live_event", "event": event_type, "payload": payload}
    for group in groups:
        async_to_sync(layer.group_send)(group, message)
