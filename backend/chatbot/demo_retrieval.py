import argparse
import os
from pathlib import Path

from retrieval import EMBEDDINGS_CACHE_PATH, retrieve_products


def main() -> int:
    parser = argparse.ArgumentParser(description="Demo vector-RAG product retrieval")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Delete embedding cache before running",
    )
    parser.add_argument(
        "query",
        nargs="*",
        help="Query text (if omitted, runs a few sample queries)",
    )
    args = parser.parse_args()

    if args.rebuild:
        try:
            Path(EMBEDDINGS_CACHE_PATH).unlink(missing_ok=True)
        except OSError:
            pass

    queries = (
        [" ".join(args.query)]
        if args.query
        else [
            "show me a cotton shirt",
            "pants under 600 thb",
            "compare slim fit shirt vs basic cotton shirt",
        ]
    )

    print("Config:")
    print(f"  OLLAMA_BASE_URL={os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}")
    print(f"  OLLAMA_EMBED_MODEL={os.getenv('OLLAMA_EMBED_MODEL', 'nomic-embed-text')}")
    print(f"  RAG_TOP_K={os.getenv('RAG_TOP_K', '3')}")
    print(f"  RAG_MIN_SCORE={os.getenv('RAG_MIN_SCORE', '0.20')}")
    print()

    for q in queries:
        print(f"Query: {q}")
        products = retrieve_products(q)
        if not products:
            print("  (no results)")
            print()
            continue
        for p in products:
            print(f"  - {p.get('id')} | {p.get('name')} | {p.get('price')} {p.get('currency')}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

