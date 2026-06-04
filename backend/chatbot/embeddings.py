import os
from typing import List, Optional

import requests


class EmbeddingError(RuntimeError):
    pass


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

