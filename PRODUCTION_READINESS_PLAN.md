# Production Readiness Plan — Crafted Bistro POS

> Audience: the developer shipping this in-house restaurant POS to a real
> restaurant. Grounded in the actual code (Django 5 + DRF + Channels + React +
> Postgres + Redis, one-box Docker Compose on a LAN).
>
> This plan adapts the generic *Vibe-to-Prod* checklist to **your** reality:
> a LAN-only web app with no internet dependency and no online payments. Cloud
> and mobile requirements from the template (Firebase Auth, Cloud Run, Workload
> Identity Federation, Fastlane/App Store) **do not apply** and are intentionally
> dropped. What stays: security, CI/CD, testing, backups, observability, ops.

---

## 1. Verdict — is it production ready?

**Not yet. The app is functionally complete and well-built, but it is NOT safe
to put in a restaurant in its current state — specifically because of the two
threats you named: a stranger on the WiFi, and a non-admin employee.**

What's genuinely good already (don't rebuild these):

- **Real role-based authorization**, enforced server-side per endpoint — not just
  hidden in the UI. Reports and the stock ledger are `IsAdmin` only; inventory
  writes/moves are admin-only; billing `pay` is admin-only; order transitions are
  gated to the correct role. See [reports/views.py](backend/apps/reports/views.py),
  [inventory/views.py](backend/apps/inventory/views.py),
  [billing/views.py](backend/apps/billing/views.py),
  [orders/views.py](backend/apps/orders/views.py).
- **Audit log** on every sensitive mutation (`AuditLog.record(...)`).
- **Env-driven config** — same code runs SQLite/in-memory locally and
  Postgres/Redis in prod, no code changes ([settings.py](backend/config/settings.py)).
- **PINs and passwords are properly hashed** (`make_password`/`check_password`),
  PIN stored separately from password ([accounts/models.py](backend/apps/accounts/models.py)).
- **DB is not exposed** outside the Docker network (no published port on `db`).
- **Backups documented** (nightly `pg_dump` cron in [deploy/README.md](deploy/README.md)).

What blocks production (the gaps that directly enable your two threats) are in
section 3. The roadmap already calls this out — **M6 "deployment hardening" is
the unfinished milestone** ([README.md](README.md)). This plan *is* M6, expanded.

**Bottom line:** ~1–2 focused weeks of hardening + CI/CD + tests, then it's
production-ready for a single restaurant.

---

## 2. How the template's requirements map to your app

| Template requirement | Applies? | Your equivalent |
|---|---|---|
| Isolated dev / prod environments | ✅ | SQLite local vs Postgres/Redis prod (already done) |
| No secrets in code | ⚠️ Partial | `.env` exists, but insecure fallbacks remain (see 3.3) |
| Dependency + static scanning | ✅ | `pip-audit`, `bandit`, `npm audit`, Trivy on the images |
| HTTPS everywhere | ✅ **critical** | mkcert/local CA on the LAN (template assumes Cloud Run's free TLS) |
| Auth on endpoints | ✅ Done | DRF `IsAuthenticated` default + role permissions |
| Input validation | ✅ Mostly | DRF serializers |
| Rate limiting | ❌ **missing** | DRF throttling + nginx `limit_req` (template defers to API Gateway — you have none) |
| Security headers | ⚠️ Partial | Add at nginx + Django `SECURE_*` |
| CI/CD pipeline | ❌ missing | GitHub Actions (build/test/scan) — no Cloud Run deploy; deploy is `git pull` + compose |
| IaC (Pulumi) | ❌ N/A | Overkill for one box. Docker Compose **is** your IaC. |
| Health checks | ⚠️ Partial | `db` has one; backend/web do not |
| Structured logging | ❌ missing | Add JSON logging + request IDs |
| Error tracking | ❌ missing | Sentry (self-hosted or free tier) — optional on a LAN |
| Backups + restore test | ⚠️ Partial | cron documented; needs to be installed + a tested restore |
| Firebase / Cloud Run / WIF / GCP | ❌ N/A | Dropped — you self-host on a LAN box |
| iOS/Android/Fastlane/App Store | ❌ N/A | Dropped — it's a browser PWA |

---

## 3. Threat model + current findings

Your two stated threats, made concrete against the real code:

### Threat A — "some rando hacking in and finding my inventory details"
A stranger who joins the restaurant WiFi (or cracks the WiFi password — they're
on the same `192.168.1.x` LAN).

### Threat B — "a fraud employee, other than the admins"
A waiter/chef who has a valid PIN but should never see reports, sales, the stock
ledger, or be able to act as an admin.

### Findings (ordered by severity)

| # | Severity | Finding | Evidence | Enables |
|---|---|---|---|---|
| F1 | 🔴 Critical | **No HTTPS — everything is plain HTTP over the LAN.** JWTs, PINs, passwords, inventory and sales data all travel in cleartext. Anyone on the WiFi can sniff a token with Wireshark and replay it, or read all traffic. | [nginx.conf](deploy/nginx.conf) listens on `:80` only; [deploy/README.md](deploy/README.md) calls HTTPS "optional" | A |
| F2 | 🔴 Critical | **No brute-force protection on login or PIN login.** No throttling, no lockout. A 4-digit PIN is 10,000 guesses — minutes to crack. Admin passwords can be sprayed too. | No throttle in [settings.py](backend/config/settings.py); `grep throttle/axes/ratelimit` → nothing; PIN allowed 4 digits in [accounts/views.py](backend/apps/accounts/views.py) | A + B |
| F3 | 🔴 Critical | **Insecure `SECRET_KEY` fallback.** Defaults to a hardcoded string if the env var is missing. A known key = forge any JWT = impersonate admin. Nothing fails startup if it's missing/blank in prod. | `SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me-in-production")` [settings.py:33](backend/config/settings.py#L33); `.env.example` ships it blank | A + B |
| F4 | 🟠 High | **JWTs in `localStorage` with long lifetimes** (access 12h, refresh 7d) and **no logout/blacklist**. Any XSS steals a token good for hours; logout can't revoke it. | SIMPLE_JWT in [settings.py:145](backend/config/settings.py#L145); frontend stores in localStorage (per RestaurantIMS doc); no `token_blacklist` app | A + B |
| F5 | 🟠 High | **Weak credential policy.** Staff passwords accept min length 4 (serializer bypasses validators); PINs 4 digits. | `password = ...min_length=4` [serializers.py:40](backend/apps/accounts/serializers.py#L40); only MinimumLength+CommonPassword validators | A + B |
| F6 | 🟠 High | **Weak default DB password that operators won't change.** `change-this-password` / `restaurant`. | [.env.example](deploy/.env.example), [docker-compose.yml](deploy/docker-compose.yml) defaults | A |
| F7 | 🟡 Medium | **`ALLOWED_HOSTS=*` and no `SECURE_*` settings.** No HSTS, no secure-cookie flags, no SSL redirect. (Partly because there's no HTTPS yet — fix with F1.) | [settings.py:37](backend/config/settings.py#L37); no SECURE_* block | A |
| F8 | 🟡 Medium | **Inventory list is readable by every authenticated employee** (`IsAdminOrReadOnly`) — today a waiter/chef can `GET /api/inventory-items/` and see all stock, costs and suppliers. **Decision made:** inventory is admin-only, *except* waiters may see beverage stock counts (see 1e). Note: `InventoryItem` has **no category/type field**, so this needs a small schema addition. | `permission_classes = [IsAdminOrReadOnly]` [inventory/views.py:22](backend/apps/inventory/views.py#L22); no category on `InventoryItem` [inventory/models.py:10](backend/apps/inventory/models.py#L10) | B |
| F9 | 🟡 Medium | **No security headers on the SPA** (CSP, X-Frame-Options, nosniff). CSP is the main defense-in-depth against the XSS that would steal tokens (F4). | [nginx.conf](deploy/nginx.conf) sets none | A |
| F10 | 🟡 Medium | **No request timeout / body limits / connection limits** at nginx beyond `client_max_body_size`. Slowloris / abuse on the LAN. | [nginx.conf](deploy/nginx.conf) | A |
| F11 | 🟢 Low | **WS token in query string** is written to nginx access logs. | `/ws/?token=...`, access_log not disabled for `/ws/` | A |
| F12 | 🟢 Low | **Containers run as root**; no resource limits. | [Dockerfile.backend](deploy/Dockerfile.backend) has no `USER`; compose has no `mem_limit` | — |
| F13 | 🟢 Low | **No backend/web healthchecks** in compose; restart/readiness is blind. | [docker-compose.yml](deploy/docker-compose.yml) | — |
| F14 | 🟢 Low | **No version control / CI on `Restaurant/`.** It isn't its own git repo, so there's no history, no PR review, no automated checks — making "easy editing later" risky. | `git ls-files` shows it untracked | — |

> Note: the audit log, role gating, and hashed credentials mean a fraud employee
> **can't already do admin actions through the API** — the server rejects them.
> The real B-threat is (a) brute-forcing a *different* account's PIN/password
> (F2), (b) sniffing an admin token off the wire (F1), or (c) reading inventory
> they shouldn't (F8). Fix those and threat B is closed.

---

## 4. Target architecture (separated FE / BE / DB, easy to edit & ship)

You're already cleanly separated into three deployable units. The improvement is
**version control + a build/release pipeline around them**, so editing later is a
commit + push + one pull, not hand-editing on the server.

```
                    ┌──────────────────────── ONE SERVER BOX (LAN) ───────────────────────┐
   Tablets /        │                                                                      │
   Kitchen /        │   ┌───────────────┐   /api,/admin   ┌───────────────┐                │
   Reception  ──────┼──▶│  nginx (web)  │───/ws──────────▶│ Daphne (ASGI) │                │
   (browser,        │   │  TLS :443     │                 │   Django      │                │
    HTTPS)          │   │  React build  │   static/media  │  REST+Channels│                │
                    │   │  rate-limit   │◀────────────────│               │                │
                    │   └───────────────┘                 └──────┬────────┘                │
                    │                                            │                         │
                    │                              ┌─────────────┼─────────────┐           │
                    │                              ▼             ▼             ▼            │
                    │                        ┌──────────┐  ┌──────────┐  ┌──────────┐       │
                    │                        │ Postgres │  │  Redis   │  │  media/  │       │
                    │                        │ (volume) │  │ (channels)│ │ backups  │       │
                    │                        └──────────┘  └──────────┘  └──────────┘       │
                    └──────────────────────────────────────────────────────────────────────┘
                                                   ▲
                                                   │ git pull && docker compose up -d --build
                                                   │
   ┌──────────── DEV LAPTOP ────────────┐   ┌────────── GitHub (private) ──────────┐
   │ frontend/  (Vite, SQLite-free)     │   │  Actions CI on every PR:             │
   │ backend/   (SQLite, in-memory)     │──▶│   • backend: lint, migrate-check,    │
   │ deploy/    (compose)               │   │     pytest, bandit, pip-audit        │
   │ one `Restaurant` git repo          │   │   • frontend: typecheck, lint, build │
   └────────────────────────────────────┘   │     npm audit                        │
                                             │   • docker build + Trivy scan        │
                                             │  Tag v1.x → release image/checklist  │
                                             └──────────────────────────────────────┘
```

**Why this fits "easy editing later":**
- Three independent units (`frontend/`, `backend/`, `deploy/`) already build
  independently — change one without touching the others.
- One git repo = full history + the ability to revert a bad change instantly.
- CI proves a change is safe **before** it ever reaches the restaurant.
- Deploy stays a single, boring command on the box: `git pull && docker compose -f deploy/docker-compose.yml up -d --build`.
- You do **not** need Kubernetes, Pulumi, or a cloud account. One box, one compose
  file, is the right amount of infrastructure for one restaurant.

---

## 5. The plan — phased

Each phase has a goal, the concrete work, and **acceptance criteria** (how you
know it's done). Phases 0–1 are the production blockers; do them first.

### Phase 0 — Version control & repo hygiene  *(½ day)*
**Goal:** `Restaurant/` is its own repo with CI-ready structure, so every later
change is reviewable and revertible.

- [ ] `git init` in `Restaurant/` (make it its own repo, separate from the
      Desktop-level git). Push to a **private** GitHub repo.
- [ ] Verify `.gitignore` excludes `db.sqlite3`, `.venv/`, `node_modules/`,
      `dist/`, `media/`, and **all `.env` files**. (Confirm `db.sqlite3` and the
      committed DB aren't pushed.)
- [ ] Add a top-level `CONTRIBUTING.md` / update `README.md` with the
      branch → PR → CI → merge → deploy flow (section 6).
- **Acceptance:** clean `git status`, no secrets/binaries tracked, repo builds
  from a fresh clone following the README.

### Phase 1 — Security hardening (the blockers)  *(3–5 days)*
**Goal:** close threats A and B. This is the part that makes it safe to deploy.

**1a. HTTPS on the LAN (F1)** — the single most important fix.
- [ ] Generate a local CA + server cert with **mkcert** for the server's IP/hostname
      (e.g. `restaurant.local` + `192.168.1.50`).
- [ ] Add a TLS server block to [nginx.conf](deploy/nginx.conf): listen `443 ssl`,
      mount the cert/key, **redirect 80 → 443**.
- [ ] Install the mkcert root CA on each tablet/desktop (one-time, via "Add to
      Home Screen" setup). This also unlocks the full installable PWA + service
      worker (the runbook notes HTTP keeps it dormant).
- [ ] Set Django `SECURE_PROXY_SSL_HEADER`, `SECURE_SSL_REDIRECT=True`,
      `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`.
- **Acceptance:** `http://server/` redirects to `https://`; browsers show a
  trusted cert; sniffing the WiFi yields only TLS.

**1b. Brute-force protection (F2)** — the other half of threat A/B.
- [ ] Add **DRF throttling**: `ScopedRateThrottle` on the two auth endpoints
      (e.g. `login`/`pin-login` → 5–10/min per IP), plus sane global
      `AnonRateThrottle`/`UserRateThrottle`.
- [ ] Add **account lockout**: integrate **`django-axes`** (lock a username/IP
      after N failed attempts, auto-cooloff). Wire its backend into auth.
- [ ] Add nginx `limit_req_zone` on `/api/auth/` as a second layer.
- **Acceptance:** scripted 50 wrong PINs in a row gets throttled + locked; audit
  log shows the lockout; a legit login still works after cooloff.

**1c. Secrets & credential policy (F3, F5, F6)**
- [ ] Make startup **fail loudly** if `DEBUG=False` and `SECRET_KEY` is missing or
      equals the dev default (raise `ImproperlyConfigured`).
- [ ] Raise password floor: PIN **6 digits** minimum; staff passwords min 8 + run
      through `AUTH_PASSWORD_VALIDATORS` (don't bypass them in the serializer).
- [ ] `.env.example`: replace `change-this-password` with a generated-value note;
      document `openssl rand` / `secrets.token_urlsafe`. Add a `make secrets`
      helper that generates them.
- **Acceptance:** prod refuses to boot without a real `SECRET_KEY`; can't create a
  4-char password or a 4-digit PIN.

**1d. Token handling (F4)**
- [ ] Shorten `ACCESS_TOKEN_LIFETIME` to ~30–60 min; keep refresh short (1 day).
- [ ] Enable SimpleJWT **`token_blacklist`** + rotation so logout actually revokes.
- [ ] (Stretch) Move refresh token to an `HttpOnly` cookie so XSS can't read it.
- **Acceptance:** logout invalidates the refresh token; expired access token
  refreshes transparently (the Axios interceptor already does replay).

**1e. Authorization — inventory (F8)**  *Decision: admin-only, except waiters see beverage stock.*
- [ ] Change `InventoryItemViewSet`, `StockTransactionViewSet`, and
      `RecipeComponentViewSet` to **`IsAdmin`** (today inventory uses
      `IsAdminOrReadOnly`, which leaks the full list + costs to all staff). Chefs
      get no inventory access.
- [ ] **Schema:** add a category/type to `InventoryItem` so "beverage" is a real
      thing. Simplest: a `category` field with choices (e.g. `FOOD`, `BEVERAGE`,
      `SUPPLY`) or a dedicated `MenuCategory`-style FK. Add a migration + seed the
      existing items.
- [ ] Add a **narrow, read-only "beverage stock" endpoint for waiters**, e.g.
      `GET /api/inventory/beverages/` returning **only `name`, `quantity`, `unit`**
      for `category=BEVERAGE` items — **no `unit_cost`, no `reorder_level`, no
      ledger, no supplier**. Permission: `IsAuthenticated` + (`IsAdmin` OR
      `IsWaiter`). Use a separate slim serializer so cost data can't leak.
- **Acceptance:** a waiter token gets `403` on `/api/inventory-items/`,
  `/api/stock-transactions/`, `/api/recipe-components/`, but `200` on
  `/api/inventory/beverages/` with **no cost fields present**; a chef token gets
  `403` everywhere in inventory. All three covered by tests.

**1f. Edge hardening (F9, F10, F11, F7)**
- [ ] nginx: add `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`; add
      `proxy_read_timeout`/`send_timeout`, `limit_conn`; `access_log off` (or token
      stripping) for `/ws/`.
- [ ] Tighten `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` to the real server
      IP/hostname (no `*` in prod).
- **Acceptance:** securityheaders-style check passes; `ALLOWED_HOSTS` is explicit.

### Phase 2 — CI/CD pipeline  *(1–2 days)*
**Goal:** every change is automatically validated; releases are repeatable.

- [ ] `.github/workflows/ci.yml` (runs on PR + push):
  - **backend job:** set up Python, `pip install`, `ruff`/`black --check`,
    `python manage.py makemigrations --check --dry-run`, `pytest`, `bandit -r .`,
    `pip-audit`.
  - **frontend job:** `npm ci`, `tsc --noEmit`, `eslint`, `npm run build`,
    `npm audit --audit-level=high`.
  - **docker job (on main):** `docker build` both images, **Trivy** scan
    (fail on HIGH/CRITICAL).
- [ ] Branch protection on `main`: require the CI checks + 1 review (even if
      it's just you using the PR as a gate).
- [ ] A `release` workflow on tag `v*`: build + tag images, generate the release
      checklist (section 7).
- **Acceptance:** a PR with a failing test/lint/vuln is blocked from merging;
  green PR merges cleanly.

> No Cloud Run / WIF / Pulumi steps — your "deploy" is `git pull` + compose on the
> box (section 6). CI's job here is **quality gating**, not cloud deployment.

### Phase 3 — Testing  *(2–3 days)*
**Goal:** prove the security and money paths work, and keep them working.

- [ ] **Auth/authz tests** (highest value): waiter token → `403` on reports,
      stock ledger, billing-pay, staff management, inventory write; admin → `200`.
      PIN/password login success + failure + lockout.
- [ ] **Order lifecycle** tests: the state machine
      (`PLACED→PREPARING→READY→SERVED→BILLED→PAID`), role-gated transitions,
      price snapshotting.
- [ ] **Billing** tests: bill generation from a served order, discount, pay-once
      (no double-pay), totals.
- [ ] **Inventory** tests: recipe-based stock decrement on order, low-stock flag,
      stock-move ledger.
- [ ] A `pytest` config + factory fixtures; target the critical paths first, not
      100% coverage.
- **Acceptance:** `pytest` green in CI; the authz matrix is fully covered.

### Phase 4 — Observability, backups & ops  *(1–2 days)*
**Goal:** you can tell when it's down, and you never lose a day's sales.

- [ ] **Backend `/health` + `/health/ready`** endpoints (DB + Redis ping); add
      Docker `healthcheck` for `backend` and `web`.
- [ ] **Structured JSON logging** + request IDs (Django `LOGGING` config); log
      auth failures and lockouts explicitly.
- [ ] **Install the nightly backup cron** (it's only documented, not installed):
      `pg_dump` + 14-day rotation, **and copy backups off the box** (a second
      disk or a NAS — the box can die). **Test a restore.**
- [ ] (Optional on a LAN) **Sentry** for error tracking.
- [ ] **Runbook**: how to restart, where logs are, how to restore a backup, how to
      reset a staff PIN, what to do if the box won't boot.
- **Acceptance:** pull the plug mid-service, reboot, system comes back; restore
  last night's backup into a scratch DB successfully.

### Phase 5 — Hardening the box & launch  *(1 day)*
- [ ] Run containers as **non-root** (`USER` in Dockerfiles); add `mem_limit`/CPU
      limits and `read_only` where possible.
- [ ] OS-level: firewall the box so only `443` (and SSH from your laptop) is open;
      auto-start compose on boot (`restart: unless-stopped` is set — also enable
      the Docker service on boot).
- [ ] Static LAN IP / DHCP reservation (already in the runbook).
- [ ] Change **all** demo credentials; delete the demo admin; `SEED_DEMO=false`.
- [ ] UPS for the server box (a restaurant loses power; Postgres mid-write is
      unhappy).
- [ ] Final pass of the **release checklist** (section 7).
- **Acceptance:** nmap from another LAN device shows only 443; no demo accounts
  exist; survives a power blip.

---

## 6. Day-to-day workflow (how editing works after launch)

This is the "easy and convenient editing later" you asked for:

```
1. On your laptop:  git checkout -b fix/menu-price-rounding
2. Edit frontend/ or backend/ (run locally: SQLite + Vite, no Docker needed).
3. git commit && git push  →  open a PR.
4. GitHub Actions runs lint + tests + security scans automatically.
5. Green? Merge to main. (Red? It tells you exactly what broke.)
6. Tag a release when you want to ship:  git tag v1.4  &&  git push --tags
7. On the restaurant server box, during off-hours:
       git pull
       docker compose -f deploy/docker-compose.yml up -d --build
   (entrypoint auto-runs migrations + collectstatic. ~1–2 min, zero manual SQL.)
8. Verify: open https://restaurant.local/ , check /health, watch logs once.
9. Rollback if needed:  git checkout v1.3 && docker compose up -d --build
```

Because frontend, backend and DB are separate units behind nginx, a frontend-only
change rebuilds only the `web` image; a backend change rebuilds only `backend`.
The DB volume persists across rebuilds — your data is never in the image.

---

## 7. Release checklist (copy into each release PR)

**Security**
- [ ] `SECRET_KEY` is a real random value; prod refuses to boot otherwise
- [ ] HTTPS enforced; HTTP redirects to HTTPS; cert trusted on all devices
- [ ] Auth throttling + lockout verified (brute-force test fails)
- [ ] `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` set to the real host (no `*`)
- [ ] DB password is strong and unique; demo accounts deleted; `SEED_DEMO=false`
- [ ] `pip-audit`, `npm audit`, Trivy: no HIGH/CRITICAL
- [ ] Authz matrix test green (waiter/chef can't reach admin data)

**Correctness**
- [ ] `pytest` + frontend typecheck/lint green in CI
- [ ] `makemigrations --check` clean; migrations applied on deploy

**Ops**
- [ ] `/health` returns ok for backend + web; compose healthchecks pass
- [ ] Last night's backup exists, is **off the box**, and a restore was tested
- [ ] Runbook current; rollback steps known
- [ ] Logs flowing; auth failures visible

---

## 8. Suggested order of execution

```
Week 1:  Phase 0  →  Phase 1 (1a HTTPS, 1b brute-force, 1c secrets)   ← unblocks prod
Week 1:  Phase 1 (1d tokens, 1e inventory decision, 1f edge)
Week 2:  Phase 2 (CI/CD)  →  Phase 3 (tests, starting with authz)
Week 2:  Phase 4 (health, logging, backups+restore test)  →  Phase 5 (box + launch)
```

Phases 1a, 1b, 1c are the three things that, if you did **nothing else**, would
turn "anyone on the WiFi or any employee can get in" into "they can't." Start there.

---

*Generated from a code-level review of the Restaurant repo on 2026-06-21.*
*Cross-referenced against the Vibe-to-Prod docs in `../VibeCodeToProdDocs`.*
