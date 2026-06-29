# Known issue: stale / clobbered auth token

## Symptoms seen (all the same root cause)
- "Ramesh can't take an order" → POST `/api/orders/` returned **403**.
- "Can't mark served / request bill" → buttons gated, order stuck because the
  kitchen step never advanced under the wrong identity.
- "Admin can't edit the menu" → admin-only GETs (`/api/staff/`, `/api/reports/`)
  returned **403** while shared reads returned 200.

## Root cause
The app stores the JWT in `localStorage` under one key (`rms.access`), shared
across all tabs. The route guard ([frontend/src/features/auth/ProtectedRoute.tsx](../frontend/src/features/auth/ProtectedRoute.tsx))
decides access from the **in-memory React user**, but API requests use **whatever
token is in `localStorage`** ([frontend/src/lib/api.ts](../frontend/src/lib/api.ts)).

Logging into a second role (another tab, or a later login) overwrites the token.
Result: a screen renders as one role (e.g. admin) while requests go out as another
(e.g. waiter) → admin-only / role-gated calls fail with 403, even though the UI
looks right. The backend is behaving correctly; the frontend identity is split.

## Immediate workaround
Log out and back in as the intended role (logout clears the token). Don't keep
multiple roles logged in at once in one browser — use separate browsers / incognito
per role when testing.

## Proposed fix (not yet implemented)
1. **Cross-tab token sync** — a `storage` event listener in `AuthContext` so login/
   logout in one tab updates all tabs (keeps React user and token in agreement).
2. **Auto-logout on role mismatch** — on a 403, surface a clear toast and force
   re-login instead of silent empty screens.
3. **(Optional) per-tab token** via `sessionStorage` so multiple roles *can* coexist
   in separate tabs without clobbering — useful while testing all three roles.

Recommended default: **1 + 2**. Add 3 if running all roles side-by-side is wanted.
