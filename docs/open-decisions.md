# Open decisions

Things discussed but not yet decided / built. Resolve these before the related work.

## 1. Deployment target for production  ✅ DECIDED
**Status (2026-06-16): FULL CLOUD (Option B1).** Frontend on Cloudflare Pages,
backend on Render, database on Supabase Postgres.

**Why:** the restaurant runs in **Janakpur**; the admin works from **Kathmandu**
(~390 km) and must monitor remotely — so pure-LAN is out. Between full cloud and a
LAN box + tunnel, cloud wins because the admin **cannot physically maintain a box**
390 km away; cloud is managed entirely from the KTM laptop. The one real downside —
the floor depends on Janakpur internet — is mitigated by a **4G/mobile failover
router** (the restaurant's inverter keeps the router alive through loadshedding).

**Consequence for the prod plan:** the LAN-only items in
[PRODUCTION_READINESS_PLAN.md](../PRODUCTION_READINESS_PLAN.md) drop (mkcert HTTPS,
nginx TLS/hardening, box firewall/UPS — the platform handles these). **All
app-level security items (F2–F8) stay and matter *more* on a public URL.**

**Must-fix for B1 specifically (see [hosting-and-deployment.md](hosting-and-deployment.md)):**
- Database on **Supabase** (not Render's free DB — it expires at 30 days).
- **Media/images on external storage** (Supabase Storage / R2) — Render's disk is
  ephemeral and wipes uploaded menu photos on redeploy.
- Keep-alive cronjob (free-tier spin-down) + WebSockets (already built).

**Free-tier caveat:** running free for years is *possible* for one small restaurant
but *fragile* — provider policy changes (e.g. Render already cut free Postgres
90→30 days) can force a migration. Built so flipping to a paid tier is config, not
a rebuild.

## 2. Item cancellation policy
(See [item-cancellation-workflow.md](item-cancellation-workflow.md).)
- Who may cancel an item that's **already cooking** (PREPARING/READY)?
  - Decided so far: waiter can do it **without** manager involvement.
  - Still open: confirm/decline handshake with the kitchen during PREPARING — yes?
- **Capture a reason** on cancel? (changed mind / out of stock / too slow)
- Are line quantities mostly **servings** (partial-quantity cancel matters) or
  mostly **1** (a plain per-line cancel button is enough)?

## 3. Accountant role  (new feature)
Requirement: an **Accountant** user with **less access than admin** — likely can see
billing + reports, but not manage staff/settings/inventory.

- Today the app has only **Admin / Waiter / Chef** ([backend/apps/accounts/models.py](../backend/apps/accounts/models.py)).
- This is a **code change** (new role + permissions + UI), independent of hosting.
- Define exactly what the accountant can/can't do before building.
