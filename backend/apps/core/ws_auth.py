"""
JWT authentication for WebSocket handshakes.

Browsers cannot set custom headers on a WebSocket, so the access token is passed
as a ``?token=`` query parameter. This middleware validates it and attaches the
user to the connection scope (or ``AnonymousUser`` if missing/invalid).
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user(token: str):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    try:
        access = AccessToken(token)
    except TokenError:
        return AnonymousUser()

    User = get_user_model()
    try:
        user = User.objects.get(pk=access["user_id"])
    except User.DoesNotExist:
        return AnonymousUser()
    return user if user.is_active else AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        scope["user"] = await _get_user(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
