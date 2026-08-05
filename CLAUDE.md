# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Thai clothing e-commerce platform (thesis project) with an AI product chatbot and image search. Four services run together via Docker Compose: a Next.js storefront, a Node.js/Express auth API, a Python/FastAPI chatbot, and PostgreSQL 15 with the pgvector extension. Ollama runs on the **host machine** (not in Docker) and serves the embedding model (`bge-m3`). Chat LLM is planned to migrate from Ollama `qwen2.5:7b` → **OpenRouter API** (better Thai language quality, no local GPU required).

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
                                                └─ middleware/auth.js (auth, requireAdmin — shared by server.js and routes/orderRoutes.js)

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
  ├─ product_chunks             – RAG text chunks + vector(1024) bge-m3 embeddings
  │                               ↑ retrieval.py reads embeddings from here at startup
  └─ product_image_embeddings   – CLIP visual search, vector(512) (stub, not yet filled)

Ollama (host :11434)  ←  both FastAPI and backfill scripts reach it directly

chatbot/db.py           — psycopg2 ThreadedConnectionPool (lazy init, fallback-safe)
backend/data/products.json — seed/import tool only; NOT read at chatbot runtime
```

## Database

### Schema files

- `postgres/init/01_schema.sql` — auto-runs on fresh volume (complete schema, all 16 tables)
- `postgres/migrations/` — numbered incremental migrations (`002_` through `014_`)
  - `005_new_ecommerce_schema.sql` — migrates an existing DB from old schema → new schema
  - `006_add_thai_fields.sql` — Thai name/description columns + store_policies table
  - `007_add_thai_variant_fields.sql` — Thai columns for pattern, sleeve, collar
  - `008_color_images.sql` — color field on product_images + unique primary index
  - `009_expand_payment_status.sql` — widens `orders.payment_status` to `unpaid/pending_verification/paid/rejected/refunded`, matching what the admin orders UI already sends. Schema-only: no endpoint currently sets `pending_verification` — see `docs/payment_verification_recommendations.md` for the still-unbuilt slip-upload flow that would produce it.
  - `010_product_sets.sql` — adds "product sets" (bundles, e.g. shirt + shorts sold together at a flat discounted price). Widens `variants.size` to `VARCHAR(100)` (a set-variant stores a synthesized combo label there, e.g. "Shirt (M) + Shorts (32)" — longer than the old 10-char size code). Adds `set_components(set_variant_id, component_variant_id, quantity)`, mapping a set's variant (a normal `variants` row on a `products` row with `category='set'`) to the real, standalone-sellable variants it bundles. A set's `stock` is never entered manually — it's derived via a trigger as `MIN(component.stock / quantity)` across its components, and recomputed automatically whenever a component's stock changes (including from an order). Admin-side, the backend (`addProduct`/`updateProduct` in `productControllers.js`) rejects creating/editing a set option whose picked components don't all share the same `pattern` — a set may never bundle mismatched patterns (e.g. a pattern-A shirt with a pattern-B short); sizes stay independent per component (a "pinned combo" — the admin picks one specific size per item per set option, not a combinatorial size matrix). `orderControllers.js` (`createOrder`) now checks stock and decrements it at order time — for a set item this decrements each component's stock instead of the set's own (which was previously a gap: no order ever touched `variants.stock` at all).
  - `011_user_addresses_junction.sql` — makes users↔addresses genuinely many-to-many (e.g. family members sharing one saved address) via a new `user_addresses(user_id, address_id, is_default, added_at)` join table, backfilled from existing `addresses.user_id` rows. `addresses.user_id` is kept as-is (now just the original creator, informational) — nothing that already queried it breaks. No "add an existing address to my account" UI/endpoint exists yet — out of scope for now (no saved-address UI exists on either side today).
  - `014_payment_slip.sql` — adds `orders.payment_slip_url` (TEXT), implementing the slip-upload half of the flow `docs/payment_verification_recommendations.md` scoped out. Customer-facing `POST /orders/:id/payment-slip` (`orderControllers.js` `uploadPaymentSlip`, reuses the same multer/`uploads/` pattern as product images) stores the slip and flips `orders.payment_status` to `pending_verification`; checkout now shows a real PromptPay QR (`payment.js`'s `POST /promptpay`, mounted at `/payment` in `server.js` — previously dead code, and required npm packages `qrcode`/`promptpay-qr` that weren't even in `package.json`) and an upload step before the final "awaiting verification" screen. Admin's existing confirm/reject buttons (`admin/orders/page.tsx`) are now reachable and show the uploaded slip image. `updatePaymentStatus` also now syncs the matching `payments` row's `status`/`paid_at` (previously only `orders.payment_status` changed, so `payments.status` stayed `'pending'` forever even for confirmed orders) and validates `status`/`payment_status` against an allow-list (400 instead of an opaque 500 on a bad value). `/orders/admin/*` routes now require `auth, requireAdmin` (previously fully unauthenticated) via the extracted `backend/middleware/auth.js`.

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

1. Create `postgres/migrations/015_description.sql` (next number is `015`).
2. All statements must be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Apply manually: `psql "$DATABASE_URL" -f postgres/migrations/015_description.sql`
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
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | |
| `RAG_TOP_K` | `3` | Products sent to LLM |
| `RAG_MIN_SCORE` | `0.20` | Lower = more recall, more noise |

Vector/lexical weights and the clothing-type penalty are hardcoded in `backend/chatbot/retrieval.py`.

## Image search

**DB table exists; backend pipeline in progress.**
The `product_image_embeddings` table (vector(512)) is ready in the schema.

### Implementation plan
- **Model:** `clip-ViT-B-32` via `sentence-transformers` (512-dim, matches schema)
- **New file:** `backend/chatbot/image_search.py` — lazy-loads CLIP model, `embed_image()`, `search_by_image()`
- **New endpoints in `main.py`:**
  - `POST /image-search` — multipart image upload → returns ranked product matches
  - `GET /image-search/status` — reports model_loaded + embeddings_in_db count
- **Backfill script:** `backend/scripts/backfill_image_embeddings.py` — downloads each `product_images.image_url`, computes CLIP embedding, writes to `product_image_embeddings`
- **Frontend API route:** `frontend/app/api/image-search/route.ts` (friend's side — mirrors `app/api/chat/route.ts`)

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

## Key env vars

```
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/<db>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b        # will be replaced by OpenRouter — keep for local dev
OLLAMA_EMBED_MODEL=bge-m3           # stays on Ollama — do not change without regenerating embeddings
OPENROUTER_API_KEY=...              # planned: replaces OLLAMA_CHAT_MODEL for production chat
RAG_TOP_K=3
RAG_MIN_SCORE=0.20
JWT_SECRET=...
FASTAPI_BASE_URL=http://localhost:8000
```

## Conventions

- SQL migrations: `NNN_short_description.sql`, three-digit zero-padded; next is `015_`
- Python: `snake_case.py` · TS utilities: `camelCase.ts` · React components: `PascalCase.tsx` · Next.js route dirs: `kebab-case`
- `product_chunks.embedding` is `vector(1024)` (bge-m3). CLIP image embeddings are `vector(512)` in `product_image_embeddings`.
- Product JSON format: `{ product_id, product_name, category, sub_category, description, variants: [{variant_id, size, color, price, stock, …}] }`
- `retrieval.py` reads products from PostgreSQL at runtime (NOT from products.json). Falls back to products.json only when `DATABASE_URL` is unset.
- `retrieval.py` and `import_products.js` both handle the new variant-based format AND old flat format (backward compat).
- `chatbot/db.py` — psycopg2 ThreadedConnectionPool; `get_conn()` returns `None` (not exception) when unavailable.
- Conversation state is in-memory only (max 500 sessions, not persisted across restarts). Clients must echo back the `conversation_id` UUID returned on first message.

## new comer updated
- when new improtant code that effect to project or in this claude.md updated the claude.md