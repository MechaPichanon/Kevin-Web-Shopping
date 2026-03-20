import json
import math
import os
import threading
import hashlib
import re
import difflib
from typing import List, Dict
from pathlib import Path

from embeddings import EmbeddingError, get_ollama_embedding

BASE_DIR = Path(__file__).resolve().parent.parent
PRODUCTS_PATH = BASE_DIR / "data" / "products.json"
EMBEDDINGS_CACHE_PATH = BASE_DIR / "data" / "products_embeddings.json"

_INDEX_LOCK = threading.Lock()
_VECTOR_INDEX = None


def load_products() -> List[Dict]:
    with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _product_to_text(product: Dict) -> str:
    sizes = ", ".join(product.get("sizes", []) or [])
    colors = ", ".join(product.get("colors", []) or [])
    return (
        f"Name: {product.get('name','')}\n"
        f"Category: {product.get('category','')}\n"
        f"Price: {product.get('price','')} {product.get('currency','')}\n"
        f"Sizes: {sizes}\n"
        f"Colors: {colors}\n"
        f"Material: {product.get('material','')}\n"
        f"Description: {product.get('description','')}\n"
    ).strip()


def _normalize_text(text: str) -> str:
    t = (text or "").lower()
    t = t.replace("t-shirt", "tshirt").replace("t shirt", "tshirt")
    return t


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", _normalize_text(text))


def _build_vocab_and_tokens(products: List[Dict]) -> Dict:
    product_tokens = {}
    vocab = set()

    for product in products:
        product_id = product.get("id")
        if not isinstance(product_id, str) or not product_id:
            continue

        parts = [
            product.get("name", ""),
            product.get("category", ""),
            product.get("material", ""),
            product.get("description", ""),
            " ".join(product.get("colors", []) or []),
            " ".join(product.get("sizes", []) or []),
        ]
        tokens = []
        for part in parts:
            tokens.extend(_tokenize(str(part)))

        token_set = set(tokens)
        product_tokens[product_id] = token_set
        vocab.update(token_set)

    return {"product_tokens": product_tokens, "vocab": sorted(vocab)}


def _autocorrect_tokens(tokens: List[str], vocab: List[str]) -> List[str]:
    """
    Very small, local autocorrect: replace unknown tokens with the closest vocab token.
    Keeps threshold high to avoid incorrect corrections.
    """
    if not tokens or not vocab:
        return tokens

    common = {
        "shrit": "shirt",
        "shrits": "shirts",
        "cottn": "cotton",
        "coton": "cotton",
        "jaket": "jacket",
        "jakket": "jacket",
        "panst": "pants",
        "pnts": "pants",
        "tshrit": "tshirt",
        "tshir": "tshirt",
    }
    domain_relaxed = {"shirt", "pants", "jacket", "tshirt", "cotton", "polyester"}

    vocab_set = set(vocab)
    corrected = []
    for token in tokens:
        if token in common and common[token] in vocab_set:
            corrected.append(common[token])
            continue

        if token in vocab_set or len(token) < 4:
            corrected.append(token)
            continue

        best = token
        best_ratio = 0.0
        for v in vocab:
            if abs(len(v) - len(token)) > 3:
                continue
            ratio = difflib.SequenceMatcher(a=token, b=v).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best = v

        threshold = 0.90
        if best in domain_relaxed:
            threshold = 0.84
        corrected.append(best if best_ratio >= threshold else token)

    return corrected


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    denom = math.sqrt(norm_a) * math.sqrt(norm_b)
    return (dot / denom) if denom else 0.0


def _products_hash(products: List[Dict]) -> str:
    payload = json.dumps(products, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _load_cache() -> Dict:
    if not EMBEDDINGS_CACHE_PATH.exists():
        return {}
    try:
        with open(EMBEDDINGS_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: Dict) -> None:
    EMBEDDINGS_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(EMBEDDINGS_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)


def _build_vector_index(products: List[Dict]) -> Dict:
    """
    Returns dict with:
      - product_by_id: {id: product}
      - vector_by_id: {id: [floats]}
      - embed_model: env OLLAMA_EMBED_MODEL at build time
      - products_hash: sha256 over products json
    """
    embed_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    products_digest = _products_hash(products)
    cache = _load_cache()

    cached_meta = cache.get("meta") if isinstance(cache, dict) else None
    cached_vectors = cache.get("vectors") if isinstance(cache, dict) else None
    if (
        isinstance(cached_meta, dict)
        and isinstance(cached_vectors, dict)
        and cached_meta.get("embed_model") == embed_model
        and cached_meta.get("products_hash") == products_digest
    ):
        vector_by_id = {}
        for product in products:
            product_id = product.get("id")
            vec = cached_vectors.get(product_id)
            if isinstance(product_id, str) and isinstance(vec, list) and vec:
                vector_by_id[product_id] = [float(x) for x in vec]
        if len(vector_by_id) == len(products):
            vocab_and_tokens = _build_vocab_and_tokens(products)
            return {
                "product_by_id": {p["id"]: p for p in products if "id" in p},
                "vector_by_id": vector_by_id,
                "product_tokens": vocab_and_tokens["product_tokens"],
                "vocab": vocab_and_tokens["vocab"],
                "embed_model": embed_model,
                "products_hash": products_digest,
            }

    vector_by_id = {}
    for product in products:
        product_id = product.get("id")
        if not isinstance(product_id, str) or not product_id:
            continue
        text = _product_to_text(product)
        vector_by_id[product_id] = get_ollama_embedding(text)

    vocab_and_tokens = _build_vocab_and_tokens(products)

    _save_cache(
        {
            "meta": {"embed_model": embed_model, "products_hash": products_digest},
            "vectors": vector_by_id,
        }
    )

    return {
        "product_by_id": {p["id"]: p for p in products if "id" in p},
        "vector_by_id": vector_by_id,
        "product_tokens": vocab_and_tokens["product_tokens"],
        "vocab": vocab_and_tokens["vocab"],
        "embed_model": embed_model,
        "products_hash": products_digest,
    }


def _get_index() -> Dict:
    global _VECTOR_INDEX
    if _VECTOR_INDEX is not None:
        return _VECTOR_INDEX

    with _INDEX_LOCK:
        if _VECTOR_INDEX is not None:
            return _VECTOR_INDEX
        products = load_products()
        _VECTOR_INDEX = _build_vector_index(products)
        return _VECTOR_INDEX


def keyword_retrieve_products(query: str) -> List[Dict]:
    query_l = (query or "").lower()
    products = load_products()

    matched = []

    for product in products:
        name = str(product.get("name", "")).lower()
        category = str(product.get("category", "")).lower()

        if (name and name in query_l) or (category and category in query_l):
            matched.append(product)

    return matched


def retrieve_products(query: str) -> List[Dict]:
    """
    Vector-based retrieval (cosine similarity on Ollama embeddings).

    Env:
      - OLLAMA_BASE_URL (default http://localhost:11434)
      - OLLAMA_EMBED_MODEL (default nomic-embed-text)
      - RAG_TOP_K (default 3)
      - RAG_MIN_SCORE (default 0.20)

    Falls back to keyword retrieval if embeddings fail.
    """
    top_k = int(os.getenv("RAG_TOP_K", "3"))
    min_score = float(os.getenv("RAG_MIN_SCORE", "0.20"))

    try:
        index = _get_index()
        query_tokens = _tokenize(query)
        corrected_tokens = _autocorrect_tokens(query_tokens, index.get("vocab", []))
        corrected_query = " ".join(corrected_tokens).strip() or (query or "")
        query_vec = get_ollama_embedding(corrected_query)
    except (EmbeddingError, OSError, json.JSONDecodeError):
        return keyword_retrieve_products(query)

    query_token_set = set(corrected_tokens)
    query_type_tokens = query_token_set.intersection({"shirt", "pants", "jacket", "tshirt"})
    type_targets = set()
    for t in query_type_tokens:
        if t == "shirt":
            type_targets.update({"shirt", "tshirt"})
        else:
            type_targets.add(t)

    scored = []
    best_vec = 0.0
    best_lex = 0.0
    for product_id, product_vec in index["vector_by_id"].items():
        vec_score = _cosine_similarity(query_vec, product_vec)
        best_vec = max(best_vec, vec_score)

        product_token_set = index.get("product_tokens", {}).get(product_id, set())
        lex_score = 0.0
        if query_token_set:
            overlap = len(query_token_set.intersection(product_token_set))
            lex_score = overlap / max(1, len(query_token_set))
        best_lex = max(best_lex, lex_score)

        combined = (0.78 * vec_score) + (0.22 * lex_score)
        matches_type = bool(type_targets.intersection(product_token_set)) if type_targets else True
        if type_targets and not matches_type:
            combined *= 0.25

        if combined >= min_score:
            scored.append((combined, matches_type, product_id))

    if best_lex == 0.0 and best_vec < 0.55:
        return []

    scored.sort(reverse=True, key=lambda x: x[0])
    results = []

    if type_targets:
        for _, matches_type, product_id in scored:
            if not matches_type:
                continue
            product = index["product_by_id"].get(product_id)
            if product:
                results.append(product)
                if len(results) >= max(1, top_k):
                    return results
        if results:
            return results

    for _, _, product_id in scored:
        product = index["product_by_id"].get(product_id)
        if product and product not in results:
            results.append(product)
            if len(results) >= max(1, top_k):
                break

    return results
