"""
End-to-end smoke test against a *running* server (not the Django test DB).

Drives the full lifecycle through real HTTP + auth + permissions:
  waiter places an order -> chef prepares & marks ready -> waiter serves ->
  waiter requests bill -> admin confirms payment -> stock auto-deducts ->
  the sale shows up in today's report.

Usage:  python scripts/e2e_smoke.py [base_url]
"""

import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8012") + "/api"

passed = failed = 0


def check(label, cond):
    global passed, failed
    mark = "PASS" if cond else "FAIL"
    if cond:
        passed += 1
    else:
        failed += 1
    print(f"  [{mark}] {label}")


def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw else None)


def main():
    print("== Auth ==")
    _, admin = req("POST", "/auth/login/", body={"username": "admin", "password": "admin123"})
    admin_t = admin["tokens"]["access"]
    _, waiter = req("POST", "/auth/pin-login/", body={"username": "ramesh", "pin": "1111"})
    waiter_t = waiter["tokens"]["access"]
    _, chef = req("POST", "/auth/pin-login/", body={"username": "bikash", "pin": "3333"})
    chef_t = chef["tokens"]["access"]
    check("admin + waiter + chef logged in", all([admin_t, waiter_t, chef_t]))

    print("== Inventory + recipe setup (admin) ==")
    _, item = req("POST", "/inventory/items/", admin_t,
                  {"name": "E2E Flour", "unit": "kg", "quantity": "50", "reorder_level": "5"})
    inv_id = item["id"]
    _, menu = req("GET", "/menu/items/?active=true&page_size=5", waiter_t)
    dish = menu["results"][0]
    _, recipe = req("POST", "/inventory/recipes/", admin_t,
                    {"menu_item": dish["id"], "inventory_item": inv_id, "quantity_per_unit": "2"})
    check("recipe linked (2 kg flour per dish)", recipe.get("id") is not None)

    print("== Place order (waiter) ==")
    _, tables = req("GET", "/tables/?active=true&page_size=50", waiter_t)
    table = tables["results"][0]
    code, order = req("POST", "/orders/", waiter_t, {
        "table": table["id"], "guest_count": 2,
        "items": [{"menu_item": dish["id"], "quantity": 3, "note": "extra hot"}],
    })
    oid = order["id"]
    check(f"order created (201) on {table['name']}", code == 201)
    check("order status PLACED", order["status"] == "PLACED")

    print("== Kitchen (chef) ==")
    _, o = req("POST", f"/orders/{oid}/start/", chef_t)
    check("chef -> PREPARING", o["status"] == "PREPARING")
    _, o = req("POST", f"/orders/{oid}/ready/", chef_t)
    check("chef -> READY", o["status"] == "READY")

    print("== Permission boundary ==")
    code, _ = req("POST", f"/orders/{oid}/start/", waiter_t)
    check("waiter cannot drive kitchen transition (403)", code == 403)

    print("== Serve + bill (waiter) ==")
    _, o = req("POST", f"/orders/{oid}/serve/", waiter_t)
    check("waiter -> SERVED", o["status"] == "SERVED")
    code, bill = req("POST", "/bills/generate/", waiter_t, {"order": oid})
    check("bill generated (201)", code == 201)
    total = float(bill["total"])
    check("bill total > 0", total > 0)

    print("== Pay (admin only) ==")
    code, _ = req("POST", f"/bills/{bill['id']}/pay/", waiter_t, {"payment_method": "CASH"})
    check("waiter cannot confirm payment (403)", code == 403)
    _, paid = req("POST", f"/bills/{bill['id']}/pay/", admin_t, {"payment_method": "CASH"})
    check("admin confirmed payment", paid["payment_status"] == "PAID")

    print("== Post-conditions ==")
    _, o = req("GET", f"/orders/{oid}/", admin_t)
    check("order now PAID", o["status"] == "PAID")
    _, inv = req("GET", f"/inventory/items/{inv_id}/", admin_t)
    check("stock auto-deducted 50 - 3x2 = 44", float(inv["quantity"]) == 44.0)
    _, report = req("GET", "/reports/sales/?period=today", admin_t)
    check("today's report has >= 1 paid order", report["totals"]["orders"] >= 1)
    check("report gross >= this bill", report["totals"]["gross"] >= total)

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
