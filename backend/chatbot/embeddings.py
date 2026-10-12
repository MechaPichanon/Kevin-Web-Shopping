"""
Text embeddings (bge-m3, 1024-dim) for RAG — one switch, EMBED_BACKEND:

  ollama (default)        → Ollama /api/embeddings on OLLAMA_BASE_URL (local dev)
  sentence-transformers   → BAAI/bge-m3 loaded in this process (HF Space deploy,
                            no Ollama there)

Both give the same vectors: on 2026-10-12, 23 product texts + 29 Thai eval
queries had cosine ≥ 0.9999 between the two, and vector search returned the
same top-3 for 25/25 queries — so stored product_chunks embeddings stay valid
whichever backend made them.
"""
import os
import threading
from typing import List, Optional

import requests


class EmbeddingError(RuntimeError):
    pass


EMBED_BACKEND = os.getenv("EMBED_BACKEND", "ollama").strip().lower()
ST_MODEL_NAME = os.getenv("EMBED_ST_MODEL", "BAAI/bge-m3")

_st_model = None
_st_lock = threading.Lock()


def _get_st_model():
    # Lazy, like CLIP in image_search.py: ~2.3 GB, loaded on first use.
    global _st_model
    if _st_model is None:
        with _st_lock:
            if _st_model is None:
                from sentence_transformers import SentenceTransformer
                _st_model = SentenceTransformer(ST_MODEL_NAME, device="cpu")
    return _st_model


def get_embedding(text: str) -> List[float]:
    """Embedding for `text` from whichever backend EMBED_BACKEND selects."""
    if EMBED_BACKEND != "sentence-transformers":
        return get_ollama_embedding(text)
    prompt = (text or "").strip()
    if not prompt:
        raise EmbeddingError("Empty text cannot be embedded")
    try:
        vector = _get_st_model().encode(prompt, normalize_embeddings=True)
    except Exception as exc:
        raise EmbeddingError(f"sentence-transformers embedding failed: {exc}") from exc
    return [float(x) for x in vector]


def _ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")


def _ollama_embed_model() -> str:
    return os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")


def get_ollama_embedding(text: str, *, timeout_s: int = 60) -> List[float]:
    """
    Returns an embedding vector from Ollama.

    Requires an embedding-capable model pulled in Ollama, e.g.:
      ollama pull nomic-embed-text
    """
    prompt = (text or "").strip()
    if not prompt:
        raise EmbeddingError("Empty text cannot be embedded")

    url = f"{_ollama_base_url()}/api/embeddings"
    payload = {"model": _ollama_embed_model(), "prompt": prompt}

    try:
        response = requests.post(url, json=payload, timeout=timeout_s)
    except requests.RequestException as exc:
        raise EmbeddingError(f"Failed to connect to Ollama at {url}") from exc

    if response.status_code >= 400:
        raise EmbeddingError(
            f"Ollama embeddings error {response.status_code}: {response.text[:200]}"
        )

    data = response.json()
    embedding: Optional[List[float]] = data.get("embedding")
    if not embedding or not isinstance(embedding, list):
        raise EmbeddingError("Ollama response missing 'embedding'")

    return [float(x) for x in embedding]

