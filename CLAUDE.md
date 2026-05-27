# Kevin Web Shopping — AI Agent Guide

This is a Thai clothing e-commerce platform built as a thesis project. It sells shirts, pants, and jackets with prices in THB. The system features a product chatbot backed by a RAG pipeline (vector + lexical hybrid retrieval via Ollama), a JWT-authenticated Node.js API for user accounts, and a Next.js storefront. A PostgreSQL 15 database with the pgvector extension stores both relational product data and 1024-dimensional chunk embeddings. Image search is planned but not yet implemented.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│            Next.js 16  (frontend, port 3000)                    │
│  app/api/chat/route.ts  ──proxy──►  FastAPI /chat               │
│  app/chat/ChatPage.tsx                                          │
│  app/search/page.tsx    (image search placeholder)              │
│  components/navbar.tsx                                          │
└──────┬───────────────────────────────────────────┬──────────────┘
       │ REST /auth/*  /profile                    │ REST /chat
┌──────▼────────────────┐              ┌───────────▼──────────────┐
│  Node.js Express 5    │              │  Python FastAPI           │
│  Auth Backend         │              │  Chatbot Backend          │
│  (port 5000)          │              │  (port 8000)              │
│  server.js            │              │  chatbot/main.py          │
│  JWT + bcrypt         │              │  intent / retrieval /     │
└──────┬────────────────┘              │  embeddings               │
       │ pg                            └───────────┬──────────────┘
       │                                           │ pg + Ollama API
       └──────────────┬────────────────────────────┘
                      │
┌─────────────────────▼──────────────────┐   ┌─────────────────────┐
│  PostgreSQL 15 + pgvector (port 5432)  │   │  Ollama (port 11434) │
│  DB: bos_butter                        │   │  qwen2.5:7b  (chat)  │
│  tables: users, products,              │   │  bge-m3      (embed) │
│          product_chunks                │   │  (host machine only) │
└────────────────────────────────────────┘   └─────────────────────┘
```

---

## Service Start Commands

### Full stack (recommended)

```bash
# Start all four services (postgres, backend, auth-backend, frontend)
docker compose up --build

# Tear down without deleting the postgres volume
docker compose down

# Nuke everything including the postgres volume (forces schema re-init)
docker compose down -v
```

### Individual services (local dev)

```bash
# Frontend (Next.js)
cd frontend && npm run dev               # http://localhost:3000

# Auth backend (Node.js / Express)
cd backend && npm run dev                # http://localhost:5000

# Chatbot backend (Python / FastAPI)
cd backend/chatbot
uvicorn main:app --reload --port 8000   # http://localhost:8000

# Pull required Ollama models (run once on host)
ollama pull qwen2.5:7b
ollama pull bge-m3
```

### Required env vars for local dev

Copy these to a `.env` file at the project root (do not commit secrets):

```
DB_USER=
DB_PASSWORD=
DB_NAME=
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<db>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=bge-m3
RAG_TOP_K=3
RAG_MIN_SCORE=0.20
JWT_SECRET=
FASTAPI_BASE_URL=http://localhost:8000
```

---

## Database

### Schema overview

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id` SERIAL, `email` UNIQUE, `password` (bcrypt), `role` CHECK ('admin'/'staff'/'customer') | JWT auth source |
| `products` | `id` TEXT PK, `name`, `category`, `price` NUMERIC(12,2), `currency`, `sizes` TEXT[], `colors` TEXT[], `material`, `description` | Imported from `backend/data/products.json` |
| `product_chunks` | `id` BIGSERIAL, `product_id` FK→products, `chunk_index` INT, `content` TEXT, `content_hash` (SHA-256), `embed_model`, `embedded_at`, `embedding` vector(1024) | One chunk per product currently; embedding is the pgvector column |

Indexes: `users.email`, `products.category`, `products.name`, `product_chunks.product_id`.

### Schema initialisation

`postgres/init/01_schema.sql` runs automatically when the Docker postgres volume is empty. It is idempotent — safe to inspect but **do not modify it for schema changes**; use numbered migrations instead.

### Running migrations manually

```bash
# Connect to the running container
docker exec -it kevin-web-shopping-postgres-1 psql -U $DB_USER -d $DB_NAME

# Inside psql — run a migration
\i /migrations/002_pgvector.sql
\i /migrations/003_user_profile.sql
\i /migrations/004_user_role.sql
```

Or from the host with psql:

```bash
psql "$DATABASE_URL" -f postgres/migrations/002_pgvector.sql
```

### Adding or changing tables

1. Write a new file at `postgres/migrations/NNN_short_description.sql`.
2. Number sequentially — next available is `005_...`.
3. Every statement must be idempotent: use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
4. Run it manually against the running database.
5. If the change must also be present on a fresh volume init, mirror it in `postgres/init/01_schema.sql`.

### Seeding product data

```bash
# 1. Import products.json into products + product_chunks tables
DATABASE_URL="postgresql://..." node backend/scripts/import_products.js

# 2. Generate and store pgvector embeddings for every chunk
DATABASE_URL="postgresql://..." node backend/scripts/backfill_chunk_embeddings.js
```

`import_products.js` uses `INSERT ... ON CONFLICT (id) DO UPDATE` — safe to re-run.  
`backfill_chunk_embeddings.js` skips rows whose `content_hash` and `embed_model` are already current.

---

## RAG Pipeline

### How the pipeline works

```
User message
    │
    ▼
[1] Intent detection  (intent.py)
    Rule-based regex + token matching.
    Outputs: PRODUCT_INFO | PRODUCT_COMPARE | OUT_OF_SCOPE
    Smalltalk and unsupported queries (best-seller, shipping) are
    short-circuited here before any embedding call.
    │
    ▼
[2] Query preprocessing  (retrieval.py  _tokenize / _autocorrect_tokens)
    Lowercases, normalises "t-shirt"→"tshirt".
    Applies a domain autocorrect dictionary ("shrit"→"shirt") built
    from the product vocabulary.
    │
    ▼
[3] Embedding  (embeddings.py  get_ollama_embedding)
    Calls Ollama POST /api/embeddings with OLLAMA_EMBED_MODEL (bge-m3).
    Returns a float[1024] vector.
    │
    ▼
[4] Hybrid retrieval  (retrieval.py  retrieve_products)
    For each product in the in-memory vector index:
      combined = (0.78 × cosine_similarity) + (0.22 × token_overlap_ratio)
    Products not matching a queried clothing type are penalised × 0.25.
    Top RAG_TOP_K candidates above RAG_MIN_SCORE are returned.
    Falls back to keyword substring search if Ollama is unreachable.
    │
    ▼
[5] Prompt assembly + LLM call  (main.py)
    Selected products are serialised as plain text and injected into a
    system prompt. The LLM (qwen2.5:7b) is called via Ollama
    POST /api/generate (non-streaming, 60 s timeout).
    │
    ▼
[6] Conversation context  (main.py  _CONVERSATIONS)
    In-memory dict keyed by UUID conversation_id.
    Stores last_products so follow-up pronouns ("it", "them") resolve
    to the previous result set.
    Capped at 500 sessions; oldest entry is evicted on overflow.
    Not persistent across restarts.
```

### Embedding cache (Python side)

- **Cache file:** `backend/data/products_embeddings.json`
- Keyed by `embed_model` + SHA-256 of `products.json`; any change auto-invalidates.
- To force a rebuild:

```bash
rm backend/data/products_embeddings.json   # delete the cache, then restart the chatbot
# or use the demo script's --rebuild flag:
python backend/chatbot/demo_retrieval.py --rebuild "cotton shirt"
```

### pgvector embeddings (DB side)

The `product_chunks.embedding` column (vector(1024)) is populated separately by a Node.js script.

```bash
DATABASE_URL="..." OLLAMA_EMBED_MODEL=bge-m3 node backend/scripts/backfill_chunk_embeddings.js

# Test pgvector cosine search directly against the DB
DATABASE_URL="..." node backend/scripts/vector_search_demo.js "cotton shirt"
```

Use `<=>` (cosine distance), not `<->` (L2). `ORDER BY embedding <=> $1 LIMIT N` returns the closest matches first.

### Key tuning parameters

| Variable | Default | Effect |
|---|---|---|
| `OLLAMA_EMBED_MODEL` | `bge-m3` | Embedding model. Changing this invalidates all caches and requires `backfill_chunk_embeddings.js` to re-run. |
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | LLM for final reply generation. |
| `RAG_TOP_K` | `3` | Max products passed to the LLM. Increase for richer comparisons (prompt grows). |
| `RAG_MIN_SCORE` | `0.20` | Minimum combined score to include a product. Lower = more recall, more noise. |
| Vector/lexical weights | `0.78` / `0.22` | Hardcoded in `retrieval.py`. Adjust here if lexical matching needs more weight. |
| Type penalty | `× 0.25` | Applied to products not matching the queried clothing type. Hardcoded in `retrieval.py`. |

### Testing retrieval locally

```bash
python backend/chatbot/demo_retrieval.py                          # default sample queries
python backend/chatbot/demo_retrieval.py "blue cotton pants"      # custom query
python backend/chatbot/demo_retrieval.py --rebuild "jacket"       # force cache rebuild then query
```

---

## Image Search

### Current status

**Not yet implemented.** Two UI stubs exist:

- `frontend/components/navbar.tsx` — camera icon button with no action handler.
- `frontend/app/search/page.tsx` — placeholder page (`<h1>Search Page</h1>`).

### What needs to be built

| Component | Location | Notes |
|---|---|---|
| Image embedding model | Python backend | CLIP (`openai/clip-vit-base-patch32`) recommended; alternative: BLIP captioner → text → existing bge-m3 pipeline |
| Image embedding column | New migration `005_image_embeddings.sql` | Add `image_embedding vector(512)` to `product_chunks` or a new `product_images` table (CLIP output dim = 512) |
| Embedding backfill script | New script in `backend/scripts/` | Fetch product images, run CLIP, store vectors |
| FastAPI image search endpoint | `backend/chatbot/main.py` or a new router | Accept multipart image upload, embed with CLIP, run `<=>` cosine search |
| Next.js API proxy | `frontend/app/api/image-search/route.ts` | Mirror the pattern in `app/api/chat/route.ts` |
| Frontend upload handler | `frontend/app/search/page.tsx` | Wire camera button to file input, POST to endpoint, render results |

The existing pgvector infrastructure (PostgreSQL, `<=>` operator, Docker setup) is already in place and reusable.

---

## Key Files Map

### Database

| File | Purpose |
|---|---|
| `postgres/init/01_schema.sql` | Authoritative schema; auto-runs on fresh volume |
| `postgres/migrations/002_pgvector.sql` | Enables pgvector, adds embedding columns |
| `postgres/migrations/003_user_profile.sql` | Adds first_name/last_name/phone/address to users |
| `postgres/migrations/004_user_role.sql` | Adds role column with CHECK constraint |

### RAG Pipeline

| File | Purpose |
|---|---|
| `backend/chatbot/main.py` | FastAPI app, `/chat` endpoint, intent routing, LLM call, conversation state |
| `backend/chatbot/intent.py` | Rule-based intent classifier |
| `backend/chatbot/retrieval.py` | Hybrid retrieval: vector index, cosine scoring, lexical overlap, autocorrect, embedding cache |
| `backend/chatbot/embeddings.py` | Thin Ollama embeddings client (`get_ollama_embedding`) |
| `backend/chatbot/demo_retrieval.py` | CLI test script for retrieval without the HTTP server |
| `backend/data/products.json` | Source of truth for product catalogue |
| `backend/data/products_embeddings.json` | Auto-generated embedding cache (do not commit if large) |
| `backend/scripts/import_products.js` | Imports products.json into PostgreSQL (upsert) |
| `backend/scripts/backfill_chunk_embeddings.js` | Generates pgvector embeddings for product_chunks rows |
| `backend/scripts/vector_search_demo.js` | Tests pgvector cosine search directly against the DB |

### Auth Backend

| File | Purpose |
|---|---|
| `backend/server.js` | Express routes: POST /auth/register, POST /auth/login, GET/PUT /profile |
| `backend/db.js` | pg Pool singleton (reads DATABASE_URL) |

### Frontend

| File | Purpose |
|---|---|
| `frontend/app/api/chat/route.ts` | Next.js API proxy: forwards chat requests to FastAPI |
| `frontend/app/chat/ChatPage.tsx` | Chat UI component (conversation state, send/receive) |
| `frontend/app/search/page.tsx` | Image search page (placeholder) |
| `frontend/components/navbar.tsx` | Navbar with search input and camera button stub |
| `frontend/lib/auth.ts` | `getToken()` helper (reads from localStorage) |

### Infrastructure

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines backend, frontend, postgres, auth-backend services |
| `backend/Dockerfile` | Python 3.11 image for FastAPI chatbot |
| `backend/Dockerfile.node` | Node.js image for Express auth backend |
| `frontend/Dockerfile` | Node.js image for Next.js frontend |

---

## Conventions

### Migration numbering

- Current highest: `004`
- Next migration must start with `005_`
- All SQL must be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Never drop columns/tables without a rollback comment
- Only `postgres/init/01_schema.sql` lives in `init/`; all incremental changes go in `migrations/`

### Product data update flow

Always update in this order to keep all layers consistent:

```
backend/data/products.json
    → node backend/scripts/import_products.js            (PostgreSQL)
    → node backend/scripts/backfill_chunk_embeddings.js  (pgvector)
    → rm backend/data/products_embeddings.json           (Python cache)
    → restart chatbot                                    (in-memory index rebuild)
```

### Embedding dimensions

- Current model `bge-m3` → **1024 dimensions**
- `product_chunks.embedding` is `vector(1024)` — changing the embed model requires a column redefinition migration
- Planned CLIP model → **512 dimensions** (separate column / table)

### Conversation IDs

FastAPI generates a UUID `conversation_id` on the first message and returns it in every response. Clients must echo it back in subsequent requests to maintain context. In-memory only — not persisted across restarts; max 500 sessions (oldest evicted on overflow).

### File naming

- Python: `snake_case.py`
- TypeScript/JS utilities: `camelCase.ts`; React components: `PascalCase.tsx`; Next.js route folders: `kebab-case`
- SQL migrations: `NNN_short_description.sql` (three-digit zero-padded)
