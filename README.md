# Web shopping project

## Run with Docker (Docker Desktop)
From `Kevin-Web-Shopping/`:

1. Start everything:
   - `docker compose up --build`

2. One-time: pull the Ollama models (in another terminal):
   - `docker compose exec ollama ollama pull qwen2.5:7b`
   - `docker compose exec ollama ollama pull nomic-embed-text`

3. Open:
   - UI: `http://localhost:3000`
   - API: `http://localhost:8000`

Notes:
- If you already run Ollama on your host, you can remove/disable the `ollama` service and set `OLLAMA_BASE_URL=http://host.docker.internal:11434` on the `backend` service instead.

## How to run Chatbot API (FastAPI)
1. Start Ollama (chat model): `ollama run qwen2.5:7b`

2. Pull an embedding model for vector-RAG (one time):
   - `ollama pull nomic-embed-text`

3. Install Python requirements:
   - `pip install -r backend/chatbot/requirements.txt`

4. Run the API:
   - `cd backend/chatbot`
   - `uvicorn main:app --reload`

## How to run Chatbot UI (Next.js)
1. Install frontend dependencies:
   - `cd frontend`
   - `npm install`

2. (Optional) Configure backend URL (defaults to `http://localhost:8000`):
   - Copy `frontend/.env.local.example` to `frontend/.env.local`
   - Set `FASTAPI_BASE_URL` if your FastAPI is not on `http://localhost:8000`

3. Start the web UI:
   - `cd frontend`
   - `npm run dev`
   - Open `http://localhost:3000`

## Vector-RAG config (optional)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`)
- `RAG_TOP_K` (default `3`)
- `RAG_MIN_SCORE` (default `0.20`)

## Demo retrieval (optional)
From `backend/chatbot`:
- `python demo_retrieval.py`
- `python demo_retrieval.py --rebuild "cotton shirt"`
