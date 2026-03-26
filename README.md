# Web shopping project

## How to run Chatbot part
1. Start Ollama (chat model): `ollama run qwen2.5:7b`

2. Pull an embedding model for vector-RAG (one time):
   - `ollama pull nomic-embed-text`

3. Install Python requirements:
   - `pip install -r backend/chatbot/requirements.txt`

4. Run the API:
   - `cd backend/chatbot`
   - `uvicorn main:app --reload`

## Vector-RAG config (optional)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`)
- `RAG_TOP_K` (default `3`)
- `RAG_MIN_SCORE` (default `0.20`)

## Demo retrieval (optional)
From `backend/chatbot`:
- `python demo_retrieval.py`
- `python demo_retrieval.py --rebuild "cotton shirt"`
