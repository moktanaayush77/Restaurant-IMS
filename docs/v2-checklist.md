# v2 / later — deferred work

Things intentionally pushed past v1. v1 = "get it running on B1 cloud, secure,
and tested with the real restaurant." Anything here is a *later* improvement.

Some items are marked **(may pull into v1)** — candidates that could move up if
testing shows they're needed sooner.

---

## 1. Images & media  ⬅ first up
- [ ] **v1 decision:** either store dish-photo uploads in **Supabase Storage**, or
      ship v1 **without** menu images (Render's disk is ephemeral — local uploads
      get wiped on redeploy; see [hosting-and-deployment.md](hosting-and-deployment.md)).
- [ ] **v2:** the Cloudflare-based image idea — serving/optimizing/resizing menu
      photos (Cloudflare Images or R2 + transforms) for fast loads. **On hold —
      "wait and watch."** Revisit once we see how images actually get used.
- [ ] Upload limits + compression (don't let a 10MB photo through).

## 2. Order workflow — partial cancellation  ➡ MOVED TO v1 (2026-06-16)
Now part of v1 — see [item-cancellation-workflow.md](item-cancellation-workflow.md).
Includes qty-aware partial cancel, kitchen-confirmed void for cooking items, and
cancel reasons. (Wastage stock-out for cancelled-while-cooking items stays v2.)

## 3. Roles & access  ➡ MOVED TO v1 (2026-06-16)
**Accountant role** is now part of v1 — billing + reports access, no
staff/settings/menu/inventory management. New role + server permissions + UI.

## 4. Auth / session robustness  — DEFERRED (explanation, not building for v1)
The stale-token bug (see [known-issues-auth-token.md](known-issues-auth-token.md))
only appears when **one browser is logged into multiple roles at once** — a testing
habit, not how real staff use it (each tablet = one role, one login). So it's low
risk in production and we're **not fixing it for v1**.

**What the fix *would* do, if/when we add it:**
- **Cross-tab token sync:** a `storage` listener so logging in/out in one tab
  instantly updates every other tab — no more "screen says admin, token says
  waiter." Kills the whole class of confusing 403s.
- **Auto-logout on role-mismatch 403:** instead of silent empty screens, the user
  gets a clear "your session changed — log in again" and is bounced to login.
- **(Optional) per-tab token (`sessionStorage`):** lets you run admin + waiter +
  chef in three tabs of *one* browser without them clobbering each other — purely
  a convenience for your own testing.

For v1, the workaround stands: don't log multiple roles into one browser; use
separate browsers / incognito when testing several roles.

## 5. Offline resilience (bigger effort)
- [ ] **Offline order queue** in the PWA — let the floor keep taking orders during an
      internet outage and sync when reconnected. Directly addresses B1's main
      weakness (internet dependency). Non-trivial; only if outages prove painful.
- [ ] Full installable PWA / service-worker app-shell cache (cloud HTTPS unlocks it).

## 6. Scaling — only if it grows
- [ ] Redis channel layer + multiple backend instances. **Not needed** for one small
      restaurant (single instance + in-memory is fine — see
      [realtime-and-websockets.md](realtime-and-websockets.md)). Listed only so it's
      not forgotten if the client adds locations.

## 7. Cost / sustainability
- [ ] **Free → paid migration path** kept as a config flip (Render paid removes
      spin-down; Supabase Pro if storage/bandwidth caps are hit). Built so it's not
      a rebuild.
- [ ] **Audit-log / old-data pruning or archiving** to stay under the free DB
      storage cap over the years.

## 8. Reporting / analytics
- [ ] Enhancements driven by what the client actually asks for after using v1.

---

*Created 2026-06-16. Reorder freely — section 1 (images) is the agreed starting point.*
