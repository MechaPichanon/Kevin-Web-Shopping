# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Thai clothing e-commerce platform (thesis project) with an AI product chatbot. Four services run together via Docker Compose: a Next.js storefront, a Node.js/Express auth API, a Python/FastAPI chatbot, and PostgreSQL 15 with the pgvector extension. Ollama runs on the **host machine** (not in Docker) and serves both the chat LLM (`qwen2.5:7b`) and the embedding model (`bge-m3`).

## project duty

this is duo work project amd I'm take care of chatbot, image search and database structure while my friend care of frontend and web system if can, try not to change the part that didn't in my side.

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

## Architecture

```
Browser
  └─► Next.js 16 (port 3000)
        ├─► POST /api/chat  ──proxy──►  FastAPI /chat (port 8000)
        │                                  ├─ intent.py     (rule-based classifier)
        │                                  ├─ retrieval.py  (hybrid vector+lexical RAG)
        │                                  └─ embeddings.py (Ollama bge-m3 client)
        └─► /auth/* /profile  ──────────►  Express (port 5000)
                                               └─ bcrypt + JWT + pg

PostgreSQL 15 + pgvector (port 5432)  ← single source of truth for all data
  ├─ users / addresses          – auth, profile, multi-address
  ├─ products / variants        – catalogue with SKU-level stock & price
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

- `postgres/init/01_schema.sql` — auto-runs on fresh volume (complete schema, all 14 tables)
- `postgres/migrations/` — numbered incremental migrations (`002_` through `005_`)
  - `005_new_ecommerce_schema.sql` — migrates an existing DB from old schema → new schema

### users table — backward-compat note

The Express auth backend (`backend/server.js`) queries `id`, `password`, and `address` column names.
The new `users` table keeps those exact names:
- `id` (not `user_id`) as PK
- `password` (stores bcrypt hash — not plain text)
- `address` (single-line legacy; structured addresses live in the `addresses` table)

### Adding or changing tables

1. Create `postgres/migrations/006_description.sql` (next number is `006`).
2. All statements must be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Apply manually: `psql "$DATABASE_URL" -f postgres/migrations/006_description.sql`
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
node backend/scripts/import_products.js           # re-seed products with new schema
node backend/scripts/backfill_chunk_embeddings.js # regenerate embeddings
```

`backfill_chunk_embeddings.js` is hash-aware and skips rows that haven't changed.

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

**DB table exists; ingest pipeline not yet implemented.**
The `product_image_embeddings` table (vector(512)) is ready in the schema.

To complete implementation:
- Add a FastAPI multipart upload endpoint that embeds query image with CLIP → queries `product_image_embeddings` via `<=>` cosine distance
- Populate `product_images` rows (real URLs) and run CLIP ingest to fill `product_image_embeddings`
- `frontend/app/api/image-search/route.ts` proxying to FastAPI (mirror `app/api/chat/route.ts`)

Query pattern (once embeddings are filled):
```sql
SELECT pi.product_id, pi.image_url, pie.embedding <=> $1 AS distance
FROM product_image_embeddings pie
JOIN product_images pi ON pi.image_id = pie.image_id
ORDER BY distance
LIMIT 10;
```

## Key env vars

```
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/<db>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=bge-m3
RAG_TOP_K=3
RAG_MIN_SCORE=0.20
JWT_SECRET=...
FASTAPI_BASE_URL=http://localhost:8000
```

## Conventions

- SQL migrations: `NNN_short_description.sql`, three-digit zero-padded; next is `006_`
- Python: `snake_case.py` · TS utilities: `camelCase.ts` · React components: `PascalCase.tsx` · Next.js route dirs: `kebab-case`
- `product_chunks.embedding` is `vector(1024)` (bge-m3). CLIP image embeddings are `vector(512)` in `product_image_embeddings`.
- Product JSON format: `{ product_id, product_name, category, sub_category, description, variants: [{variant_id, size, color, price, stock, …}] }`
- `retrieval.py` reads products from PostgreSQL at runtime (NOT from products.json). Falls back to products.json only when `DATABASE_URL` is unset.
- `retrieval.py` and `import_products.js` both handle the new variant-based format AND old flat format (backward compat).
- `chatbot/db.py` — psycopg2 ThreadedConnectionPool; `get_conn()` returns `None` (not exception) when unavailable.
- Conversation state is in-memory only (max 500 sessions, not persisted across restarts). Clients must echo back the `conversation_id` UUID returned on first message.

## new comer updated
- when new improtant code that effect to project or in this claude.md updated the claude.md