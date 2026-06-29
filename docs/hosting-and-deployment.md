# Hosting & deployment

## Two deployment models

### A. Self-hosted LAN box (what `deploy/` is built for)
`nginx + Daphne + Postgres + Redis` via Docker Compose on one PC at the restaurant.

- **nginx** — front door: serves the React build, forwards `/api` and `/ws` to the backend.
- **Daphne** — runs Django with WebSocket support (ASGI).
- **Postgres** — database. **Redis** — WebSocket bus.
- **Docker Compose** — runs all four with one command.

**Pros:** no monthly fees, very fast (local), works offline, data stays in-house, no cold starts.
**Cons (decisive):** reachable **only on the restaurant LAN** by default. The admin
in Kathmandu **cannot** open it remotely without extra plumbing (a VPN like
**Tailscale**, or a tunnel like **Cloudflare Tunnel**). Backups/updates/box-failure
are all on you.

### B. Cloud (needed for remote admin access)
Frontend on **Cloudflare Pages** or **Vercel**; backend on **Render**; database on
**Supabase** (Postgres). A URL works from anywhere → fits the "admin views
everything from home" requirement.

## Free-tier limits (validated 2026-06)

| Limit | Reality | Mitigation |
|-------|---------|------------|
| **Render free web service spins down after ~15 min idle** | Cold start ~30–60s on next request. During active service constant traffic keeps it awake. | External keep-alive ping (cron-job.org / UptimeRobot / GitHub Actions) every ~10 min. Render free = 750 instance-hrs/mo ≈ enough for one 24/7 service. |
| **Render free Postgres expires at 30 days** → 14-day grace → **deleted** | Confirmed via Render changelog/docs. | **Use Supabase Postgres instead** (below). |
| **Supabase free pauses after 7 days of *DB* inactivity** | Data is **preserved**, ~30s to wake. | A keep-alive query (or the Render ping that hits the DB) keeps it active. |
| **Vercel Hobby = non-commercial** | A paying client's restaurant is commercial. | Prefer **Cloudflare Pages** (no such restriction). |
| **Region/latency** | Render/Supabase default US/EU → ~250–400ms from Nepal. | Pick **Singapore** for both — see region note below. |
| **Render free RAM ~512MB** | Fine for this load; not roomy. | Don't run extra heavy services on it. |

### Region: match the DB to the backend (Singapore)
Pick the DB region to match where the **backend** runs, not where users are. A
user↔backend trip happens once per action; a backend↔DB trip happens **many times
per request** (every query), so backend and DB must be **co-located**. Render's
nearest region to Nepal is **Singapore** (no Mumbai), so:
- **Render = Singapore, Supabase = Singapore** ✅ (fast backend↔DB)
- Supabase **Mumbai** (closer to users) ❌ — would be far from the Render Singapore
  backend, so every query crosses Singapore↔Mumbai.
- Supabase **Tokyo** ❌ — farthest of the three; ignore Supabase's "recommended".

### Key insight: Supabase as *just the database*
Point Django's `DATABASE_URL` at Supabase's Postgres (use the **pooler** URL,
port 6543). **Zero code changes** — keep the whole Django backend, keep Channels
WebSockets, keep Django auth. This sidesteps Render's 30-day DB deletion entirely.

### Gotcha: media/image uploads need external storage
Render's filesystem is **ephemeral** — it wipes on every redeploy/restart. The app
lets admins upload menu photos (`MenuItem.image`), stored on local disk today, so
those would vanish on cloud. Fix: store media in **Supabase Storage** (or
Cloudflare R2 / S3-compatible) instead of the local filesystem. Or skip images for
v1. Must-address for B1.

## Myths / FUD checked

- **"Render bans keep-alive ping bots."** Not substantiated — keep-alive via
  UptimeRobot/cron-job.org is openly documented and standard. Kernel of truth:
  free tier is *intended* for non-production; don't bet a client's live system on
  free-tier hacks long-term.
- **"Deploys drop WebSockets for ~1 min."** True, but only when *you* push code,
  clients auto-reconnect, and it happens on every host (see
  [realtime-and-websockets.md](realtime-and-websockets.md)). Rule: don't deploy
  during service.

## Why NOT Firebase (suggested elsewhere)
Firebase/Firestore is great for a greenfield app but a **bad fit here**: it's NoSQL
(our data is relational/transactional — orders, bills, inventory), and "frontend
writes directly to Firestore" pushes business logic + security into the browser.
Adopting it = throwing away the working Django backend and re-implementing auth,
roles, billing and inventory as Firestore rules. **Don't.**

## Recommendation

- **1-month free test:** Frontend on **Cloudflare Pages**, backend on **Render**
  (Daphne/ASGI, **no Redis**, single instance), database on **Supabase** (Singapore,
  pooler URL). Don't over-engineer keep-alive — for a *test*, letting it spin down
  and accepting the occasional first-hit cold start is acceptable.
- **Production for the client:** pay ~$7/mo for Render's non-spin-down plan (and
  persistent DB) — trivial against restaurant revenue, removes every free-tier
  problem. The LAN/Docker option is better only if the restaurant wants everything
  in-house *and* you set up remote access (Tailscale/Cloudflare Tunnel) for yourself.

> Free tier is for **proving the product works**, not for carrying a paying
> client's production indefinitely.
