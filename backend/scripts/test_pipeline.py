"""
End-to-end real-time pipeline test (run against a live server on :8000).

Connects a chef and a waiter via WebSocket, then drives a full order lifecycle
over HTTP and asserts the right live events arrive on the right sockets.
"""

import asyncio
import json
import urllib.request

import websockets

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws/live/"


def http(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def login_pin(username, pin):
    return http("POST", "/api/auth/pin-login/", body={"username": username, "pin": pin})


async def collect(ws, store):
    try:
        async for msg in ws:
            store.append(json.loads(msg))
    except websockets.ConnectionClosed:
        pass


async def main():
    chef = login_pin("bikash", "3333")
    waiter = login_pin("ramesh", "1111")
    chef_token, waiter_token = chef["tokens"]["access"], waiter["tokens"]["access"]

    chef_events, waiter_events = [], []
    async with websockets.connect(f"{WS}?token={chef_token}") as chef_ws, \
               websockets.connect(f"{WS}?token={waiter_token}") as waiter_ws:
        # Drain the initial "connected" frames.
        await chef_ws.recv()
        await waiter_ws.recv()

        ct = asyncio.create_task(collect(chef_ws, chef_events))
        wt = asyncio.create_task(collect(waiter_ws, waiter_events))

        loop = asyncio.get_event_loop()

        # Pick a table and two menu items.
        tables = await loop.run_in_executor(None, lambda: http("GET", "/api/tables/?page_size=1", waiter_token))
        table_id = tables["results"][0]["id"]
        items = await loop.run_in_executor(None, lambda: http("GET", "/api/menu/items/?page_size=2", waiter_token))
        i1, i2 = items["results"][0]["id"], items["results"][1]["id"]

        # 1. Waiter places the order.
        order = await loop.run_in_executor(None, lambda: http(
            "POST", "/api/orders/", waiter_token,
            {"table": table_id, "guest_count": 2, "note": "no onion",
             "items": [{"menu_item": i1, "quantity": 2}, {"menu_item": i2, "quantity": 1}]},
        ))
        oid = order["id"]
        print(f"placed order #{oid}, subtotal {order['subtotal']}, items {order['item_count']}")

        # 2. Chef starts and 3. marks ready.
        await loop.run_in_executor(None, lambda: http("POST", f"/api/orders/{oid}/start/", chef_token))
        await loop.run_in_executor(None, lambda: http("POST", f"/api/orders/{oid}/ready/", chef_token))
        # 4. Waiter serves.
        served = await loop.run_in_executor(None, lambda: http("POST", f"/api/orders/{oid}/serve/", waiter_token))
        print(f"final status: {served['status']}, served_at set: {bool(served['served_at'])}")

        await asyncio.sleep(0.6)  # let events flush
        ct.cancel(); wt.cancel()

    chef_seen = [e["event"] for e in chef_events]
    waiter_seen = [e["event"] for e in waiter_events]
    print("chef received  :", chef_seen)
    print("waiter received:", waiter_seen)

    assert "order.placed" in chef_seen, "chef should see new order"
    assert "order.ready" in waiter_seen, "waiter should be notified when ready"
    assert "order.served" in chef_seen, "kitchen should see served"
    print("\nPIPELINE OK — live events delivered to the right screens.")

    # Cleanup: cancel the order so the table frees up.
    http("POST", f"/api/orders/{oid}/cancel/", waiter_token)


asyncio.run(main())
