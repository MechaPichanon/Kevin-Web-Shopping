#!/usr/bin/env python3
"""
compare_image_search_precision.py
Precision@1 / Precision@3 for the CLIP image-search pipeline, against a
small hand-labeled query set in image_search_fixtures/.

The query photos are the existing catalogue photos with a mild, deliberate
perturbation applied (downscale, slight rotation, gaussian blur, JPEG
re-encode — see image_search_fixtures/manifest.json's source_image_id) so
this measures near-duplicate recognition, not exact byte-identity, which
would trivially score 1.0 against the same file the embedding was computed
from. This is intentionally lighter-weight than the chatbot's intent/RAG
evals (compare_intent_f1.py) — a new pipeline being smoke-tested, not a
tuned one — and the catalogue only has 3 products at the time this was
written, so treat the resulting numbers as a harness check, not a
statistically meaningful benchmark. Re-generate the fixtures (see
image_search_fixtures/README.md) once the real catalogue is larger.

Run with the backend container up and reachable:
    pip install requests
    python backend/chatbot/tests/compare_image_search_precision.py
"""
import json
import sys
from pathlib import Path

import requests

# Windows consoles default to cp1252, which can't encode the ✓/✗/~ marks
# printed below — force UTF-8 stdout instead of falling back to ASCII.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

IMAGE_SEARCH_URL = "http://localhost:8000/image-search"
FIXTURES_DIR = Path(__file__).parent / "image_search_fixtures"
TOP_K = 3


def run_query(image_path: Path) -> list:
    with open(image_path, "rb") as f:
        resp = requests.post(IMAGE_SEARCH_URL, files={"image": (image_path.name, f, "image/jpeg")}, timeout=60)
    resp.raise_for_status()
    return [r["product_id"] for r in resp.json().get("results", [])]


def evaluate(manifest: list) -> dict:
    hits_at_1 = 0
    hits_at_k = 0
    rows = []

    for i, entry in enumerate(manifest, 1):
        image_path = FIXTURES_DIR / entry["file"]
        expected = entry["expected_product_id"]
        ranked = run_query(image_path)

        top1_hit = bool(ranked) and ranked[0] == expected
        topk_hit = expected in ranked[:TOP_K]

        hits_at_1 += int(top1_hit)
        hits_at_k += int(topk_hit)

        mark = "✓" if top1_hit else ("~" if topk_hit else "✗")
        print(f"  {mark} [{i:2d}/{len(manifest)}] {entry['file']:<16} expected={expected} "
              f"top{TOP_K}={ranked[:TOP_K]}")
        rows.append({"file": entry["file"], "expected": expected, "ranked": ranked[:TOP_K],
                      "top1_hit": top1_hit, f"top{TOP_K}_hit": topk_hit})

    n = len(manifest)
    return {
        "n": n,
        "precision_at_1": hits_at_1 / n if n else 0.0,
        f"precision_at_{TOP_K}": hits_at_k / n if n else 0.0,
        "rows": rows,
    }


def save_markdown(results: dict) -> None:
    out = Path(__file__).parent / "image_search_precision_results.md"
    lines = [
        "# Image Search Precision@k Results\n\n",
        f"Queries: {results['n']}\n\n",
        f"- Precision@1 = {results['precision_at_1']:.3f}\n",
        f"- Precision@{TOP_K} = {results[f'precision_at_{TOP_K}']:.3f}\n\n",
        "| File | Expected | Top-3 | Top-1 hit | Top-3 hit |\n",
        "|---|---|---|---|---|\n",
    ]
    for r in results["rows"]:
        lines.append(
            f"| {r['file']} | {r['expected']} | {', '.join(r['ranked'])} "
            f"| {'✓' if r['top1_hit'] else '✗'} | {'✓' if r[f'top{TOP_K}_hit'] else '✗'} |\n"
        )
    out.write_text("".join(lines), encoding="utf-8")
    print(f"\nSaved: {out}")


if __name__ == "__main__":
    manifest_path = FIXTURES_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"Missing {manifest_path} — see image_search_fixtures/README.md to generate it.")
        sys.exit(1)

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Running {len(manifest)} image-search queries against {IMAGE_SEARCH_URL} ...\n")
    results = evaluate(manifest)

    print(f"\nPrecision@1 = {results['precision_at_1']:.3f}")
    print(f"Precision@{TOP_K} = {results[f'precision_at_{TOP_K}']:.3f}")
    save_markdown(results)
