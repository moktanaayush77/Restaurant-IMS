# v1 build progress

Tracks the v1 (cloud / B1) production-readiness build. See
[../PRODUCTION_READINESS_PLAN.md](../PRODUCTION_READINESS_PLAN.md) for the full plan.

## ✅ Done & verified

### Database — Supabase (Singapore)
- `backend/.env` created (gitignored) with a generated `SECRET_KEY` and the
  Supabase pooler `DATABASE_URL` (password URL-encoded).
- Schema migrated to Supabase; demo data seeded (4 users, 6 tables, 12 menu items)
  and confirmed present in the cloud DB.

### Security hardening (PRODUCTION_READINESS_PLAN F2–F8)
- **F3 SECRET_KEY fail-fast:** prod (`DEBUG=False`) refuses to boot with a missing
  or default key. `config/settings.py`.
- **F7 prod hardening:** `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER`, secure
  cookies, HSTS, nosniff, `X_FRAME_OPTIONS=DENY` (active only when `DEBUG=False`;
  works behind Render/Cloudflare TLS).
- **F2 brute-force throttling:** `ScopedRateThrottle` on `login` + `pin_login`
  (10/min, env-tunable). Verified: 11th attempt → **429**.
- **F4 tokens:** access lifetime 12h→**60min**, refresh 7d→**1d**, rotation +
  blacklist enabled; **`/api/auth/logout/`** revokes the refresh token. Verified:
  logged-out refresh reuse → **401**.
- **F5 password policy:** staff password min 8 + run through Django validators
  (was min 4, validators bypassed). `accounts/serializers.py`.
- **F8 inventory authz:** `InventoryItemViewSet` + `RecipeComponentViewSet`
  locked to **admin-only** (were readable by all staff — leaked stock/cost/supplier).
  Verified: waiter → **403**, admin → **200**.

> PIN length kept at 4–6 digits so the documented demo logins keep working during
> testing; 6-digit minimum recommended for real production PINs (throttle + lockout
> are the primary brute-force defense). django-axes account lockout = future add.

### Supabase connection pooling
- **`CONN_MAX_AGE=0`** (env-tunable) — Django was holding persistent connections
  and exhausting Supabase's session pooler (free = 15). Now connections release
  per request. Fixed a real production-affecting bug.

### Extra security layers
- **`/api/health/`** now does a DB `SELECT 1` (liveness + readiness; doubles as the
  keep-alive target so a cron ping keeps Render awake AND Supabase active). Never throttled.
- **Global throttles** — generous `anon` (60/min) + `user` (1200/min) on top of the
  auth-endpoint scopes. Env-tunable.
- **Cloudflare `_headers`** — X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy active; CSP templated (fill in API/WS hosts at deploy).

### Accountant role  ✅
- New `ACCOUNTANT` role: **billing + reports + read-only inventory**; no
  staff/settings/menu/tables/orders. **Password** login (PIN login rejects it).
- Backend: permissions wired across reports/billing/inventory; migration applied.
- Frontend: role type, route guards (admin area shared, admin-only inner routes),
  role-filtered nav, staff-page management (create/edit accountants), inventory
  read-only view. Verified via API (reports/inventory 200, writes 403).
- Demo accountant for testing: **`nita` / `account123`**.

### Item cancellation workflow  ✅
- Per-line, **quantity-aware** cancel. Not-yet-started (PENDING) units cancel
  immediately (line splits; cancelled portion preserved, excluded from the bill).
  Cooking units (PREPARING/READY) raise a **kitchen void request** the kitchen
  confirms/declines. Served lines can't be cancelled (refund territory).
- Backend: `cancel_item_units` / `request_item_void` / `respond_item_void`,
  `cancel_item` + `void_respond` endpoints, `void_requested_qty`/`void_reason`
  fields + migration, realtime events. Verified end-to-end (5→3→2 momos, bill tracks).
- Frontend: waiter per-line cancel dialog (qty + reason, "void pending" state);
  kitchen Keep/Void buttons + toast alert on incoming requests.

## Deferred (not v1)
- Waiter-facing "beverage stock" view (needs a category field on `InventoryItem`).
- Cross-tab token fix (see [v2-checklist.md](v2-checklist.md) §4).
- External media storage for menu images (**still required before deploy**).
- Wastage stock-out for items cancelled after cooking (inventory accuracy).
