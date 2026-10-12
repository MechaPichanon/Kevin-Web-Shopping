---
title: Kevin Chatbot
emoji: 👕
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: FastAPI chatbot + image search for the Kevin thesis shop
---

# Kevin chatbot (FastAPI)

Backend for the thesis e-commerce demo: product chatbot (OpenRouter LLM + bge-m3
RAG over Supabase/pgvector) and CLIP image search. The code lives in the GitHub
repo `MechaPichanon/Kevin-Web-Shopping` (`backend/chatbot/`); the `Dockerfile`
here clones it at build time.

Settings are in the Space's **Variables and secrets** — see
`docs/deploy_plan.md` (step 3) in the GitHub repo for the list.

Endpoints: `GET /` (health), `POST /chat`, `POST /image-search`,
`GET /image-search/status`, and the Express-only `POST /embed-text` and
`POST /image-search/embed-one` (require the `X-Internal-Key` header).
