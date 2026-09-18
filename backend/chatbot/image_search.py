"""
image_search.py — CLIP-based visual product search.

Lazy-loads clip-ViT-B-32 via sentence-transformers on first use, not at
FastAPI startup, so the chatbot service doesn't pay the model's load
time/memory cost until image search is actually used.
"""

import io
import logging
import os
import threading
import urllib.parse
from typing import List

import requests
from PIL import Image

try:
    from .db import get_conn, release_conn
except ImportError:
    from db import get_conn, release_conn

logger = logging.getLogger(__name__)

CLIP_MODEL_NAME = "clip-ViT-B-32"

# product_images.image_url is stored as the browser-facing URL
# (http://localhost:5000/uploads/...), which isn't reachable by that
# hostname from inside another container. Rewrite it to the auth-backend
# service's internal docker-network hostname, matching how docker-compose.yml
# already reaches it elsewhere (e.g. FASTAPI_BASE_URL). Override to e.g.
# http://localhost:5000 if running outside Docker.
UPLOADS_BASE_URL = os.getenv("UPLOADS_BASE_URL", "http://auth-backend:5000")


def resolve_uploads_url(image_url: str) -> str:
    parsed = urllib.parse.urlsplit(image_url)
    base = urllib.parse.urlsplit(UPLOADS_BASE_URL)
    return urllib.parse.urlunsplit((base.scheme, base.netloc, parsed.path, parsed.query, parsed.fragment))

_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading CLIP model ({CLIP_MODEL_NAME})...")
        _model = SentenceTransformer(CLIP_MODEL_NAME)
        logger.info("CLIP model loaded")
        return _model


def is_model_loaded() -> bool:
    return _model is not None


def embed_image(image_bytes: bytes) -> List[float]:
    """Compute a 512-dim CLIP embedding for the given image bytes."""
    model = _get_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    embedding = model.encode(image)
    return [float(x) for x in embedding]


def search_by_image(embedding: List[float], limit: int = 10) -> List[dict]:
    """
    Rank active products by CLIP embedding cosine similarity.
    Returns [] if the DB is unavailable.
    """
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        vector_literal = "[" + ",".join(str(x) for x in embedding) + "]"
        cur.execute(
            """
            SELECT pie.product_id, p.product_name, pi.image_url,
                   1 - (pie.embedding <=> %s::vector(512)) AS similarity,
                   (SELECT MIN(v.price) FROM variants v
                    WHERE v.product_id = p.product_id AND v.is_active = TRUE) AS min_price
            FROM product_image_embeddings pie
            JOIN product_images pi ON pie.image_id = pi.image_id
            JOIN products p        ON pie.product_id = p.product_id
            WHERE pie.embedding IS NOT NULL AND p.is_active = TRUE
            ORDER BY pie.embedding <=> %s::vector(512)
            LIMIT %s
            """,
            (vector_literal, vector_literal, limit),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        release_conn(conn)

    return [
        {
            "product_id": product_id,
            "product_name": product_name,
            "image_url": image_url,
            "similarity": float(similarity),
            "min_price": float(min_price) if min_price is not None else None,
        }
        for product_id, product_name, image_url, similarity, min_price in rows
    ]


def store_embedding(cur, image_id: int, product_id: str, embedding: List[float]) -> None:
    """Upsert a CLIP embedding for one product_images row. Caller commits."""
    vector_literal = "[" + ",".join(str(x) for x in embedding) + "]"
    cur.execute(
        """
        INSERT INTO product_image_embeddings (image_id, product_id, embed_model, embedded_at, embedding)
        VALUES (%s, %s, %s, NOW(), %s::vector(512))
        ON CONFLICT (image_id) DO UPDATE SET
            embed_model = EXCLUDED.embed_model,
            embedded_at = EXCLUDED.embedded_at,
            embedding = EXCLUDED.embedding
        """,
        (image_id, product_id, CLIP_MODEL_NAME, vector_literal),
    )


def count_embeddings() -> int:
    """Count of product images with a CLIP embedding. Returns 0 if DB unavailable."""
    conn = get_conn()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT count(*) FROM product_image_embeddings WHERE embedding IS NOT NULL"
        )
        (count,) = cur.fetchone()
        cur.close()
        return int(count)
    finally:
        release_conn(conn)
