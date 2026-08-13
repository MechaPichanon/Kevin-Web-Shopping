# 02 — Production docker-compose hardening

**What to build:** the demo stack survives unattended, long-running
operation on the VM during a thesis defense — services restart
automatically on crash, the frontend runs a production build instead of a
dev server, the chatbot runs without `--reload`, and health status is
visible for every service, not just `postgres`. See `../spec.md`
§"Production docker-compose changes" for the exact per-service changes.

**Blocked by:** 01 (touches the same `environment`/`command` sections of
`docker-compose.yml` — sequencing avoids building on top of an unverified,
uncommitted base).

**Status:** resolved

- [x] `frontend` service runs `npm run build && npm run start` (bound to
      `0.0.0.0:3000`), not `npm run dev`.
- [x] `backend` (chatbot) service's `uvicorn` command no longer includes
      `--reload`.
- [x] All five services (`backend`, `frontend`, `postgres`, `adminer`,
      `auth-backend`) have `restart: unless-stopped`.
- [x] `backend`, `frontend`, and `auth-backend` each have a `healthcheck:`
      block; `docker compose ps` shows all five services healthy after
      `docker compose up --build`.
- [x] Killing a container mid-run causes it to come back automatically
      (`restart: unless-stopped` verified empirically, not just read from
      the file).
- [x] The running frontend serves a production build — no dev-server
      overlay, no hot-reload on file edits; the chatbot doesn't reload on
      file edits either.
