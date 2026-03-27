# Web shopping project

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
