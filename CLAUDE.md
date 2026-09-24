# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
## github commit
before commit tell me what are you going to commit. and let me name it
## Project overview

Thai clothing e-commerce platform (thesis project) with an AI product chatbot and image search. Four services run together via Docker Compose: a Next.js storefront, a Node.js/Express auth API, a Python/FastAPI chatbot, and PostgreSQL 15 with the pgvector extension. Ollama runs on the **host machine** (not in Docker) and serves the embedding model (`bge-m3`). Chat LLM migrates from Ollama `qwen2.5:7b` → **OpenRouter API** (no local GPU required) whenever `OPENROUTER_API_KEY` is set; unset (local dev default) keeps using Ollama `qwen2.5:7b` exactly as before. Default OpenRouter model is `google/gemini-3.5-flash-lite` — an **interim pick, pending the user's own side-by-side Thai-quality test** against `qwen/qwen3.7-flash` (much cheaper, unverified Thai quality); update this once they report back. Both candidates have 1M-token context windows, so unlike the earlier (delisted) Typhoon2 pick, context size is not a concern here.

## project duty

this is duo work project amd I'm take care of chatbot, image search and database structure while my friend care of frontend and web system if can, try not to change the part that didn't in my side.

## project scale
this is thesis bachelor level and have to full deploy demo to show. and has to make a paper for thesis so make in mind that not too over than bachelor level if over tell me i'll check first.

## Frontend change rule

**Before making any change to frontend files** (anything under `frontend/` — components, pages, styles, layout, UI), always stop and tell the user first. Describe what you plan to change and why, then wait for their approval before touching any frontend code. This applies to both Claude Code and Claude Design. The user needs to check with their friend (who owns the frontend) before any frontend change goes in.

## Website design rule
### Thai Clothing E-commerce — Color Rules (apply to EVERY page)

A warm, "quiet-luxury" tan palette. Never use pure white (`#fff`) as a full-page
background. Build every page as a three-layer stack:
**warm base → white cards → occasional tan / dark bands.**

### Palette

| Token            | Hex       | Role                                              |
|------------------|-----------|---------------------------------------------------|
| Page base        | `#ece2d6` | Default background of every page/body             |
| Nav / top bar    | `#faf7f2` | Slightly lighter warm off-white, sits above base  |
| Card surface     | `#ffffff` | Product cards, panels, any raised content surface |
| Hero band        | tan gradient `linear-gradient(150deg,#f4ede3,#ece2d6,#e3d4c2)` | Hero / feature bands |
| Footer / dark    | `#3d3025` | Footer, dark contrast sections                    |
| Primary accent   | `#8b5e3c` | Buttons, prices, links, active/selected state     |
| Accent tan (dark)| `#8b6f5a` | Secondary accents, icons, mono labels             |
| Accent tan (light)| `#b89f8d`| Tertiary accents, category tiles, logo `.co`      |
| Text primary     | `#3d3025` | Body & headings on light backgrounds              |
| Text muted       | `#9a8a7a` | English secondary line, captions                  |
| Border light     | `#e0d5c8` / `#ece2d6` | Hairlines, input borders, card outlines |

### Where each color goes

- **Page background** → `#ece2d6` (warm base). Never `#fff`.
- **Top navbar** → `#faf7f2` with `#e0d5c8` bottom border.
- **Cards / product tiles / raised panels** → `#fff`, radius ~14px,
  border `rgba(0,0,0,.1)`, soft shadow. Cards must "pop" off the warm base.
- **Hero / feature bands** → tan gradient, optional 135° diagonal texture stripes.
- **Category tiles** → tan gradients (`#8b6f5a`–`#b89f8d` range), white text.
- **Footer & dark contrast sections** → `#3d3025`, text `#e0d5c8`, muted `#b0a495`.
- **Buttons / prices / links / active state** → `#8b5e3c`.
- **Dead / not-yet-built links** (contact, terms, privacy) → render muted
  (`#7a6d5f` on dark, `#c8b8a6` on light), NOT as normal links, so they read as
  intentionally non-interactive.

### Typography (bilingual — Thai primary, English secondary/smaller)

- Thai display / headings → `Noto Serif Thai`
- Thai body / UI → `Noto Sans Thai` (or `IBM Plex Sans Thai` for product cards)
- English accents / italics → `Fraunces`
- Labels, prices-in-mono, codes → `IBM Plex Mono` (letter-spacing for eyebrows)
- Every heading pairs a large Thai line with a smaller English line underneath.

### Do / Don't

- ✅ Warm base, white cards, tan/dark bands, one primary accent (`#8b5e3c`).
- ✅ Max 1–2 background tones per page besides the base.
- ❌ No pure-white page backgrounds.
- ❌ No all-brown pages — tan is for frames/bands, not walls of body text.
- ❌ No new colors outside this palette; derive harmonious shades in OKLCH if needed.

## Running the project

### Full stack (recommended)

```bash
# Prerequisites: Ollama running on host at http://localhost:11434
ollama pull qwen2.5:7b
ollama pull bge-m3

docker compose up --build          # starts all four services
docker compose down -v             # full reset including postgres volume
```

URLs: frontend `http://localhost:3000` · chatbot API `http://localhost:8000` · auth API `http://localhost:5000`

### Individual services

```bash
# Frontend
cd frontend && npm install && npm run dev

# Auth backend (Node.js/Express)
cd backend && npm run dev

# Chatbot backend (Python/FastAPI)
pip install -r backend/chatbot/requirements.txt
cd backend/chatbot && uvicorn main:app --reload   # port 8000
```

### Frontend commands (from `frontend/`)

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
npm run start    # serve production build
```

> **Important:** This project uses Next.js 16 (App Router). APIs and conventions may differ from your training data — check `node_modules/next/dist/docs/` before using unfamiliar Next.js APIs. See `frontend/AGENTS.md`.

## Troubleshooting

### Frontend pages 404 even though the source file exists

**Symptom:** a page 404s in the browser (e.g. some `/admin/*` routes) even though its `page.tsx` clearly exists and is committed, while sibling routes still work fine.

**Cause:** the frontend Docker service mounts `/app/.next` and `/app/node_modules` as **anonymous volumes** (`docker-compose.yml`) so `npm ci`/build output survive container restarts and rebuilds for speed. If that cache ever drifts stale relative to the current source (e.g. the dev container ran for a long time without a clean rebuild), routes added or changed after the cache went stale will 404 while older, unaffected routes keep resolving.

**Fix:**
```bash
docker compose up --build -V     # -V = --renew-anon-volumes, discards stale .next/node_modules and rebuilds fresh
```
This is safe — it does **not** touch the named `postgres_data` volume, so the database is untouched. Do **not** reach for `docker compose down -v` (lowercase `-v`) to fix this — that removes *all* volumes, including `postgres_data`, and wipes the database.

This is a one-off cleanup, not something to run routinely — normal `docker compose up` / `up --build` keeps the frontend cache in sync correctly during regular development.

### Frontend edits don't show up even after saving the file

**Symptom:** you edit a file under `frontend/`, refresh the browser, and the page still shows the old version — no error, no 404, it just looks unchanged.

**Cause:** the frontend container runs Next.js 16 with **Turbopack** (`next dev`), not webpack. `WATCHPACK_POLLING=true` in `docker-compose.yml` is a **webpack-only** env var — Turbopack doesn't necessarily honor it, and native filesystem change events frequently don't propagate from a Windows host into the container over the `./frontend:/app` bind mount. The result: Turbopack's dev server can silently keep serving a stale in-memory compile of the old source indefinitely, even though the file on disk is correct.

**Fix:**
```bash
docker restart kevin-web-shopping-frontend-1     # or: docker compose restart frontend
```
This forces Turbopack to recompile from the current source. Confirmed via `docker logs` and by diffing the served `/_next/static/chunks/...` JS output before/after — the stale chunk was byte-identical across an edit until the restart, then updated immediately.

**Practical implication:** don't trust "I edited the file, it should be live" for this frontend container — after any edit, restart the container (or check the compiled chunk / container logs for a recompile) before concluding a change did or didn't take effect.

## Architecture

```
Browser
  └─► Next.js 16 (port 3000)
        ├─► POST /api/chat  ──proxy──►  FastAPI /chat (port 8000)
        │                                  ├─ intent.py     (rule-based classifier)
        │                                  ├─ retrieval.py  (hybrid vector+lexical RAG)
        │                                  └─ embeddings.py (Ollama bge-m3 client)
        └─► /auth/* /profile  ──────────►  Express (port 5000)
              /orders/* /payment/*             ├─ bcrypt + JWT + pg
              /live-chat/*                      ├─ middleware/auth.js (auth, requireAdmin — shared by server.js and routes/orderRoutes.js)
                                                └─ live-chat handoff: customer routes unauthenticated (keyed by conversation_id), /live-chat/admin/* behind auth+requireAdminOrStaff

PostgreSQL 15 + pgvector (port 5432)  ← single source of truth for all data
  ├─ users / addresses          – auth, profile, multi-address
  ├─ user_addresses             – join table: an address can be shared by 2+ users (e.g. family)
  ├─ products / variants        – catalogue with SKU-level stock & price
  ├─ set_components             – "set"/bundle variants → their real component variants
  ├─ product_images             – gallery URLs (+ product_image_embeddings for CLIP)
  ├─ carts / cart_items         – active shopping carts
  ├─ orders / order_items       – order headers + line items
  ├─ payments                   – payment records
  ├─ reviews                    – product reviews
  ├─ discount_codes             – coupons / promotions
  ├─ chat_sessions / chat_messages – live-chat handoff: every chatbot conversation + turn, persisted from msg #1 so an admin can join mid-thread
  ├─ admin_presence             – heartbeat row per admin/staff (drives the "admin online" signal in the widget)
  ├─ product_chunks             – RAG text chunks + vector(1024) bge-m3 embeddings
  │                               ↑ retrieval.py reads embeddings from here at startup
  └─ product_image_embeddings   – CLIP visual search, vector(512) (stub, not yet filled)

Ollama (host :11434)  ←  both FastAPI and backfill scripts reach it directly

chatbot/db.py           — psycopg2 ThreadedConnectionPool (lazy init, fallback-safe)
backend/data/products.json — seed/import tool only; NOT read at chatbot runtime
```

## Database

### Schema files

- `postgres/init/01_schema.sql` — auto-runs on fresh volume (complete schema, all 17 tables)
- `postgres/migrations/` — numbered incremental migrations (`002_` through `014_`)
  - `005_new_ecommerce_schema.sql` — migrates an existing DB from old schema → new schema
  - `006_add_thai_fields.sql` — Thai name/description columns + store_policies table
  - `007_add_thai_variant_fields.sql` — Thai columns for pattern, sleeve, collar
  - `008_color_images.sql` — color field on product_images + unique primary index
  - `009_expand_payment_status.sql` — widens `orders.payment_status` to `unpaid/pending_verification/paid/rejected/refunded`, matching what the admin orders UI already sends. Schema-only: no endpoint currently sets `pending_verification` — see `docs/payment_verification_recommendations.md` for the still-unbuilt slip-upload flow that would produce it.
  - `010_product_sets.sql` — adds "product sets" (bundles, e.g. shirt + shorts sold together at a flat discounted price). Widens `variants.size` to `VARCHAR(100)` (a set-variant stores a synthesized combo label there, e.g. "Shirt (M) + Shorts (32)" — longer than the old 10-char size code). Adds `set_components(set_variant_id, component_variant_id, quantity)`, mapping a set's variant (a normal `variants` row on a `products` row with `category='set'`) to the real, standalone-sellable variants it bundles. A set's `stock` is never entered manually — it's derived via a trigger as `MIN(component.stock / quantity)` across its components, and recomputed automatically whenever a component's stock changes (including from an order). Admin-side, the backend (`addProduct`/`updateProduct` in `productControllers.js`) rejects creating/editing a set option whose picked components don't all share the same `pattern` — a set may never bundle mismatched patterns (e.g. a pattern-A shirt with a pattern-B short); sizes stay independent per component (a "pinned combo" — the admin picks one specific size per item per set option, not a combinatorial size matrix). `orderControllers.js` (`createOrder`) now checks stock and decrements it at order time — for a set item this decrements each component's stock instead of the set's own (which was previously a gap: no order ever touched `variants.stock` at all).
  - `011_user_addresses_junction.sql` — makes users↔addresses genuinely many-to-many (e.g. family members sharing one saved address) via a new `user_addresses(user_id, address_id, is_default, added_at)` join table, backfilled from existing `addresses.user_id` rows. `addresses.user_id` is kept as-is (now just the original creator, informational) — nothing that already queried it breaks. No "add an existing address to my account" UI/endpoint exists yet — out of scope for now (no saved-address UI exists on either side today).
  - `014_payment_slip.sql` — adds `orders.payment_slip_url` (TEXT), implementing the slip-upload half of the flow `docs/payment_verification_recommendations.md` scoped out. Customer-facing `POST /orders/:id/payment-slip` (`orderControllers.js` `uploadPaymentSlip`, reuses the same multer/`uploads/` pattern as product images) stores the slip and flips `orders.payment_status` to `pending_verification`; checkout now shows a real PromptPay QR (`payment.js`'s `POST /promptpay`, mounted at `/payment` in `server.js` — previously dead code, and required npm packages `qrcode`/`promptpay-qr` that weren't even in `package.json`) and an upload step before the final "awaiting verification" screen. Admin's existing confirm/reject buttons (`admin/orders/page.tsx`) are now reachable and show the uploaded slip image. `updatePaymentStatus` also now syncs the matching `payments` row's `status`/`paid_at` (previously only `orders.payment_status` changed, so `payments.status` stayed `'pending'` forever even for confirmed orders) and validates `status`/`payment_status` against an allow-list (400 instead of an opaque 500 on a bad value). `/orders/admin/*` routes now require `auth, requireAdmin` (previously fully unauthenticated) via the extracted `backend/middleware/auth.js`.
  - `015_wishlish.sql` — adds `wishlist(user_id, product_id, added_at)`, a many-to-many join table backing the new wishlist feature (`backend/controllers/wishlistControllers.js`, `frontend/app/wishlist/page.tsx`, `frontend/lib/wishlist-context.tsx`). Came in via merge from the friend's frontend branch with a bug: the file created the table as `wishlist` (singular, matching the controller's queries) but its `CREATE INDEX` targeted a nonexistent `wishlists` (plural) table — fixed to reference `wishlist` before applying.
  - `016_order_addcolumn.sql` — adds `orders.discount_code` (TEXT) and `orders.discount_amount` (NUMERIC, default 0), backing the new discount-code feature (`backend/controllers/discountControllers.js`).
  - `017_payment_slips.sql` — adds `payment_slips(slip_id, order_id, slip_url, status, reject_reason, reviewed_by, reviewed_at, uploaded_at)`, a per-upload history table backing the payment-slip **rejection & re-submission loop** (see the subsection below). One row per customer slip upload — rows are never deleted, so a rejected slip stays on record after the customer sends a new one. `orders.payment_slip_url` is kept as a plain mirror of the newest slip's URL so the existing customer/admin order views work unchanged. Backfilled: one row per existing order that already had a `payment_slip_url` (status derived from the order's `payment_status`). No CHECK-constraint change on `orders` — `rejected` was already allowed since `009_`.
  - `018_live_chat_handoff.sql` — adds `chat_sessions`, `chat_messages`, `admin_presence` for the **"talk to a human" live-chat handoff** (see the subsection below). Required as persisted tables because the FastAPI chatbot keeps conversation state in memory only (single uvicorn process, no `--workers`) — an admin reading the thread from Express needs it in the DB, and it must survive a chatbot restart. No changes to `users`/`orders`/existing `/chat` response keys.
  - `019_order_courier.sql` — adds `orders.courier_name VARCHAR(100)` (see **Courier tracking number** below). `orders.tracking_number` already existed in the schema since `005_` but was never written by any endpoint — this migration is really about making both columns writable, not adding tracking_number itself.
  - `020_simplify_order_status.sql` — simplifies `orders.status` from 6 values to 4 (`pending/confirmed/shipped/cancelled`, dropping `delivered` — merged into `confirmed`, which was already the app's real "complete" state — and `refunded`, which no endpoint ever set) and drops `refunded` from `orders.payment_status` and `payments.status` too (also never set by any code path). Adds `orders.shipped_at TIMESTAMPTZ`, stamped once the first time an order's status becomes `shipped`. See **Order status simplification & receipt confirmation** below.
  - `021_schema_drift_cleanup.sql` — fixes two gaps found between `01_schema.sql` and what was actually running on the long-lived dev DB: `wishlist.product_id` was unbounded `VARCHAR` (bug in `015_`) instead of `VARCHAR(20)` like every other FK to `products.product_id`, and a leftover `users_role_check` constraint (from `004_`, superseded by `chk_users_role` when `005_` rebuilt the `users` table) duplicated the same 3-value check. Both fixed by this migration. Separately, `users.address` was found missing from `01_schema.sql` even though it's live on every real DB (added at runtime by `server.js`'s `ensureUserProfileColumns()` self-heal, used by the address-sync feature below) — no migration needed for that one since the column already self-heals, but `01_schema.sql` itself was corrected to include it so a fresh volume's schema file actually matches reality.

### Courier tracking number (no courier API — manual admin entry)

No courier has an API integration (and none is planned — see the top-of-file
note this was scoped down from real order tracking to this instead). An admin
manually types in the tracking number + picks the courier after handing a
package to them; the customer sees it on their order and gets a link to that
courier's own tracking page to check status themselves.

- **DB:** `orders.tracking_number` (existing) + `orders.courier_name` (new,
  `019_`) — `courier_name` stores a **slug** (`thailand_post`, `kerry`,
  `flash`, `jt`, `ninja_van`, `dhl`, `other`), not a display label.
- **Backend:** `PATCH /orders/admin/:id/tracking` (`orderControllers.js`
  `updateOrderTracking`, `auth, requireAdminOrStaff`) takes
  `{ tracking_number, courier_name }` and writes both columns in one
  unconditional `UPDATE` (no status-transition rules to guard, unlike
  `updateOrderStatus`/`updatePaymentStatus`) — `courier_name` is checked
  against `VALID_COURIERS` (same slug list as below), 400 on anything else.
  `formatOrderRow`/`ORDER_SELECT` now also return `courierName`.
- **Courier slug → label + tracking URL** lives in **one place**,
  `frontend/lib/couriers.ts` (`COURIERS`, `getCourier()`), used by both the
  admin picker and the customer-facing link so they can't drift out of sync.
  Where a courier's tracking site is known to accept the number as a query
  param (Thailand Post, Kerry, Flash, DHL) the link prefills it; for J&T and
  Ninja Van it just opens their tracking page and the customer pastes the
  number in themselves (their URL query-param support wasn't verified — don't
  assume a prefill link works for those two without checking first).
- **Admin UI** (`frontend/app/admin/orders/page.tsx`): the order detail panel's
  tracking block (previously a read-only display of `trackingNumber` that
  nothing ever set) is now a courier `<select>` + tracking-number `<Input>` +
  save button, calling `updateOrderTrackingApi` then refetching orders (same
  refetch-not-optimistic pattern as `updatePaymentStatus`, since the server
  response shape changed).
- **Customer UI** (`frontend/app/orders/page.tsx`): new "ข้อมูลพัสดุ" /
  "Shipment tracking" section (i18n'd, `orders.trackingInfo` /
  `orders.courier` / `orders.trackingNumber` / `orders.trackAtCourier` keys in
  both `th`/`en` of `dictionaries.ts`), shown only when `trackingNumber` is
  set, with a button linking out to the courier's tracking page via
  `getCourier().trackingUrl()`.

### Order status simplification & receipt confirmation

`orders.status` was originally 6 values (`pending/confirmed/shipped/delivered/
cancelled/refunded`) but the admin UI only ever exposed 4 buttons, and
`delivered`/`refunded` were vestigial — `delivered` was never set by any
endpoint (only a hardcoded seed row), and `refunded` was never set on any of
`orders.status`, `orders.payment_status`, or `payments.status` by any code
path despite being an allowed value in all three. Migration `020_` merges
`delivered` into `confirmed` (already the app's real "complete" state — review
eligibility gates on it) and drops `refunded` from all three columns.

Previously an admin had no signal that a package actually reached the
customer — marking an order `confirmed` was a pure guess. Now:

- **DB:** `orders.shipped_at TIMESTAMPTZ` (new, `020_`) — stamped once, the
  first time an order's status transitions to `shipped` (inside
  `updateOrderStatus`'s `UPDATE`, guarded so a later, unrelated update like
  `updateOrderTracking` never resets it).
- **Customer "I received it":** `PATCH /orders/my/:id/confirm-receipt`
  (`orderControllers.js` `confirmMyOrderReceipt`, `auth` + ownership check via
  `WHERE order_id=$1 AND user_id=$2`) — allowed only while `status='shipped'`,
  sets `status='confirmed'`. No stock/discount reversal needed (forward-only),
  so unlike `cancelMyOrder` it's a single atomic `UPDATE ... RETURNING`, no
  explicit transaction.
- **Auto-confirm sweep:** `autoConfirmShippedOrders()` in `orderControllers.js`
  — one `UPDATE orders SET status='confirmed' WHERE status='shipped' AND
  shipped_at < NOW() - INTERVAL '<N> days'`, `N` from env var
  `ORDER_AUTO_CONFIRM_DAYS` (default `7`). Called once at boot and then on an
  hourly `setInterval` in `server.js` — no cron/scheduler dependency added;
  this is the first periodic background job in the repo (previously the only
  "staleness" pattern was `admin_presence`'s lazy read-time `WHERE last_seen_at
  > NOW() - INTERVAL '60 seconds'` check, which never mutates rows — this
  sweep does, since a customer's review eligibility and the admin dashboard
  both depend on `status` actually reaching `confirmed`).
- **Frontend:** customer `frontend/app/orders/page.tsx` shows a
  "ได้รับสินค้าแล้ว" button (Actions block, same confirm-dialog pattern as the
  existing cancel-order button) only when `status='shipped'`, calling the
  endpoint above then refetching. Admin `frontend/app/admin/orders/page.tsx`'s
  terminal-status guard simplified to `status === 'cancelled'` (was
  `['cancelled','refunded']`); `frontend/app/admin/page.tsx`'s dashboard
  status-badge switch no longer has `delivered`/`refunded` cases.

### Payment-slip rejection & re-submission loop

Previously an admin rejecting a slip was a dead end: `orders.payment_status = 'rejected'`, no reason recorded, no customer recovery, stock never returned. Now:

- **`updatePaymentStatus`** (`PATCH /orders/admin/:id/payment-status`) takes an optional `reason` in the body. On `rejected` it writes `status='rejected' + reject_reason + reviewed_by + reviewed_at` onto the **latest** `payment_slips` row (keeping the existing `orders.payment_status` + `payments.status='failed'` sync). On `paid` it marks that row `approved`. Re-rejecting an already-rejected order just overwrites `reject_reason` — this is how the admin "sends more detail".
- **`POST /orders/my/:id/payment-slip`** (`customerReuploadPaymentSlip`, `auth` + ownership check) — customer re-upload from order history. Allowed **only** when `payment_status='rejected'`. Inserts a new `payment_slips` row (old rows untouched), re-mirrors `orders.payment_slip_url`, sets `payment_status='pending_verification'`, resets `payments.status='pending'`. The original checkout upload endpoint `POST /orders/:id/payment-slip` is unchanged except it now also writes a `payment_slips` row and refuses (409) once the order is paid/shipped/cancelled.
- **`PATCH /orders/my/:id/cancel`** (`cancelMyOrder`, `auth` + ownership check) — customer cancels their own order. Allowed only while `status='pending'` AND `payment_status IN ('unpaid','pending_verification','rejected')`. Restores stock and reverses one discount-code use, sets `status='cancelled'`, `payments.status='failed'`.
- **Behaviour change:** admin `updateOrderStatus` (`PATCH /orders/admin/:id/status`) now also restores stock + reverses the discount-code use + sets `payments.status='failed'` the first time an order moves into `cancelled` (it was previously a pure label change — a latent bug). `cancelled` is now **terminal** — trying to move an order back out of it returns 409 — so the restock runs at most once per order (a customer-cancel then admin re-cancel can't double-restock). (Originally `cancelled`/`refunded` were both treated as terminal; `refunded` was removed entirely in `020_` — see **Order status simplification & receipt confirmation** below.)
- New shared helpers in `orderControllers.js`: `restoreOrderStock(client, orderId)` (exact reverse of `createOrder`'s decrement loop — handles set components; relies on `trg_variants_stock_cascade` for derived set stock) and `restoreDiscountUse(client, discountCode)`. **Caller contract:** hold `SELECT … FROM orders WHERE order_id=$1 FOR UPDATE` in the same transaction and only call when the order is not already `cancelled`.
- Order read responses (`formatOrderRow`) gain `slips: [{url, status, rejectReason, uploadedAt}]` (oldest→newest) and `paymentRejectReason` (latest rejected slip's reason). Fetched via a separate `slipsByOrderId`/`slipsForOrder` query, **not** a JOIN into `ORDER_SELECT` (a one-to-many JOIN would fan out order rows).
- Frontend for this loop is built: customer `frontend/app/orders/page.tsx` shows the reject reason + a re-upload control (`POST /orders/my/:id/payment-slip` with the auth token) + a "ยกเลิกคำสั่งซื้อ" button (confirm dialog → `PATCH /orders/my/:id/cancel`) + a read-only "ประวัติสลิป" list; admin `frontend/app/admin/orders/page.tsx` has a reason `<Textarea>` (seeded from `paymentRejectReason`, re-usable while already rejected — button relabels to "ส่งเหตุผลอีกครั้ง") and a per-slip history list replacing the single `<img>`; `frontend/lib/orders.ts` `updatePaymentStatusApi` now takes an optional `reason`. The admin payment confirm/reject handler switched from optimistic update to refetch (server mutates `payment_slips`).

### Live chat handoff — "คุยกับแอดมิน" (talk to a human)

When the chatbot can't help, the customer can escalate to a live admin/staff who
joins the same conversation. Transport is **short polling ~3s** (no WebSocket/SSE
— nothing realtime exists in the repo). Migration `018_live_chat_handoff.sql`.

- **DB:** `chat_sessions(session_id, conversation_id UNIQUE, user_id?, guest_label,
  customer_lang, status, assigned_admin_id, escalated_at/claimed_at/ended_at,
  last_customer_seen_at, …)` — `status ∈ bot|waiting|live|closed`;
  `chat_messages(message_id BIGSERIAL, session_id, sender_type ∈
  customer|bot|admin|system, sender_admin_id?, body, created_at)` — `message_id`
  is the **poll cursor** (`after_id`), never a timestamp (two writer processes →
  `NOW()` not monotonic); `admin_presence(user_id PK, last_seen_at)`.
- **FastAPI (`backend/chatbot/main.py`):** `chat()` is now a thin wrapper over the
  old body (renamed `_bot_turn`). It reads `chat_sessions.status` per request
  (fail-open to `bot` on any DB error); when `waiting`/`live` it **skips the LLM**,
  persists the customer message, and returns a `{reply:"", intent:"HUMAN_HANDOFF",
  handoff_active:true}` stub. Otherwise `_finalize()` persists the customer+bot
  turn (best-effort, connection never held across the LLM call), tracks a
  `low_conf_streak` in the in-memory session dict, and stamps
  `handoff_suggested` (true after 2 consecutive canned "can't help" replies —
  exact-string match against `_CANNED_CANT_HELP_REPLIES`) onto every response.
- **Express (`routes/liveChatRoutes.js` + `controllers/liveChatControllers.js`,
  mounted at `/live-chat`):** customer side is **unauthenticated, keyed by
  `conversation_id`** (validated by `CID_RE`) — `POST /escalate` (flips
  `bot|closed → waiting`, `ON CONFLICT` so it works even if the bot never
  persisted the row; returns `admin_online` + `last_message_id` for the widget's
  cursor), `POST /message`, `GET /poll?conversation_id&after_id`, `POST /leave`.
  Admin side is `auth, requireAdminOrStaff` — `GET /admin/queue` (also upserts
  `admin_presence` as a heartbeat side effect), `POST /admin/claim` (race-safe
  `UPDATE … WHERE status='waiting'`), `GET /admin/session/:conversationId`,
  `POST /admin/message`, `POST /admin/close`. Server-inserted `system`
  breadcrumbs are Thai (admin-only).
- **"Admin online"** = any `admin_presence` row newer than 60s (heartbeat = the
  `/admin/chat` queue poll). Bundled into every `escalate`/`poll` response.
- **Customer widget (`frontend/components/ChatWidget.tsx` + `lib/liveChat.ts`):**
  adds `mode: bot|waiting|live|closed`, an always-visible "คุยกับแอดมิน" chip +
  an auto-offer bubble on `handoff_suggested`, a data-driven online/offline
  header dot, and a 3s poll loop while `waiting`/`live`. It **filters `system`
  rows** from the poll and synthesizes its own localized transition lines via
  `t()` (all new copy is `chat.*` keys in both `th` and `en` of
  `dictionaries.ts`). Persists `mode` + poll cursor in `localStorage`
  (`kevin_chat_v1`), reconciles once against the server on mount. Suppressed on
  `/admin/*` via `usePathname()`.
- **Admin page (`frontend/app/admin/chat/page.tsx`, nav "แชทลูกค้า"):** two-pane
  queue + conversation view, queue poll 5s, conversation poll 3s, Thai-only
  literals (admin pages aren't i18n'd) with a `TH`/`EN` tag per row showing the
  customer's language. Nav item added to all 6 admin `navItems`/`NAV_ITEMS`
  arrays (no shared `_nav.ts` — deliberate).
- **Bot resume:** admin close → `status='closed'`; FastAPI treats `closed`
  identically to `bot`, so the next customer message resumes the bot on the same
  `conversation_id` / `session_id`. Re-clicking "คุยกับแอดมิน" re-escalates the
  same row (full history preserved).

### users table — backward-compat note

The Express auth backend (`backend/server.js`) queries `id`, `password`, and `address` column names.
The new `users` table keeps those exact names:
- `id` (not `user_id`) as PK
- `password` (stores bcrypt hash — not plain text)
- `address` — kept for backward compat, but is now an **auto-synced flat-text mirror** of the user's default `addresses` row (see below), not something anyone edits directly anymore.

### Address sync — profile ⇄ checkout share one row

Previously `users.address` (profile) and the `addresses` table (checkout) were two
completely disconnected records for the same user — checkout inserted a fresh
`addresses` row on every single order and never read anything back. This is now
fixed so there is exactly one "default" address per user, shared by both flows:

- `GET /profile` (`backend/server.js`) LEFT JOINs `user_addresses` (`is_default = TRUE`)
  → `addresses` and returns `addressLine1/province/postalCode` alongside the existing
  profile fields. (`addresses.address_line2` exists in the schema but isn't exposed
  here — neither UI has a line-2 field.)
- `PUT /profile` upserts that same default row: updates it in place if it exists,
  otherwise creates it (and links it via `user_addresses`, `is_default = TRUE`) —
  but only if the request actually included address input, so a plain
  name/phone/email edit doesn't leave behind an empty address row. It also writes a
  flattened string into `users.address` (the legacy mirror column).
- `orderControllers.js` (`createOrder`) no longer blind-inserts a new `addresses` row
  per order — it looks up the same default row via `user_addresses` and updates it in
  place (creating it only the first time), so editing your address at checkout keeps
  your profile's saved address current too. This is a deliberate simplification: there
  is one shared default address, not a per-order address history — but each order's
  `orders.shipping_snapshot` (JSONB, previously unpopulated) now freezes a copy of the
  address at order time, so past orders still show what was true when they were placed
  even after the default address is later edited.
- **Bug fixed in the same change:** the checkout form's "จังหวัด" (province) field was
  being written into the `city` column while the real `province` column was hardcoded
  to `'-'`. There's no separate district/city field in either UI, so the same value is
  now stored in both `city` and `province` until one exists.
- **UI fields aligned** (`frontend/app/profile/page.tsx`, `frontend/app/checkout/page.tsx`):
  profile's address input changed from one free-text `<Textarea>` to the same 3 plain
  inputs checkout already had (address line, province, postal code); checkout's single
  combined "ชื่อ-นามสกุล" name input changed to the same 2 inputs (first/last name)
  profile already had. `createOrder`'s request body is now `firstName/lastName/phone/
  address/province/postalCode` (previously `name/phone/address/city/postalCode`).

### Adding or changing tables

1. Create `postgres/migrations/022_description.sql` (next number is `022`).
2. All statements must be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Apply manually: `psql "$DATABASE_URL" -f postgres/migrations/022_description.sql`
4. Mirror the change in `postgres/init/01_schema.sql`.

### Full seed (fresh Docker volume)

```bash
# 1. Start the stack
docker compose up --build

# 2. Import products + variants + RAG text chunks
node backend/scripts/import_products.js

# 3. Generate pgvector embeddings for RAG
node backend/scripts/backfill_chunk_embeddings.js

# 4. Seed users, orders, reviews, discount codes
psql "$DATABASE_URL" -f backend/scripts/seed_database.sql
```

### Migrating an existing database (no fresh volume)

```bash
psql "$DATABASE_URL" -f postgres/migrations/005_new_ecommerce_schema.sql
psql "$DATABASE_URL" -f postgres/migrations/006_add_thai_fields.sql
psql "$DATABASE_URL" -f postgres/migrations/007_add_thai_variant_fields.sql
psql "$DATABASE_URL" -f postgres/migrations/008_color_images.sql
psql "$DATABASE_URL" -f postgres/migrations/009_expand_payment_status.sql
psql "$DATABASE_URL" -f postgres/migrations/010_product_sets.sql
psql "$DATABASE_URL" -f postgres/migrations/011_user_addresses_junction.sql
psql "$DATABASE_URL" -f postgres/migrations/012_cleanup_addresses.sql
psql "$DATABASE_URL" -f postgres/migrations/013_drop_users_address.sql
psql "$DATABASE_URL" -f postgres/migrations/014_payment_slip.sql
psql "$DATABASE_URL" -f postgres/migrations/015_wishlish.sql
psql "$DATABASE_URL" -f postgres/migrations/016_order_addcolumn.sql
psql "$DATABASE_URL" -f postgres/migrations/017_payment_slips.sql
psql "$DATABASE_URL" -f postgres/migrations/018_live_chat_handoff.sql
psql "$DATABASE_URL" -f postgres/migrations/019_order_courier.sql
psql "$DATABASE_URL" -f postgres/migrations/020_simplify_order_status.sql
psql "$DATABASE_URL" -f postgres/migrations/021_schema_drift_cleanup.sql
node backend/scripts/import_products.js           # re-seed products with new schema
node backend/scripts/backfill_chunk_embeddings.js # regenerate embeddings
```

`backfill_chunk_embeddings.js` is hash-aware and skips rows that haven't changed.

### Clearing product data (before entering real products)

```bash
node backend/scripts/clear_product_data.js         # dry run — prints row counts, no changes
node backend/scripts/clear_product_data.js --yes    # TRUNCATEs products + everything dependent on it
```

Wipes `product_image_embeddings`, `product_chunks`, `reviews`, `payments`, `order_items`, `orders`, `cart_items`, `carts`, `product_images`, `variants`, `products` in one `TRUNCATE ... RESTART IDENTITY CASCADE`. This also clears orders/carts/reviews (not just products) because `order_items.variant_id` has no `ON DELETE` rule — any variant referenced by a past order blocks a plain product delete. `users`, `addresses`, `discount_codes`, `store_policies` are left untouched. Use this before entering a real catalogue through the admin UI so seeded sample data (`backend/scripts/seed_database.sql`) doesn't linger or conflict.

### Moving the database (and uploaded images) to another machine

The project isn't deployed yet — data only exists in the local `postgres` Docker volume plus files under `backend/uploads/`. `pg_dump`/`pg_restore` alone only move database rows (e.g. the `image_url` text), never the actual image files, so use these wrapper scripts instead of raw `pg_dump`:

```bash
# On the source machine (postgres service must be running):
node backend/scripts/export_db.js
# → writes backend/db_backups/<timestamp>/bos_butter.dump + .../uploads/

# Copy the WHOLE backend/db_backups/<timestamp>/ folder to the other machine
# (USB drive, cloud folder, etc.) — not just the .dump file.

# On the target machine (postgres service running, e.g. fresh `docker compose up -d postgres`):
node backend/scripts/import_db.js "backend/db_backups/<timestamp>/"
docker compose restart backend auth-backend frontend   # rebuild in-memory caches (RAG index, etc.)
```

`backend/db_backups/` is gitignored — backups are meant to be carried over by hand, not committed.

## RAG pipeline

The chatbot retrieves products using a hybrid score:

```
combined = (0.78 × cosine_similarity) + (0.22 × token_overlap_ratio)
```

Products not matching a detected clothing type are penalised ×0.25. Top `RAG_TOP_K` results above `RAG_MIN_SCORE` are injected into the LLM system prompt.

### Data flow (PostgreSQL is now the single source of truth)

```
PostgreSQL
  products + variants  ──────────────────────► retrieval.py (load_products)
  product_chunks.embedding (vector 1024)  ────► retrieval.py (index build, no Ollama call if pre-filled)
                                                      │
                                                      └─► in-memory _VECTOR_INDEX (hybrid scoring)
```

**Cache invalidation:** `retrieval.py` checks `MAX(products.updated_at)` on every `/chat` request. If a product is updated in the DB, the in-memory index auto-rebuilds on the next request — no restart needed.

**Embedding priority:**
1. `product_chunks.embedding` (pre-computed by `backfill_chunk_embeddings.js`) — loaded at index build time
2. Ollama bge-m3 on-the-fly — fallback for any product with NULL embedding

**`backend/data/products_embeddings.json`** is no longer read or written. It can be deleted.
**`backend/data/products.json`** is no longer read at chatbot runtime. It is only used by `import_products.js`.

To force a full index rebuild: update any product in the DB (triggers `updated_at`), or restart the chatbot container.

**pgvector** embeddings must be regenerated with `backfill_chunk_embeddings.js` after any model or product change.

Use `<=>` (cosine distance) for similarity queries, not `<->` (L2):

```sql
ORDER BY embedding <=> $1 LIMIT 5
```

### Product data update order

```
backend/data/products.json
  → import_products.js              (PostgreSQL)
  → backfill_chunk_embeddings.js    (pgvector)
  → rm products_embeddings.json     (Python cache)
  → restart chatbot                 (in-memory index rebuild)
```

### RAG tuning env vars

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_EMBED_MODEL` | `bge-m3` | Changing invalidates all caches |
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | Used only when `OPENROUTER_API_KEY` is unset |
| `OPENROUTER_API_KEY` | unset | When set, chat completions go to OpenRouter instead of Ollama |
| `OPENROUTER_CHAT_MODEL` | `google/gemini-3.5-flash-lite` | Only used when `OPENROUTER_API_KEY` is set |
| `RAG_TOP_K` | `3` | Products sent to LLM |
| `RAG_MIN_SCORE` | `0.20` | Lower = more recall, more noise |

Vector/lexical weights and the clothing-type penalty are hardcoded in `backend/chatbot/retrieval.py`.

## Image search

**Backend pipeline built and working end-to-end. Frontend upload UI not built yet (friend's side).**

- **Model:** `clip-ViT-B-32` via `sentence-transformers` (512-dim, matches schema), lazy-loaded on first use (not at FastAPI startup) — CPU-only torch build (see `backend/Dockerfile`; the default PyPI torch wheel pulls the full CUDA toolchain, unneeded on this no-GPU deploy target).
- **`backend/chatbot/image_search.py`** — `embed_image(image_bytes)`, `search_by_image(embedding, limit)`, `count_embeddings()`.
- **Endpoints in `main.py`:**
  - `POST /image-search` — multipart image upload → returns ranked product matches
  - `GET /image-search/status` — reports `model_loaded` + `embeddings_in_db` count
- **Backfill script:** `backend/scripts/backfill_image_embeddings.py` — run **inside the backend container** (`docker exec kevin-web-shopping-backend-1 python backend/scripts/backfill_image_embeddings.py`), not on the host, since CLIP's dependencies are only installed there. Downloads each `product_images.image_url`, computes a CLIP embedding, writes to `product_image_embeddings`. Skip logic is simpler than `backfill_chunk_embeddings.js`'s hash-aware version: `product_image_embeddings` has no `content_hash` column, so it only skips images with `embedded_at` already set — it can't detect a changed image at the same URL (clear `embedded_at` to force re-embedding one).
  - **Note:** `product_images.image_url` is stored as the browser-facing URL (`http://localhost:5000/...`), not reachable by that hostname from inside another container. The script rewrites it to `UPLOADS_BASE_URL` (default `http://auth-backend:5000`, the internal docker-network hostname) before fetching — override this env var if ever running the script on the host instead.
- **Frontend API route (not built, friend's side):** `frontend/app/api/image-search/route.ts` (mirrors `app/api/chat/route.ts`), plus upload UI in `/search` and the chat widget.

### Query pattern
```sql
SELECT pie.product_id, p.product_name, pi.image_url,
       1 - (pie.embedding <=> $1::vector(512)) AS similarity
FROM product_image_embeddings pie
JOIN product_images pi ON pie.image_id = pi.image_id
JOIN products p        ON pie.product_id = p.product_id
WHERE pie.embedding IS NOT NULL AND p.is_active = TRUE
ORDER BY pie.embedding <=> $1::vector(512)
LIMIT 10;
```

### Dependencies to add to `requirements.txt`
```
sentence-transformers
Pillow
python-multipart
```

## Store policy page

The footer's ช่วยเหลือ (Help) column previously had 3 dead (`href="#"`) links; it's
now a single link, "นโยบายร้าน" (Store Policies), pointing at `/policy`
(`frontend/app/policy/page.tsx`). That page client-fetches the new public
`GET /policies` endpoint (`backend/server.js`, no auth — same public pattern as
`GET /products`), which reads the existing `store_policies` table
(SHIPPING/RETURN/PAYMENT rows) — previously only consumed by the Python chatbot
for RAG answers, never exposed to the storefront UI. Both language columns
(`content_en`, `content_th`) are returned; the page renders `content_th` with
`whitespace-pre-line` since the seed content uses `\n- ` bullet formatting.

**Encoding bug found and fixed while building this:** `store_policies.content_en`
/`content_th` in the DB had every non-ASCII character (Thai text, en-dashes)
replaced with literal `?` — the seed data was corrupted at insert time, almost
certainly because `seed_database.sql` was originally applied via a Windows host
`psql` client without a UTF-8 client encoding. The source SQL file itself was
correct. Fixed by re-running just the `store_policies` upsert block (it was
already `ON CONFLICT (policy_type) DO UPDATE`, so this was a safe no-side-effect
re-seed) from **inside** the postgres container, where `client_encoding` is
UTF8 by default. If any *other* seeded table's Thai text also looks like `?`
garbage, it likely has the same root cause — re-seed that table from inside the
container rather than from a Windows host `psql`.

## Admin dashboard KPIs

`frontend/app/admin/page.tsx` shows sales (today + month-to-date), profit, order/user
counts, and a 30-day daily-revenue chart (current vs. previous 30 days, hover
tooltip), backed by `backend/server.js`'s `GET /admin/stats` and the new
`GET /admin/revenue-daily`.

- **Revenue definition:** every sales/profit figure excludes orders with
  `status IN ('cancelled','refunded')` — matches `getBestSellers`'s existing
  exclusion, which the old `/admin/stats` didn't (it summed *all* orders,
  including cancelled/unpaid ones).
- **Timezone:** all "today"/"yesterday"/month-to-date date comparisons use
  `(ordered_at AT TIME ZONE 'Asia/Bangkok')::date` — the container runs UTC,
  so a plain `::date` comparison was previously off by 7 hours.
- **Month-to-date comparison** is against the *same day-of-month range* last
  month (e.g. Aug 1–19 vs. Jul 1–19), not the full previous month.
- **Profit** is real revenue-minus-cost (`(order_items.unit_price -
  variants.cost_price) * quantity`), not an estimate — `variants.cost_price`
  was checked and found populated for all active variants at the time this
  was built. Only order items whose variant has `cost_price IS NOT NULL` are
  included, so profit will under-count (not silently zero out) if future
  products omit cost data.
- **`GET /admin/revenue-daily`** returns 60 days of daily revenue (`previous`:
  days 60–31 ago, `current`: last 30 days) with gaps filled to `0` via
  `generate_series`, so the chart never silently drops a day.
- **Auth:** `/admin/stats`, `/admin/low-stock`, `/admin/orders/recent`, and
  `/admin/revenue-daily` now require `role IN ('admin','staff')` (previously
  just a valid JWT — any logged-in customer could read store-wide sales
  figures). This is a separate inline check, not the shared `requireAdmin`
  middleware (which is admin-only and used by order/product management
  routes) — widening that would have loosened those too.

### Downloadable daily report

The admin dashboard header has a "ดาวน์โหลดรายงานวันนี้" button (`handleDownloadDailyReport`
in `frontend/app/admin/page.tsx`) that builds a client-side PDF for "today" (Asia/Bangkok)
via `backend/server.js`'s `GET /admin/reports/daily` (same `auth, requireAdminOrStaff` guard
as the other `/admin/*` KPI routes).

- **Scope is always today** — no date picker/param; matches the dashboard's other "today" KPIs.
- **Response shape:** `{ date, summary: { sales, profit, orders, newUsers, avgOrderValue },
  statusBreakdown, paymentBreakdown, needsAttention: { incompleteOrders, outOfStock },
  bestSellers: [...], orders: [...] }`. `summary` reuses the same sales/profit/orders
  definitions as `/admin/stats` (same cancelled/refunded exclusion). `bestSellers` is a new
  query (top 10 by qty sold that day, not the all-time `/products/best-sellers` the dashboard's
  own "best sellers" widget uses). `orders` is every order placed that day (id, customer,
  total, status, payment_status, ordered_at) — no `LIMIT 10` like `/admin/orders/recent`.
- **`statusBreakdown`/`paymentBreakdown`** are `{ [value]: count }` maps computed in JS from
  the already-fetched `orders` rows (no extra query) — only keys that actually occurred that
  day are present, not every possible enum value.
- **`needsAttention.outOfStock`** is a new query: active variants of active products with
  `stock = 0` (strictly zero — a separate, stricter concept from the dashboard's existing
  `/admin/low-stock` widget, which flags `stock < 5`).
- **`needsAttention.incompleteOrders`** is filtered from the already-fetched `orders` rows
  (no extra query): today's orders where `status = 'pending'` or
  `payment_status IN ('unpaid', 'pending_verification')`. Scoped to **today only**, by
  design — it does not surface older unresolved orders from previous days.
- **PDF headline**: the first line of the PDF (below the header band) is a single bold
  sentence combining sales, order count, and the attention count (`incompleteOrders.length +
  outOfStock.length`) — the actual "read the business in 5 seconds" payload; everything
  below it (summary boxes, breakdowns, alert lists, tables) is supporting detail.
- **PDF generation** reuses the jsPDF + Sarabun-Thai-font pattern already built for order
  receipts (`handleDownloadReceipt` in `frontend/app/orders/page.tsx`) — dynamic
  `import("jspdf")`, `/fonts/Sarabun-{Regular,Bold}.ttf` loaded via `fetch` +
  `addFileToVFS`/`addFont`. The font-loading block is duplicated rather than shared between
  the two call sites (kept small on purpose, not worth a shared module at this scale).
  No `jspdf-autotable` — tables/alert lists are drawn manually with a page-break check
  (`ensureSpace`), same as the receipt code.
- Explicitly **not** included: product reviews (this report is sales/orders only — a
  separate "review" reading was considered and ruled out with the user), payment-method
  breakdown, coupon/discount usage, new-vs-returning customer split, and refund/return
  tracking — kept out to keep the report scannable and within bachelor's-thesis scope.

## Key env vars

```
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/<db>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b        # used only when OPENROUTER_API_KEY is unset — local dev default
OLLAMA_EMBED_MODEL=bge-m3           # stays on Ollama — do not change without regenerating embeddings
OPENROUTER_API_KEY=...              # set to route chat through OpenRouter instead of Ollama
OPENROUTER_CHAT_MODEL=google/gemini-3.5-flash-lite  # only used when OPENROUTER_API_KEY is set
RAG_TOP_K=3
RAG_MIN_SCORE=0.20
JWT_SECRET=...
FASTAPI_BASE_URL=http://localhost:8000
ORDER_AUTO_CONFIRM_DAYS=7           # days a shipped order waits before auto-confirming if the customer never clicks "I received it"
```

## Conventions

- SQL migrations: `NNN_short_description.sql`, three-digit zero-padded; next is `022_`
- Python: `snake_case.py` · TS utilities: `camelCase.ts` · React components: `PascalCase.tsx` · Next.js route dirs: `kebab-case`
- `product_chunks.embedding` is `vector(1024)` (bge-m3). CLIP image embeddings are `vector(512)` in `product_image_embeddings`.
- Product JSON format: `{ product_id, product_name, category, sub_category, description, variants: [{variant_id, size, color, price, stock, …}] }`
- `retrieval.py` reads products from PostgreSQL at runtime (NOT from products.json). Falls back to products.json only when `DATABASE_URL` is unset.
- `retrieval.py` and `import_products.js` both handle the new variant-based format AND old flat format (backward compat).
- `chatbot/db.py` — psycopg2 ThreadedConnectionPool; `get_conn()` returns `None` (not exception) when unavailable.
- Chatbot **LLM context** (last-N turns, last-retrieved products, `low_conf_streak`) is in-memory only (max 500 sessions, lost on restart). Clients must echo back the `conversation_id` UUID returned on first message. Separately, since `018_`, the **full transcript** (every customer/bot/admin/system turn) IS persisted to `chat_messages` for the live-chat handoff — the two are independent.

## new comer updated
- when new improtant code that effect to project or in this claude.md updated the claude.md