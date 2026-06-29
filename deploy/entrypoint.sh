#!/usr/bin/env bash
set -e

echo "Waiting for the database..."
python - <<'PY'
import os, time
import dj_database_url
import psycopg

url = os.environ.get("DATABASE_URL")
cfg = dj_database_url.parse(url)
dsn = f"host={cfg['HOST']} port={cfg['PORT']} dbname={cfg['NAME']} user={cfg['USER']} password={cfg['PASSWORD']}"
for attempt in range(30):
    try:
        psycopg.connect(dsn).close()
        print("Database is ready.")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"  ...not ready ({exc}); retrying")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time.")
PY

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Seed demo data only when explicitly asked (first install on the client server).
if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "Seeding demo data..."
  python manage.py seed_demo
fi

echo "Starting Daphne on :8000"
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
