# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Thai clothing e-commerce platform (thesis project) with an AI product chatbot. Four services run together via Docker Compose: a Next.js storefront, a Node.js/Express auth API, a Python/FastAPI chatbot, and PostgreSQL 15 with the pgvector extension. Ollama runs on the **host machine** (not in Docker) and serves both the chat LLM (`qwen2.5:7b`) and the embedding model (`bge-m3`).

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

PostgreSQL 15 + pgvector (port 5432)
  ├─ users           – auth + profile
  ├─ products        – product catalogue (imported from backend/data/products.json)
  └─ product_chunks  – text chunks with vector(1024) embeddings for RAG

Ollama (host :11434)  ←  both FastAPI and backfill scripts reach it directly
```

## Database

### Schema files

- `postgres/init/01_schema.sql` — auto-runs on fresh volume; do **not** edit for changes
- `postgres/migrations/` — numbered incremental migrations (`002_` through `004_`)

### Adding or changing tables

1. Create `postgres/migrations/005_description.sql` (next number is `005`).
2. All statements must be idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
3. Apply manually: `psql "$DATABASE_URL" -f postgres/migrations/005_description.sql`
4. If needed at fresh-volume init time, mirror the change in `postgres/init/01_schema.sql`.

### Seeding products

```bash
# Run from project root with DATABASE_URL set
node backend/scripts/import_products.js           # upserts products.json → PostgreSQL
node backend/scripts/backfill_chunk_embeddings.js # generates vector(1024) embeddings → product_chunks
```

`backfill_chunk_embeddings.js` is hash-aware and skips rows that haven't changed.

## RAG pipeline

The chatbot retrieves products using a hybrid score:

```
combined = (0.78 × cosine_similarity) + (0.22 × token_overlap_ratio)
```

Products not matching a detected clothing type are penalised ×0.25. Top `RAG_TOP_K` results above `RAG_MIN_SCORE` are injected into the LLM system prompt.

**Embedding cache** (`backend/data/products_embeddings.json`) is keyed by model name + SHA-256 of `products.json`. Delete it to force a rebuild, or:

```bash
python backend/chatbot/demo_retrieval.py --rebuild "query"
```

**pgvector** embeddings in `product_chunks.embedding` are separate from the Python cache and must be regenerated with `backfill_chunk_embeddings.js` after any model or product change.

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

**Not yet implemented.** Stubs exist at `frontend/components/navbar.tsx` (camera button) and `frontend/app/search/page.tsx` (placeholder page).

To implement, add:
- CLIP embeddings (`vector(512)`) via a new migration `005_image_embeddings.sql`
- A FastAPI multipart upload endpoint that embeds with CLIP and queries via `<=>`
- `frontend/app/api/image-search/route.ts` proxying to FastAPI (mirror `app/api/chat/route.ts`)

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

- SQL migrations: `NNN_short_description.sql`, three-digit zero-padded; next is `005_`
- Python: `snake_case.py` · TS utilities: `camelCase.ts` · React components: `PascalCase.tsx` · Next.js route dirs: `kebab-case`
- `product_chunks.embedding` is `vector(1024)` (bge-m3). Planned CLIP image embeddings will be `vector(512)` in a separate column/table.
- Conversation state is in-memory only (max 500 sessions, not persisted across restarts). Clients must echo back the `conversation_id` UUID returned on first message.
