#!/usr/bin/env python3
"""
backfill_image_embeddings.py — backfill CLIP image embeddings for the
product catalogue.

For every product_images row without an embedding yet, downloads
image_url, computes a CLIP embedding via chatbot/image_search.py's
embed_image(), and writes it to product_image_embeddings.

Skip logic: unlike backfill_chunk_embeddings.js (which is hash-aware via
product_chunks.content_hash), product_image_embeddings has no content-hash
column, so this can only skip images that already have embedded_at set —
it can't detect that an image changed at the same URL. To re-embed a
changed image, clear its embedded_at first.

Usage (run inside the backend container, where CLIP's dependencies are
already installed — not on the host, unlike the Node.js import/backfill
scripts):
    docker exec kevin-web-shopping-backend-1 python backend/scripts/backfill_image_embeddings.py
"""
import os
import sys
import urllib.parse

import psycopg2
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "chatbot"))
import image_search  # noqa: E402

# product_images.image_url is stored as the browser-facing URL
# (http://localhost:5000/uploads/...), which isn't reachable by that
# hostname from inside another container. Default rewrites it to the
# auth-backend service's internal docker-network hostname, matching how
# docker-compose.yml already reaches it (e.g. FASTAPI_BASE_URL). Override
# to e.g. http://localhost:5000 if running this script on the host instead
# of inside the backend container.
UPLOADS_BASE_URL = os.getenv("UPLOADS_BASE_URL", "http://auth-backend:5000")


def _resolve_image_url(image_url: str) -> str:
    parsed = urllib.parse.urlsplit(image_url)
    base = urllib.parse.urlsplit(UPLOADS_BASE_URL)
    return urllib.parse.urlunsplit((base.scheme, base.netloc, parsed.path, parsed.query, parsed.fragment))


def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set.", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        """
        SELECT pi.image_id, pi.product_id, pi.image_url
        FROM product_images pi
        LEFT JOIN product_image_embeddings pie ON pie.image_id = pi.image_id
        WHERE pie.embedded_at IS NULL
        ORDER BY pi.image_id
        """
    )
    rows = cur.fetchall()

    if not rows:
        print("Nothing to backfill — every product image already has an embedding.")
        cur.close()
        conn.close()
        return

    print(f"Backfilling {len(rows)} image(s)...")
    succeeded = 0
    failed = 0

    for image_id, product_id, image_url in rows:
        progress = succeeded + failed + 1
        try:
            response = requests.get(_resolve_image_url(image_url), timeout=30)
            response.raise_for_status()
            embedding = image_search.embed_image(response.content)
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
                (image_id, product_id, image_search.CLIP_MODEL_NAME, vector_literal),
            )
            succeeded += 1
            print(f"  [{progress}/{len(rows)}] embedded image {image_id} ({product_id})")
        except Exception as exc:
            failed += 1
            print(f"  [{progress}/{len(rows)}] FAILED image {image_id} ({product_id}): {exc}", file=sys.stderr)

    cur.close()
    conn.close()
    print(f"Done: {succeeded} succeeded, {failed} failed.")


if __name__ == "__main__":
    main()
