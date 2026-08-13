# 04 — Image search: upload-to-results pipeline

**What to build:** a shopper can upload a photo of a garment and get back a
ranked list of visually similar, active products — the full path from
image upload through CLIP embedding to a scored result list, plus a
backfill script that populates embeddings for the existing catalogue (there
are currently zero) and a status endpoint to confirm the pipeline is
healthy. Build to the design already specified in `CLAUDE.md`'s "Image
search" section — see `../spec.md` §"AI image search" for the full
implementation decisions, including a noted deviation from the roadmap's
"hash-aware skip" wording (no `content_hash` column exists on
`product_image_embeddings`, so the backfill script's skip logic is simpler:
skip rows where `embedded_at IS NOT NULL`).

**Blocked by:** None — can start immediately (independent backend feature,
different service than 01/02).

**Status:** resolved

- [x] `POST /image-search` accepts a multipart image upload and returns a
      ranked list of product matches.
- [x] Results only include products where `is_active = TRUE` — a
      discontinued product's image never appears in results even if visually
      similar.
- [x] `GET /image-search/status` returns `model_loaded` (bool) and
      `embeddings_in_db` (int, count of rows with a non-null embedding).
- [x] The CLIP model (`clip-ViT-B-32`) is lazy-loaded on first use, not at
      FastAPI startup — confirmed by checking the chatbot service's startup
      time/memory is unaffected before any image-search request is made.
- [x] `backend/scripts/backfill_image_embeddings.py` downloads every
      `product_images.image_url` missing an embedding, computes its CLIP
      embedding, and writes it to `product_image_embeddings` (setting
      `embedded_at`).
- [x] Re-running the backfill script a second time with no catalogue
      changes embeds zero new images (skip-if-already-embedded logic
      works).
- [x] `sentence-transformers`, `Pillow`, and `python-multipart` are added to
      `backend/chatbot/requirements.txt`.
- [x] Uploading a known product photo to `POST /image-search` returns that
      exact product ranked at or near the top of results.
- [x] No `frontend/` files are touched — the `/search` upload UI and chat
      widget affordance are explicitly out of scope for this ticket (see
      `CLAUDE.md`'s frontend approval rule).
