# Item cancellation workflow

## The scenario

A customer orders **5 momos + 3 lassis**. Partway through, they want to cancel
some units (e.g. "drop 2 momos") but keep the rest. What should happen?

## What the system already supports (backend)

The data model is built for **per-item** cancellation, not just whole-order:

- Each `OrderItem` has its own status (`PENDING → PREPARING → READY → SERVED`, or
  `CANCELLED`), independent of the other lines.
- `set_item_status(..., "cancel")` ([backend/apps/orders/services.py](../backend/apps/orders/services.py))
  marks one line `CANCELLED` and re-derives the order status from the rest.
- The **bill excludes cancelled lines** — `Order.subtotal` filters them out
  ([backend/apps/orders/models.py](../backend/apps/orders/models.py)).
- **Stock is untouched** for cancelled lines — `deduct_for_order` skips them and
  only runs at payment ([backend/apps/inventory/services.py](../backend/apps/inventory/services.py)).
- The API already lets a **waiter or admin** cancel a single item
  ([backend/apps/orders/views.py](../backend/apps/orders/views.py)).

## The gap (frontend)

The waiter order screen exposes **no per-line cancel** — only a "Serve" button per
ready line, and a **whole-order** "Cancel order" that appears only while the order
is still `PLACED` ([frontend/src/features/waiter/OrderScreen.tsx](../frontend/src/features/waiter/OrderScreen.tsx)).
So today, in the UI, a waiter cannot cancel just the burger / just 2 momos.

## The design: don't pre-track per unit ("pull", not "push")

A tempting but wrong idea: have the kitchen mark each unit prepared/unprepared so
the waiter always knows how many are cancellable. This is **push** tracking — it
taxes the chef on *every* order to serve a rare case. It collapses on big orders.

Better: **one commitment point, then ask only when needed.**

### State 1 — kitchen tapped "Received" (not cooking yet)
Nothing committed. **Waiter cancels any quantity freely**, no chef involvement.
Covers the large majority of real cancellations (people change their mind fast).

### State 2 — kitchen tapped "Preparing" (cooking)  ✅ IMPLEMENTED
The screen doesn't know how many units are physically done — only the chef does.
So a cancel becomes a quick handshake. The chef gets **three** responses:

```
Waiter taps "Cancel 2× Momo" (qty + optional reason)
   → Kitchen ticket shows "✗ cancel 2× — <reason>" with three buttons:
       → STASH   → cancelled, kept to reheat (off the bill).            [disposition STASHED]
       → WASTE   → cancelled, discarded / loss (off the bill).          [disposition WASTED]
       → CAN'T   → can't cancel (e.g. plated sizzler): STAYS on the     [waiter notified]
                  bill, waiter gets a "can't cancel" toast.
```

So a momo (reheatable) → **Stash**; a finished sizzler → **Can't cancel** (customer
pays). The chef only acts **when a cancel is actually requested** (rare), not after
every unit — granularity is lazy, on demand.

**Where it lives:** `cancel_item` / `void_respond` endpoints + `request_item_void` /
`respond_item_void` / `cancel_item_units` services; `OrderItem.void_requested_qty`,
`void_reason`, `cancel_disposition` (VOIDED/STASHED/WASTED). Kitchen UI in
KitchenHome; waiter cancel dialog + decline toast in OrderScreen. Verified
end-to-end (stash/waste cancel & drop from bill; can't-cancel keeps it billed).
PENDING (not-yet-started) units still cancel instantly as **VOIDED**, no kitchen step.

### State 3 — "Ready" / served
Food is made/eaten. Not a cancel anymore — it's a **comp/refund** (admin-only).

## What needs building

- **Quantity-aware cancel** (today it's all-or-nothing per line): reduce a line's
  quantity, e.g. 5 lassis → cancel 2 → 3.
- **Phase 1 (do first, small):** free per-line / partial cancel while a line is
  not yet started (`PENDING`). Waiter-only, no chef, ~90% of real cases.
- **Phase 2 (later, optional):** kitchen-confirmed void for already-cooking items,
  with optional wastage stock-out for inventory accuracy.

## Open decisions

See [open-decisions.md](open-decisions.md):
- Who may cancel an item already **cooking** — waiter alone, or manager PIN?
- Capture a **reason** on cancel (changed mind / out of stock / too slow)?
- Are line quantities "servings" (partial cancel matters) or mostly 1 (then a
  plain per-line cancel button is enough)?
