"""
retrieval.py — Hybrid vector + lexical product retrieval for the chatbot RAG pipeline.

Data source (priority order):
  1. PostgreSQL  — products + variants tables (single source of truth)
  2. products.json — fallback when DATABASE_URL is not set or DB is unreachable

Embedding source (priority order):
  1. product_chunks.embedding in PostgreSQL  (populated by backfill_chunk_embeddings.js)
  2. Ollama bge-m3 on-the-fly               (fallback for any product with NULL embedding)

Hybrid score:
  combined = (0.78 × cosine_similarity) + (0.22 × token_overlap_ratio)
  Type mismatch penalty: ×0.25

products.json and products_embeddings.json are no longer read at runtime.
They are only used by import_products.js (seed tool) and are kept on disk
for the JSON fallback path in development environments without DATABASE_URL.
"""

import json
import math
import os
import threading
import hashlib
import re
import difflib
import logging
from typing import List, Dict, Optional
from pathlib import Path

try:
    from .embeddings import EmbeddingError, get_ollama_embedding
except ImportError:
    from embeddings import EmbeddingError, get_ollama_embedding

try:
    from .db import get_conn, release_conn
except ImportError:
    from db import get_conn, release_conn

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
PRODUCTS_PATH = BASE_DIR / "data" / "products.json"

# Kept as a path constant for backward compatibility with demo_retrieval.py
# which imports and may call Path(EMBEDDINGS_CACHE_PATH).unlink().
# No longer read or written by this module.
EMBEDDINGS_CACHE_PATH = BASE_DIR / "data" / "products_embeddings.json"

_INDEX_LOCK = threading.Lock()
_VECTOR_INDEX = None


# ──────────────────────────────────────────────────────────────
# Product helpers  (handle both old and new JSON/DB format)
# ──────────────────────────────────────────────────────────────

def _product_id(product: Dict) -> str:
    """Return the product's identifier regardless of format."""
    return str(product.get("product_id") or product.get("id") or "")


def _product_name(product: Dict) -> str:
    return str(product.get("product_name") or product.get("name") or "")


def _product_to_text(product: Dict) -> str:
    """
    Build a plain-text representation of a product for embedding.
    Aggregates variant info (sizes, colors, price range) from the new format.
    Falls back gracefully to the old flat format.
    """
    name     = _product_name(product)
    category = product.get("category", "")
    sub_cat  = product.get("sub_category", "")
    desc     = product.get("description", "")

    variants: List[Dict] = product.get("variants", []) or []

    if variants:
        sizes   = sorted(set(v.get("size",   "") for v in variants if v.get("size")))
        colors  = sorted(set(v.get("color",  "") for v in variants if v.get("color")))
        sleeves = sorted(set(v.get("sleeve", "") for v in variants if v.get("sleeve")))
        collars = sorted(set(v.get("collar", "") for v in variants if v.get("collar")))
        prices  = [float(v["price"]) for v in variants if v.get("price") is not None]

        price_str = ""
        if prices:
            lo, hi = min(prices), max(prices)
            price_str = f"{lo:.0f} THB" if lo == hi else f"{lo:.0f}–{hi:.0f} THB"

        lines = [f"Name: {name}", f"Category: {category}"]
        if sub_cat:   lines.append(f"Sub-category: {sub_cat}")
        if price_str: lines.append(f"Price: {price_str}")
        if sizes:     lines.append(f"Sizes: {', '.join(sizes)}")
        if colors:    lines.append(f"Colors: {', '.join(colors)}")
        if sleeves:   lines.append(f"Sleeve: {', '.join(sleeves)}")
        if collars:   lines.append(f"Collar: {', '.join(collars)}")
        if desc:      lines.append(f"Description: {desc}")
        return "\n".join(lines).strip()

    # ── Legacy flat format ──────────────────────────────────────
    sizes_list  = product.get("sizes",  []) or []
    colors_list = product.get("colors", []) or []
    price       = product.get("price",    "")
    currency    = product.get("currency", "THB")
    material    = product.get("material", "")
    price_str   = f"{price} {currency}" if price else ""

    return (
        f"Name: {name}\n"
        f"Category: {category}\n"
        + (f"Price: {price_str}\n"                              if price_str        else "")
        + (f"Sizes: {', '.join(str(s) for s in sizes_list)}\n" if sizes_list       else "")
        + (f"Colors: {', '.join(str(c) for c in colors_list)}\n" if colors_list    else "")
        + (f"Material: {material}\n"                            if material         else "")
        + (f"Description: {desc}\n"                             if desc             else "")
    ).strip()


# ──────────────────────────────────────────────────────────────
# Text normalisation & tokenisation
# ──────────────────────────────────────────────────────────────

def _normalize_text(text: str) -> str:
    t = (text or "").lower()
    t = t.replace("t-shirt", "tshirt").replace("t shirt", "tshirt")
    return t


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", _normalize_text(text))


def _build_vocab_and_tokens(products: List[Dict]) -> Dict:
    product_tokens: Dict[str, set] = {}
    vocab: set = set()

    for product in products:
        pid = _product_id(product)
        if not pid:
            continue

        variants: List[Dict] = product.get("variants", []) or []

        parts = [
            _product_name(product),
            product.get("category",     ""),
            product.get("sub_category", ""),
            product.get("description",  ""),
            product.get("material",     ""),
            " ".join(product.get("colors", []) or []),
            " ".join(product.get("sizes",  []) or []),
        ]
        for v in variants:
            parts.extend([
                v.get("color",   ""),
                v.get("size",    ""),
                v.get("pattern", ""),
                v.get("sleeve",  ""),
                v.get("collar",  ""),
            ])

        tokens: List[str] = []
        for part in parts:
            if part:
                tokens.extend(_tokenize(str(part)))

        token_set = set(tokens)
        product_tokens[pid] = token_set
        vocab.update(token_set)

    return {"product_tokens": product_tokens, "vocab": sorted(vocab)}


# ──────────────────────────────────────────────────────────────
# Autocorrect
# ──────────────────────────────────────────────────────────────

def _autocorrect_tokens(tokens: List[str], vocab: List[str]) -> List[str]:
    if not tokens or not vocab:
        return tokens

    common = {
        "shrit": "shirt",  "shrits": "shirts",
        "cottn": "cotton", "coton": "cotton",
        "jaket": "jacket", "jakket": "jacket",
        "panst": "pants",  "pnts": "pants",
        "tshrit": "tshirt","tshir": "tshirt",
    }
    domain_relaxed = {"shirt", "pants", "jacket", "tshirt", "cotton", "polyester"}

    vocab_set = set(vocab)
    corrected: List[str] = []

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

        threshold = 0.90 if best not in domain_relaxed else 0.84
        corrected.append(best if best_ratio >= threshold else token)

    return corrected


# ──────────────────────────────────────────────────────────────
# Cosine similarity
# ──────────────────────────────────────────────────────────────

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = norm_a = norm_b = 0.0
    for x, y in zip(a, b):
        dot    += x * y
        norm_a += x * x
        norm_b += y * y
    denom = math.sqrt(norm_a) * math.sqrt(norm_b)
    return (dot / denom) if denom else 0.0


# ──────────────────────────────────────────────────────────────
# JSON-fallback hash  (used when DATABASE_URL is not set)
# ──────────────────────────────────────────────────────────────

def _products_hash(products: List[Dict]) -> str:
    payload = json.dumps(products, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ──────────────────────────────────────────────────────────────
# DB watermark  (replaces JSON hash as cache-invalidation signal)
# ──────────────────────────────────────────────────────────────

def _get_db_watermark() -> Optional[str]:
    """
    Returns MAX(products.updated_at) as an ISO string — the lightweight
    signal used to decide whether the in-memory index needs rebuilding.
    Returns None when the DB is not available (caller falls back to JSON hash).
    """
    conn = get_conn()
    if conn is None:
        return None
    try:
        cur = conn.cursor()
        cur.execute("SELECT MAX(updated_at) FROM products WHERE is_active = TRUE")
        row = cur.fetchone()
        if row and row[0]:
            return row[0].isoformat()
        return "empty"
    except Exception as exc:
        logger.warning("Could not read DB watermark: %s", exc)
        return None
    finally:
        release_conn(conn)


# ──────────────────────────────────────────────────────────────
# Load products — PostgreSQL first, JSON fallback
# ──────────────────────────────────────────────────────────────

def _load_products_from_json() -> List[Dict]:
    """Emergency / local-dev fallback: read products.json."""
    with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)
    # Inject id alias so main.py's p["id"] doesn't KeyError
    for p in products:
        if "id" not in p and "product_id" in p:
            p["id"] = p["product_id"]
    return products


def load_products() -> List[Dict]:
    """
    Load active products + variants from PostgreSQL.
    Falls back to reading products.json when:
      - DATABASE_URL is not set
      - DB connection fails
      - DB returns 0 active products
    """
    conn = get_conn()
    if conn is None:
        logger.info("No DB connection; loading products from %s", PRODUCTS_PATH)
        return _load_products_from_json()

    try:
        cur = conn.cursor()

        # ── Fetch all active products ──────────────────────────────────────────
        cur.execute("""
            SELECT
                p.product_id,
                p.product_name,
                p.category,
                p.sub_category,
                p.description
            FROM products p
            WHERE p.is_active = TRUE
            ORDER BY p.product_id
        """)
        product_rows = cur.fetchall()

        if not product_rows:
            logger.warning("No active products found in DB — falling back to products.json")
            return _load_products_from_json()

        product_ids = [row[0] for row in product_rows]

        # ── Fetch all active variants ──────────────────────────────────────────
        cur.execute("""
            SELECT
                v.product_id,
                v.variant_id,
                v.size,
                v.color,
                v.pattern,
                v.chest_min,
                v.chest_max,
                v.waist_min,
                v.waist_max,
                v.sleeve,
                v.collar,
                v.price,
                v.cost_price,
                v.stock
            FROM variants v
            WHERE v.product_id = ANY(%s)
              AND v.is_active = TRUE
            ORDER BY v.product_id, v.variant_id
        """, (product_ids,))
        variant_rows = cur.fetchall()

        # ── Group variants by product_id ───────────────────────────────────────
        variants_by_product: Dict[str, List[Dict]] = {}
        for row in variant_rows:
            pid = row[0]
            if pid not in variants_by_product:
                variants_by_product[pid] = []
            variants_by_product[pid].append({
                "variant_id": row[1],
                "size":       row[2],
                "color":      row[3],
                "pattern":    row[4],
                "chest_min":  float(row[5])  if row[5]  is not None else None,
                "chest_max":  float(row[6])  if row[6]  is not None else None,
                "waist_min":  float(row[7])  if row[7]  is not None else None,
                "waist_max":  float(row[8])  if row[8]  is not None else None,
                "sleeve":     row[9],
                "collar":     row[10],
                "price":      float(row[11]) if row[11] is not None else None,
                "cost_price": float(row[12]) if row[12] is not None else None,
                "stock":      row[13],
            })

        # ── Assemble product dicts ─────────────────────────────────────────────
        products = []
        for row in product_rows:
            pid = row[0]
            products.append({
                "product_id":   pid,
                "id":           pid,    # alias — main.py accesses p["id"]
                "product_name": row[1],
                "category":     row[2],
                "sub_category": row[3],
                "description":  row[4],
                "variants":     variants_by_product.get(pid, []),
            })

        logger.info("Loaded %d product(s) from PostgreSQL", len(products))
        return products

    except Exception as exc:
        logger.error(
            "DB error in load_products(): %s — falling back to products.json", exc
        )
        return _load_products_from_json()
    finally:
        release_conn(conn)


# ──────────────────────────────────────────────────────────────
# Embedding loading — DB first, Ollama fallback
# ──────────────────────────────────────────────────────────────

def _load_embeddings_from_db(
    products: List[Dict],
    embed_model: str,
) -> Dict[str, List[float]]:
    """
    Read pre-computed embeddings from product_chunks.embedding.

    Strategy:
      - embedding IS NOT NULL AND embed_model matches → use stored vector (free)
      - Otherwise (NULL or model mismatch)            → call Ollama on-the-fly

    Does NOT write back to DB — backfill_chunk_embeddings.js owns DB embeddings.
    """
    vector_by_id: Dict[str, List[float]] = {}
    conn = get_conn()

    if conn is not None:
        try:
            product_ids = [_product_id(p) for p in products if _product_id(p)]
            cur = conn.cursor()
            # Cast embedding → text because psycopg2-binary (without the pgvector
            # Python package) cannot deserialise the vector type natively.
            # The text form is "[f1,f2,...,f1024]" and is fast to parse.
            cur.execute("""
                SELECT
                    pc.product_id,
                    pc.embedding::text,
                    pc.embed_model
                FROM product_chunks pc
                WHERE pc.product_id = ANY(%s)
                  AND pc.embedding IS NOT NULL
                  AND pc.chunk_index = 0
            """, (product_ids,))
            rows = cur.fetchall()

            for pid, vec_str, db_model in rows:
                if db_model != embed_model:
                    # Different model — skip; Ollama will regenerate below
                    continue
                try:
                    vec = [float(x) for x in vec_str.strip("[]").split(",")]
                    if vec:
                        vector_by_id[pid] = vec
                except (ValueError, AttributeError) as parse_err:
                    logger.warning(
                        "Failed to parse stored embedding for %s: %s", pid, parse_err
                    )

            logger.info(
                "Loaded %d/%d embedding(s) from DB (model=%s)",
                len(vector_by_id), len(product_ids), embed_model,
            )
        except Exception as exc:
            logger.warning(
                "DB embedding read failed: %s — will use Ollama for all products", exc
            )
        finally:
            release_conn(conn)

    # ── Ollama for any product with no/mismatched DB embedding ────────────────
    missing = [p for p in products if _product_id(p) not in vector_by_id]
    if missing:
        logger.info(
            "Calling Ollama for %d product(s) with missing/mismatched embedding",
            len(missing),
        )
    for product in missing:
        pid = _product_id(product)
        if not pid:
            continue
        try:
            text = _product_to_text(product)
            vector_by_id[pid] = get_ollama_embedding(text)
        except EmbeddingError as exc:
            logger.error("Ollama embedding failed for %s: %s", pid, exc)

    return vector_by_id


# ──────────────────────────────────────────────────────────────
# Vector index  (in-memory, rebuilt when DB watermark changes)
# ──────────────────────────────────────────────────────────────

def _build_vector_index(products: List[Dict]) -> Dict:
    """
    Build the in-memory index dict used by retrieve_products().
    Loads embeddings from DB (product_chunks.embedding), falls back to Ollama.
    """
    embed_model  = os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")
    vector_by_id = _load_embeddings_from_db(products, embed_model)
    vt           = _build_vocab_and_tokens(products)

    # Watermark: DB timestamp if available, SHA-256 of JSON otherwise
    watermark = _get_db_watermark() or _products_hash(products)

    return {
        "product_by_id":  {_product_id(p): p for p in products if _product_id(p)},
        "vector_by_id":   vector_by_id,
        "product_tokens": vt["product_tokens"],
        "vocab":          vt["vocab"],
        "embed_model":    embed_model,
        "products_hash":  watermark,
    }


def _get_index() -> Dict:
    """
    Return the cached in-memory index, rebuilding if the DB watermark changed.
    Lock is held for the full check-and-rebuild to prevent concurrent rebuilds.
    """
    global _VECTOR_INDEX
    with _INDEX_LOCK:
        if _VECTOR_INDEX is not None:
            current_watermark = _get_db_watermark()
            if (
                current_watermark is not None
                and current_watermark != _VECTOR_INDEX.get("products_hash")
            ):
                logger.info(
                    "DB watermark changed (%s → %s) — rebuilding vector index",
                    _VECTOR_INDEX.get("products_hash"),
                    current_watermark,
                )
                _VECTOR_INDEX = None   # fall through to rebuild
            else:
                return _VECTOR_INDEX

        products   = load_products()
        _VECTOR_INDEX = _build_vector_index(products)
        return _VECTOR_INDEX


# ──────────────────────────────────────────────────────────────
# Public retrieval API
# ──────────────────────────────────────────────────────────────

def keyword_retrieve_products(query: str) -> List[Dict]:
    """Fallback keyword retrieval when embeddings are unavailable."""
    query_l = (query or "").lower()
    try:
        products = load_products()
    except OSError:
        return []
    matched = []
    for product in products:
        name     = _product_name(product).lower()
        category = str(product.get("category", "")).lower()
        if (name and name in query_l) or (category and category in query_l):
            matched.append(product)
    return matched


def retrieve_products(query: str) -> List[Dict]:
    """
    Hybrid vector + lexical retrieval.

    Env:
      OLLAMA_BASE_URL    (default http://localhost:11434)
      OLLAMA_EMBED_MODEL (default bge-m3)
      RAG_TOP_K          (default 3)
      RAG_MIN_SCORE      (default 0.20)

    Falls back to keyword retrieval if embeddings are unavailable.
    """
    top_k     = int(os.getenv("RAG_TOP_K",     "3"))
    min_score = float(os.getenv("RAG_MIN_SCORE", "0.20"))

    try:
        index            = _get_index()
        query_tokens     = _tokenize(query)
        corrected_tokens = _autocorrect_tokens(query_tokens, index.get("vocab", []))
        corrected_query  = " ".join(corrected_tokens).strip() or (query or "")
        query_vec        = get_ollama_embedding(corrected_query)
    except (EmbeddingError, OSError, json.JSONDecodeError):
        return keyword_retrieve_products(query)

    query_token_set   = set(corrected_tokens)
    query_type_tokens = query_token_set.intersection({"shirt", "pants", "jacket", "tshirt"})

    type_targets: set = set()
    for t in query_type_tokens:
        if t == "shirt":
            type_targets.update({"shirt", "tshirt"})
        else:
            type_targets.add(t)

    scored = []
    best_vec = 0.0
    best_lex = 0.0

    for pid, product_vec in index["vector_by_id"].items():
        vec_score = _cosine_similarity(query_vec, product_vec)
        best_vec  = max(best_vec, vec_score)

        product_token_set = index.get("product_tokens", {}).get(pid, set())
        lex_score = 0.0
        if query_token_set:
            overlap   = len(query_token_set.intersection(product_token_set))
            lex_score = overlap / max(1, len(query_token_set))
        best_lex = max(best_lex, lex_score)

        combined     = (0.78 * vec_score) + (0.22 * lex_score)
        matches_type = bool(type_targets.intersection(product_token_set)) if type_targets else True
        if type_targets and not matches_type:
            combined *= 0.25

        if combined >= min_score:
            scored.append((combined, matches_type, pid))

    if best_lex == 0.0 and best_vec < 0.55:
        return []

    scored.sort(reverse=True, key=lambda x: x[0])
    results: List[Dict] = []

    if type_targets:
        for _, matches_type, pid in scored:
            if not matches_type:
                continue
            product = index["product_by_id"].get(pid)
            if product:
                results.append(product)
                if len(results) >= max(1, top_k):
                    return results
        if results:
            return results

    for _, _, pid in scored:
        product = index["product_by_id"].get(pid)
        if product and product not in results:
            results.append(product)
            if len(results) >= max(1, top_k):
                break

    return results
