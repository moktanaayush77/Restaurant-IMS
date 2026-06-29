# Restaurant Management System

In-house restaurant POS for the floor, the kitchen and reception. Orders flow in
real time from a waiter's tablet to the kitchen display and the reception board,
through to a calculated bill that an admin marks paid at the counter.

> Comparable in scope to Mero Menu / IMS, built to run entirely on a local
> network (LAN) — no internet dependency, no online payments.

## Stack

| Layer        | Technology                                                            |
| ------------ | --------------------------------------------------------------------- |
| Backend      | Django 5 · Django REST Framework · **Django Channels** (WebSockets)   |
| Realtime     | Channels — Redis layer in production, in-memory for single-process dev |
| Database     | PostgreSQL (production) · SQLite (local dev, zero-config)             |
| Auth         | JWT (SimpleJWT). Admins use a password; waiters/chefs use a numeric PIN |
| Frontend     | React + TypeScript (Vite) · Tailwind CSS · TanStack Query             |
| Deployment   | Docker Compose (nginx + Daphne + Postgres + Redis) on one server box  |

## Roles

- **Admin / Reception** — live order board, tables, menu, staff, inventory, reports, billing.
- **Waiter** (tablet) — take orders, get "ready" alerts, mark served, request the bill.
- **Chef / Kitchen** (KDS) — live ticket queue, mark preparing → ready.

## Local development

Two terminals. Local dev uses **SQLite** and an **in-memory** realtime layer, so
there's nothing else to install beyond Python and Node.

### 1. Backend (http://127.0.0.1:8000)

```bash
cd backend
py -3.14 -m venv .venv                 # Windows; use python3 on macOS/Linux
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed_demo   # demo staff, tables, menu
.venv/Scripts/python manage.py runserver
```

### 2. Frontend (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/ws` to the
backend, and binds to the LAN so other devices can reach it at
`http://<your-ip>:5173`.

### Demo logins (after `seed_demo`)

| Role   | How       | Credentials                       |
| ------ | --------- | --------------------------------- |
| Admin  | Password  | `admin` / `admin123`              |
| Waiter | Staff PIN | `ramesh` / `1111`, `sita` / `2222`|
| Chef   | Staff PIN | `bikash` / `3333`                 |

## Production (in-house server)

See [`deploy/README.md`](deploy/README.md) for the one-command Docker Compose
setup, LAN configuration, and nightly backups.

## Project layout

```
backend/    Django ASGI project (apps/: accounts, catalog, floor, orders,
            billing, inventory, reports, core)
frontend/   React PWA (src/features/: auth, admin, waiter, kitchen, settings)
deploy/     Dockerfiles, docker-compose, nginx, runbook
```

## Build roadmap

- **M0 — Foundation** ✅ scaffold, auth (password + PIN), realtime wiring, design system, deploy.
- **M1** — Tables, menu, staff management.
- **M2** — Live order pipeline (waiter → kitchen → reception → served).
- **M3** — Billing & payment confirmation.
- **M4** — Inventory.
- **M5** — Reports & analytics.
- **M6** — Polish, PWA, deployment hardening.
