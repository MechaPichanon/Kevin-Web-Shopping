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

import psycopg2
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "chatbot"))
import image_search  # noqa: E402


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
            response = requests.get(image_search.resolve_uploads_url(image_url), timeout=30)
            response.raise_for_status()
            embedding = image_search.embed_image(response.content)
            image_search.store_embedding(cur, image_id, product_id, embedding)
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
