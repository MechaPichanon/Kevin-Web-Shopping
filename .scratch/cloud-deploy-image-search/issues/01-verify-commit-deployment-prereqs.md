# 01 — Verify and commit deployment prerequisites

**What to build:** the deployment-prerequisites work already sitting
uncommitted in the working tree (CORS via env var on both the Express and
FastAPI services, secrets moved out of `docker-compose.yml` into `.env`, a
shared upload-validation middleware rejecting bad file types/oversized
files with a 400, Adminer bound to localhost only, `docs/` no longer
git-ignored) gets verified against the checklist below, any gaps closed,
and committed. This is a **verify-and-commit** ticket, not a fresh build —
see `../spec.md` §"Deployment prerequisites — status: already implemented,
uncommitted" for exactly what's already in place and what still needs
checking.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Setting `CORS_ORIGIN`/`CORS_ORIGINS` to a non-localhost value locally
      causes the frontend's fetch to `backend`/`chatbot` to fail with a CORS
      error; setting it back to the local value works again.
- [x] `docker compose up --build`: login works (JWT resolved from `.env`)
      and product/order pages load (DATABASE_URL resolved from `.env`).
- [x] `docker-compose.yml` contains no literal secret values (the old
      hardcoded JWT secret string and DB password string are both gone).
- [x] `.env.example` is present, tracked, and every var it documents
      matches what `docker-compose.yml` actually reads.
- [x] Uploading a renamed `.exe` or an oversized file to any of the three
      upload endpoints (generic image upload, product image, payment slip)
      returns a 400, not a 500 or silent acceptance.
- [x] Adminer is unreachable from outside the host (`curl` to its port from
      another machine fails; only reachable via localhost/tunnel).
- [x] `git status` shows `docs/adr/*.md` and `CONTEXT.md` as trackable
      (not silently ignored).
- [x] `frontend/components/ChatWidget.tsx`'s pre-existing, unrelated
      one-line diff is left out of this ticket's commit.
- [x] All of the above is committed as a single coherent commit (or small
      set of commits) on top of the current working tree.
