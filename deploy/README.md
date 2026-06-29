# In-house deployment runbook

The whole system runs on **one server box** (a PC or mini-PC) on the restaurant's
WiFi. Tablets, the kitchen monitor and the reception screen open it in a browser.

## Requirements

- A computer to act as the server, kept powered on, on the same WiFi/LAN.
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose installed on it.
- A **static LAN IP** for the server (set in your router's DHCP reservations),
  e.g. `192.168.1.50`.

## First-time setup

```bash
# 1. Get the code onto the server, then:
cd Restaurant

# 2. Create the environment file and edit it.
cp deploy/.env.example deploy/.env
#    - set a long random SECRET_KEY
#    - set a strong POSTGRES_PASSWORD
#    - set ALLOWED_HOSTS to your server IP, e.g. 192.168.1.50,localhost
#    - set SEED_DEMO=true  (only for this first run, to load demo data)

# 3. Build and start everything.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Then create the real admin (instead of the demo one):

```bash
docker compose -f deploy/docker-compose.yml exec backend python manage.py createsuperuser
```

After the first run, set `SEED_DEMO=false` in `deploy/.env`.

## Daily use

- Reception desktop / browser: `http://192.168.1.50/`
- Waiter tablets: same URL — they'll land on the staff PIN login.
- Kitchen monitor: same URL — log in as a chef.

Tip: on each tablet/monitor, open the URL and "Add to Home Screen" to run it
full-screen like an app (the web manifest gives it an app icon and a standalone
window).

> **Installable PWA / service worker:** browsers only enable the service worker in
> a *secure context* (HTTPS or `localhost`). Over plain HTTP on a LAN IP the app
> works fully and "Add to Home Screen" still launches it standalone, but the
> offline app-shell cache stays dormant. To get the full installable PWA, put the
> server behind HTTPS (e.g. `mkcert` on the LAN) — no code change needed.

## Operations

```bash
# View logs
docker compose -f deploy/docker-compose.yml logs -f backend

# Stop / start
docker compose -f deploy/docker-compose.yml down
docker compose -f deploy/docker-compose.yml up -d

# Update after pulling new code
docker compose -f deploy/docker-compose.yml up -d --build
```

### Nightly database backup

Add this to the server's crontab (`crontab -e`) to keep 14 days of backups:

```cron
0 2 * * * docker compose -f /path/to/Restaurant/deploy/docker-compose.yml exec -T db \
  pg_dump -U restaurant restaurant | gzip > /path/to/backups/restaurant-$(date +\%F).sql.gz
0 3 * * * find /path/to/backups -name 'restaurant-*.sql.gz' -mtime +14 -delete
```

Restore from a backup:

```bash
gunzip -c restaurant-2026-06-01.sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T db psql -U restaurant restaurant
```

## Notes

- **No internet required** for daily operation — everything is on the LAN. Fonts
  and assets are bundled, not loaded from CDNs.
- **No online payments.** The system calculates and stores bills; the guest pays
  at the counter and an admin marks the bill paid.
- Real-time order updates use WebSockets backed by Redis, so multiple screens
  stay perfectly in sync.
