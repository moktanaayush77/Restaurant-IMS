# Realtime & WebSockets

## Do we need WebSockets for instant waiter → kitchen updates?

For **instant server push** (kitchen screen lights up the moment an order is sent,
no refresh), you need a persistent connection. Options:

| Approach | Fit |
|----------|-----|
| **WebSockets** | ✅ Bidirectional, low-latency. What the app already uses (Django Channels). The right tool — keep it. |
| **Server-Sent Events (SSE)** | ⚠️ Works, but server→client only. Would mean rebuilding what we have. |
| **Polling** (refetch every few sec) | ❌ 3–5s delay, wasteful, scales badly. Last resort only. |

Conclusion: keep WebSockets. No change needed.

## Single instance vs multiple instances — and why no Redis (at this scale)

An **instance** = one running copy of the backend. It is **not** a device or a tab
(those are clients).

- **1 instance:** every tablet, kitchen screen and the admin connect to the *same*
  server process. It holds them all in memory and pings between them directly.
  Django's built-in `InMemoryChannelLayer` handles this. **No Redis needed.**
- **2+ instances:** a message landing on Copy A can't reach a client on Copy B
  unless they share a bus. **Redis is that shared bus** — needed only when scaling
  to multiple instances.

This restaurant = 4 waiters, 1 kitchen, 1 floor, 1 admin. Tiny load. One instance
covers it forever. **Skip Redis** — one fewer moving part.

Caveat: `InMemoryChannelLayer` loses *in-flight* messages on a restart/redeploy.
Harmless here — clients reconnect and refetch current state.

> Note: when production uses Redis (the LAN Docker compose does), it's there for
> robustness, not because the load requires it. On the free cloud test, single
> instance + in-memory is fine.

## WebSocket connections drop on every deploy — everywhere

Restarting the backend (a code deploy) severs live WebSocket connections; clients
reconnect (the app has a "Reconnecting" badge). This is true on **any** host —
Render, paid plans, even the in-house LAN box. It is **not** a platform flaw.
Mitigation is simply: **don't deploy during service hours.**
