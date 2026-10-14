"""
Text embeddings (bge-m3, 1024-dim) for RAG — one switch, EMBED_BACKEND:

  ollama (default)        → Ollama /api/embeddings on OLLAMA_BASE_URL (local dev)
  sentence-transformers   → BAAI/bge-m3 loaded in this process (~2.3 GB RAM)
  openrouter              → OpenRouter /embeddings, model baai/bge-m3, with
                            OPENROUTER_API_KEY (Railway deploy: keeps bge-m3
                            out of the container's RAM)

All give the same vectors: on 2026-10-12, 23 product texts + 29 Thai eval
queries had cosine ≥ 0.9999 between sentence-transformers and Ollama (same
top-3 for 25/25 queries); on 2026-10-14, OpenRouter vs Ollama/stored vectors
had cosine ≥ 0.9999 (same top-3 for 28/29, the other a near-tie swap) — so
stored product_chunks embeddings stay valid whichever backend made them.
"""
import os
import threading
from typing import List, Optional

import requests


class EmbeddingError(RuntimeError):
    pass


EMBED_BACKEND = os.getenv("EMBED_BACKEND", "ollama").strip().lower()
ST_MODEL_NAME = os.getenv("EMBED_ST_MODEL", "BAAI/bge-m3")
OPENROUTER_EMBED_MODEL = os.getenv("OPENROUTER_EMBED_MODEL", "baai/bge-m3")

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
    if EMBED_BACKEND == "openrouter":
        return get_openrouter_embedding(text)
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


def get_openrouter_embedding(text: str, *, timeout_s: int = 60) -> List[float]:
    """Embedding from OpenRouter (baai/bge-m3, ~$0.01 per 1M tokens)."""
    prompt = (text or "").strip()
    if not prompt:
        raise EmbeddingError("Empty text cannot be embedded")
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise EmbeddingError("EMBED_BACKEND=openrouter but OPENROUTER_API_KEY is unset")

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": OPENROUTER_EMBED_MODEL, "input": prompt},
            timeout=timeout_s,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as exc:  # ValueError: body wasn't JSON
        raise EmbeddingError(f"OpenRouter embeddings request failed: {exc}") from exc

    try:
        embedding = data["data"][0]["embedding"]
    except (KeyError, IndexError, TypeError):
        raise EmbeddingError(
            f"unexpected OpenRouter embeddings response (HTTP {response.status_code}): {str(data)[:200]}"
        )
    return [float(x) for x in embedding]


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

