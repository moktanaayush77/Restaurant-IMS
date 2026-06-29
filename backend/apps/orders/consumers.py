"""WebSocket consumer that streams live order events to role-scoped screens."""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.accounts.models import Role

from .realtime import GROUP_KITCHEN, GROUP_RECEPTION, GROUP_WAITERS, waiter_group


class LiveConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        # Subscribe to the groups relevant to this user's role.
        self.groups_joined = self._groups_for(user)
        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        await self.send_json(
            {"event": "connected", "payload": {"role": user.role, "user_id": user.id}}
        )

    async def disconnect(self, code):
        for group in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    @staticmethod
    def _groups_for(user) -> list[str]:
        if user.role == Role.CHEF:
            return [GROUP_KITCHEN]
        if user.role == Role.WAITER:
            return [GROUP_WAITERS, waiter_group(user.id)]
        if user.role == Role.ADMIN:
            # Reception sees everything that happens on the floor and in the kitchen.
            return [GROUP_RECEPTION, GROUP_KITCHEN]
        return []

    # Channel-layer fan-out handler (matches realtime.broadcast's "type").
    async def live_event(self, message):
        await self.send_json(
            {"event": message["event"], "payload": message["payload"]}
        )
