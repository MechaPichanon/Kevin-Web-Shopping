# Spec: Cloud Deployment Readiness + AI Image Search

Status: ready-for-agent

Covers sequencing items 1–3 of the approved gap-closing roadmap
(`C:\Users\frank\.claude\plans\staged-sprouting-stroustrup.md`): deployment
prerequisites, production docker-compose hardening, chat/embedding model
hosting, and AI image search. Items 4–7 (password reset, reviews write path,
catalog gaps, staff role) are deliberately out of scope — each gets its own
`/to-spec` pass when its turn comes, since the roadmap marks them as
independent of this window and specing them now would go stale.

## Problem Statement

Two unrelated problems block the thesis demo:

1. The app currently only runs correctly on `localhost` with hardcoded
   secrets and no upload validation — none of which works once the site
   moves to a public cloud VM the committee can reach remotely (per
   `docs/adr/0001-cloud-vm-deploy-containerized-ollama.md`). Some of this
   work has already been done in the working tree but is uncommitted and
   unverified.
2. AI image search — the thesis's second headline AI feature, alongside the
   chatbot — is 0% built. The schema (`product_image_embeddings`,
   `vector(512)`) exists but no code writes or reads it, so a shopper cannot
   search by photo today.

## Solution

Verify, complete, and commit the deployment-readiness work already
in-progress; harden `docker-compose.yml` for a long-running demo instance;
migrate the chat LLM to OpenRouter while keeping embeddings on a
VM-hosted Ollama; and build the CLIP-based image search pipeline end to end
(embedding, search endpoint, backfill script, status endpoint) per the design
already specified in `CLAUDE.md`.

## User Stories

1. As a developer, I want CORS origins read from an env var instead of
   hardcoded `localhost`, so that the Express and FastAPI services accept
   requests from the deployed frontend's real hostname.
2. As a developer, I want `JWT_SECRET` and `DATABASE_URL` sourced from `.env`
   instead of committed in `docker-compose.yml`, so that secrets aren't
   checked into git.
3. As a new contributor (or the thesis committee reproducing the deploy), I
   want a tracked `.env.example` documenting every required env var, so that
   I don't have to reverse-engineer what's needed from source.
4. As a shopper or admin uploading a product/payment-slip image, I want the
   server to reject disallowed file types and oversized files with a clean
   400, so that a bad upload can't crash the request or write an unexpected
   file type to disk.
5. As a developer, I want the three previously-duplicated multer configs
   (`server.js`, `productRoutes.js`, `orderRoutes.js`) consolidated into one
   shared `backend/middleware/upload.js`, so that the validation rule is
   defined once.
6. As the person operating the VM, I want Adminer bound to `127.0.0.1` only,
   so that the DB admin UI isn't reachable from the public internet.
7. As a developer, I want `docs/` un-ignored in git, so that `CONTEXT.md`,
   the ADRs, and `docs/planning.md` survive a fresh clone (e.g. onto the VM,
   or for my collaborator) instead of being silently missing.
8. As the person running the demo, I want all services to restart
   automatically on crash (`restart: unless-stopped`), so that a transient
   failure during the defense doesn't require manual intervention.
9. As the person running the demo, I want the frontend served from a
   production build (`next build && next start`) instead of `next dev`, so
   that the demo isn't running an unoptimized dev server with hot-reload
   overhead.
10. As the person running the demo, I want the FastAPI service running
    without `--reload`, so that it isn't watching the filesystem for changes
    it will never receive in production.
11. As the person operating the VM, I want healthchecks on `backend`,
    `frontend`, and `auth-backend` (not just `postgres`), so that a stuck
    container is visible/restartable rather than silently serving errors.
12. As a developer, I want chat completions to call OpenRouter instead of
    local Ollama when `OPENROUTER_API_KEY` is configured, so that the VM
    (no GPU) doesn't need to run `qwen2.5:7b` locally and Thai output
    quality improves.
13. As a developer, I want local dev to keep working against Ollama when no
    OpenRouter key is set, so that I don't need an API key for day-to-day
    development.
14. As the person operating the VM, I want `bge-m3` embeddings served by an
    Ollama instance running inside the VM (not assumed to be on a "host
    machine"), so that the embedding pipeline works in a container-only
    environment.
15. As a shopper, I want to upload a photo of a garment and get back a
    ranked list of visually similar products, so that I can find items I've
    seen elsewhere or in a physical store without knowing their name.
16. As a shopper, the products returned from an image search should only be
    active, in-catalogue products, so that I don't get matched to
    discontinued items.
17. As a developer/operator, I want a `GET /image-search/status` endpoint
    reporting whether the CLIP model is loaded and how many product images
    have embeddings, so that I can confirm the pipeline is healthy before a
    demo without needing to run a manual search.
18. As the developer maintaining the catalogue, I want a backfill script
    that computes CLIP embeddings for every `product_images` row missing
    one, so that image search works over the full catalogue after import
    without a manual per-image step.
19. As the developer re-running the backfill script after adding new
    products, I want it to skip images that already have an embedding, so
    that re-running it doesn't waste time/compute recomputing the whole
    catalogue every time.
20. As the thesis author, I want a small Precision@k evaluation script for
    image search (mirroring the existing chatbot intent/RAG eval scripts),
    so that the thesis paper can report a concrete accuracy number for this
    feature, not just "it works."
21. As the developer, I want the CLIP model lazy-loaded (not loaded at
    FastAPI startup), so that the chatbot service doesn't pay the model's
    load time/memory cost when image search hasn't been used yet.
22. As a developer, I want image-search deployment work scoped to the
    backend only, so that I don't touch `frontend/` without my
    collaborator's sign-off (per `CLAUDE.md`'s frontend rule) — the upload
    UI in `/search` and the chat widget affordance are flagged for a
    separate frontend conversation, not built here.

## Implementation Decisions

### 1. Deployment prerequisites — status: already implemented, uncommitted

Confirmed via `git status`/`git diff` against the working tree at spec time:
this work is **done**, not to be re-built. The ticket for this section is
**verify against the checklist below, close any gaps found, then commit** —
not a fresh implementation.

- `backend/server.js`: CORS now reads `process.env.CORS_ORIGIN`, falling
  back to `http://localhost:3000`. Duplicated inline multer config removed;
  now imports `{ upload, handleUploadErrors }` from
  `backend/middleware/upload.js`, and `app.use(handleUploadErrors)` is wired
  after the routes.
- `backend/chatbot/main.py`: CORS now builds `allow_origins` from
  `CORS_ORIGINS` (comma-separated env var), defaulting to the same two local
  dev origins when unset.
- `backend/middleware/upload.js` (new, untracked): single multer instance,
  `fileFilter` allow-listing `image/jpeg`/`image/png`/`image/webp`,
  `limits.fileSize` at 5MB, plus `handleUploadErrors` translating
  `MulterError` into a 400 JSON response. `productRoutes.js` and
  `orderRoutes.js` now import this shared module instead of their own
  multer configs.
- `docker-compose.yml`: `JWT_SECRET` and both `DATABASE_URL` occurrences
  replaced with `${JWT_SECRET}` / `${DATABASE_URL}`; `CORS_ORIGIN`/
  `CORS_ORIGINS` added to the `auth-backend`/`backend` environment blocks;
  Adminer's port binding changed to `127.0.0.1:8080:8080`.
- `.env` (gitignored, already present): now holds real `DATABASE_URL` and
  `JWT_SECRET` values alongside the pre-existing `DB_USER`/`DB_PASSWORD`/
  `DB_NAME`.
- `.env.example` (new, untracked): documents every var above plus the
  existing ones from `CLAUDE.md`'s "Key env vars" section, with
  placeholder/dev-default values.
- `.gitignore`: the blanket `docs/` line removed (`CONTEXT.md` and
  `docs/adr/*.md` are currently untracked as a result of this line, not by
  intent — confirmed via `git log -p` in the prior session).

**Gaps to check before committing** (not yet confirmed as done):
- `.env.example` accuracy — every var it documents must match what
  `docker-compose.yml` actually reads.
- No literal secret values remain anywhere in `docker-compose.yml` (`git
  diff` / grep for the old hardcoded `MY_SUPER_SECRET_KEY_KEVWEB` and
  `bosbutter%40db` strings should show them gone from that file).
- `frontend/components/ChatWidget.tsx` has an unrelated, already-modified
  one-line fix (product link routing) sitting in the same working tree —
  **not part of this spec's scope**; commit it separately (or leave it) and
  don't fold it into this ticket's commit.

### 2. Production docker-compose changes — not yet built

- `frontend` service: `command` changes from
  `npm ci && npm run dev -- --hostname 0.0.0.0 --port 3000` to a build-then-start
  form (`npm ci && npm run build && npm run start -- --hostname 0.0.0.0 --port 3000`).
- `backend` service: `command` drops `--reload` from the `uvicorn` invocation.
- Add `restart: unless-stopped` to all five services (`backend`, `frontend`,
  `postgres`, `adminer`, `auth-backend`).
- Add `healthcheck:` blocks to `backend`, `frontend`, and `auth-backend`
  (`postgres` already has one) — simple HTTP or TCP checks against each
  service's own port are sufficient; no new health endpoints need to be
  built solely for this, reuse an existing route that returns 200 (e.g. the
  service root) unless none exists, in which case add a trivial one.

### 3. Chat LLM + embedding model hosting

- Introduce an env-driven switch in the chatbot's LLM call site: when
  `OPENROUTER_API_KEY` is set, chat completions go to OpenRouter; when
  unset, fall back to the existing local Ollama `qwen2.5:7b` call — matching
  `CLAUDE.md`'s note that `OLLAMA_CHAT_MODEL` is "kept for local dev." This
  is a call-site branch, not a new abstraction layer — don't over-build a
  provider interface for two call sites.
- **Model decision (2026-08-13):** default OpenRouter model is
  `scb10x/typhoon2-70b-instruct` — Thai-English instruction-tuned, built on
  Llama 3.1, purpose-built for Thai output quality (the stated reason for
  this migration in `CLAUDE.md`). New env var `OPENROUTER_CHAT_MODEL`
  (mirroring the existing `OLLAMA_CHAT_MODEL` naming), defaulting to
  `scb10x/typhoon2-70b-instruct`, documented in `.env.example`. Note: this
  model reports an **8K context window** — smaller than the local
  `qwen2.5:7b` setup may assume. Verify during implementation that the
  RAG-injected system prompt (`RAG_TOP_K` products + conversation history)
  fits comfortably; truncate/trim conversation history first if not. Exact
  live pricing wasn't confirmable at spec time (OpenRouter's pricing page is
  JS-rendered) — confirm current $/M-token cost at `openrouter.ai/scb10x`
  before deploying.
- Embeddings (`bge-m3`) stay on Ollama, unchanged in code. Deployment-only
  change: `OLLAMA_BASE_URL` gets re-pointed at an Ollama instance running
  inside the VM (containerized or co-located) instead of
  `host.docker.internal`. No code change — this is purely an env var value
  at deploy time, already supported by existing config.

### 4. AI image search

Build to the design `CLAUDE.md` already specifies — no redesign:

- New `backend/chatbot/image_search.py`:
  - Lazy-loads `clip-ViT-B-32` via `sentence-transformers` on first use (not
    at FastAPI startup), matching user story 21.
  - `embed_image(image_bytes) -> list[float]` — 512-dim, matching the
    `product_image_embeddings.embedding` column type.
  - `search_by_image(embedding, limit=10) -> list[dict]` — runs the query
    pattern already specified in `CLAUDE.md`: cosine distance (`<=>`),
    joined through `product_images`/`products`, filtered to
    `pie.embedding IS NOT NULL AND p.is_active = TRUE`.
- `main.py` new endpoints:
  - `POST /image-search` — multipart image upload, returns ranked product
    matches (same response shape family as existing chat/product endpoints).
  - `GET /image-search/status` — returns `{ model_loaded: bool,
    embeddings_in_db: int }`.
- New `backend/scripts/backfill_image_embeddings.py`:
  - For every `product_images` row without a corresponding
    `product_image_embeddings.embedding`, downloads `image_url`, computes
    the CLIP embedding, writes it (and sets `embedded_at`).
  - **Deviation from the roadmap doc's wording:** the roadmap says to
    "mirror the hash-aware skip logic" of `backfill_chunk_embeddings.js`,
    but `product_image_embeddings` has no `content_hash` column (unlike
    `product_chunks`) — true content-hash-based change detection isn't
    supported by the current schema. Skip logic here is simpler: skip any
    row where `embedded_at IS NOT NULL` (i.e., already embedded once).
    Re-embedding a changed image at the same URL requires manually clearing
    `embedded_at` first. Adding a hash column to close this gap is a
    possible future migration, not part of this spec (avoid an unrequested
    migration for a one-time backfill at thesis catalogue scale).
- `backend/chatbot/requirements.txt`: add `sentence-transformers`, `Pillow`,
  `python-multipart`.

## Testing Decisions

Per `docs/adr/0003-minimal-security-hardening-scope.md` and the roadmap's
explicit "Automated test suite / CI pipeline" exclusion: **no new automated
test suite or CI wiring for this spec.** `/implement` should not generate a
pytest/jest suite for this work. Verification is manual + one eval script:

- **Manual verification checklist** (from the roadmap's own "Verification"
  section, scoped to items 1–3):
  - Set `CORS_ORIGIN`/`CORS_ORIGINS` to a non-localhost value locally,
    confirm the frontend's fetch to `backend`/`chatbot` fails with a CORS
    error, then set it back and confirm it works again.
  - `docker compose up --build`: confirm login still works (JWT resolved
    from `.env`) and product/order pages load (DATABASE_URL resolved from
    `.env`).
  - `git diff docker-compose.yml` (against the pre-prereqs commit) shows no
    literal secret values remaining.
  - Attempt a product-image or payment-slip upload with a renamed
    `.exe`/an oversized file — confirm a 400, not a 500 or silent
    acceptance.
  - `curl http://<vm-ip>:8080` from outside the VM after the port-binding
    change — confirm unreachable.
  - `git status` confirms `docs/adr/*.md` and `CONTEXT.md` are now
    trackable.
  - After the production docker-compose changes: `docker compose up
    --build`, confirm the frontend serves a production build (no
    dev-server overlay/hot-reload) and the chatbot doesn't hot-reload on
    file edits.
  - Kill a container mid-demo and confirm `restart: unless-stopped` brings
    it back.
  - `GET /image-search/status` returns `model_loaded: true` and a non-zero
    `embeddings_in_db` after running the backfill script.
  - Upload a known product photo to `POST /image-search`, confirm the
    correct product ranks in the top results.
  - Re-run the backfill script a second time with no catalogue changes,
    confirm it embeds zero new images (skip logic works).
- **New eval script** (thesis paper artifact, not CI): a Precision@k script
  for image search over a small hand-labeled set of product photos with
  known correct matches. Prior art:
  `backend/chatbot/tests/compare_intent_f1.py` (confirmed present, along
  with `intent_eval_dataset.json` and existing RAGAS/RAG-Precision@3
  scripts in the same directory) — mirror that script's shape
  (hand-labeled dataset file + a runner that prints a metric), but lighter
  weight since this is a new pipeline, not a tuned one.

## Out of Scope

- Password reset, reviews write path, catalog filters/sort, discount admin
  UI, staff role permission tier — roadmap items 4–7, each gets its own
  `/to-spec` when its turn comes.
- `postgres/migrations/015_*` — reserved for the reviews-phase migration
  (one-review-per-user-per-product); nothing in this spec needs a migration.
- Any frontend change: the image-search upload UI (both a `/search` entry
  point and a chat-widget affordance) is flagged for the user's
  collaborator, not designed or built here, per `CLAUDE.md`'s frontend
  approval rule. `frontend/components/ChatWidget.tsx`'s pre-existing
  unrelated one-line diff (product link fix) is untouched by this spec.
- Real payment gateway, email/SMS notifications, OAuth, login
  rate-limiting, an input-validation library, automated tests/CI, backorder
  handling, chatbot persistence beyond in-memory, multi-vendor/loyalty
  points/live chat — all previously declined in the roadmap and ADR 0003,
  reaffirmed here.
- Adding a `content_hash`-style column to `product_image_embeddings` for
  true hash-aware backfill skipping (see Implementation Decisions §4) —
  simpler `embedded_at IS NOT NULL` skip logic is sufficient at this scale.
- A general LLM-provider abstraction layer for chat — the OpenRouter/Ollama
  switch is a single call-site branch, not a pluggable provider system.

## Further Notes

- **Seam choice:** the one genuine code seam across this spec is the HTTP
  endpoint layer per service — `POST /image-search` / `GET
  /image-search/status` on FastAPI, and the existing upload endpoints on
  Express exercised through `backend/middleware/upload.js`. Deployment
  prerequisites and the production docker-compose changes are config-level,
  verified by inspection/`curl`/`docker compose up`, not by a code seam —
  don't invent one (e.g. no need to unit-test the CORS env var parsing in
  isolation).
- Cross-reference `CLAUDE.md`'s "Image search" and "Key env vars" sections
  and `docs/adr/0001-cloud-vm-deploy-containerized-ollama.md` for design
  details already agreed before this spec — this spec operationalizes them,
  it doesn't re-decide them.
- When this ticket set is done, `CLAUDE.md`'s "Image search" section header
  ("DB table exists; backend pipeline in progress") should be updated to
  reflect the pipeline now existing — per `CLAUDE.md`'s own "new comer
  updated" convention.
