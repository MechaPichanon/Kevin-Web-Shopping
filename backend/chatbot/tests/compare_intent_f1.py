#!/usr/bin/env python3
"""
compare_intent_f1.py
Compares intent classification F1 between:
  System A: old pure rule-based (git HEAD logic, inlined)
  System B: new hybrid rules+LLM (current intent.py, temperature=0 for reproducibility)

Run from any directory:
    pip install scikit-learn scipy
    python backend/chatbot/tests/compare_intent_f1.py
Requires Ollama running on port 11434 for System B only.
"""
import json
import re
import sys
from enum import Enum
from pathlib import Path

CHATBOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CHATBOT_DIR))

try:
    from sklearn.metrics import classification_report, f1_score
    from scipy.stats import chi2 as _chi2
except ImportError:
    print("Missing deps — run: pip install scikit-learn scipy")
    sys.exit(1)

import requests
import intent as _hmod  # current hybrid module


# ── temperature-0 patch so LLM runs are reproducible ─────────────────────────
def _llm_t0(message: str):
    try:
        resp = requests.post(
            f"{_hmod.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": _hmod.OLLAMA_CHAT_MODEL,
                "prompt": _hmod._CLASSIFICATION_PROMPT.format(message=message),
                "stream": False,
                "options": {"temperature": 0},
            },
            timeout=20,
        )
        label = resp.json().get("response", "").strip().lower().split()[0]
        label = re.sub(r"[^a-z_]", "", label)
        return _hmod._INTENT_LABELS.get(label, _hmod.Intent.PRODUCT_INFO)
    except Exception:
        return _hmod.Intent.PRODUCT_INFO

_hmod._llm_classify_intent = _llm_t0  # monkey-patch before any calls


# ── System A: old pure rule-based (inlined from git HEAD) ────────────────────
class _OldIntent(str, Enum):
    PRODUCT_INFO    = "product_info"
    PRODUCT_COMPARE = "product_compare"
    SIZE_GUIDE      = "size_guide"
    STOCK_CHECK     = "stock_check"
    STORE_POLICY    = "store_policy"
    DISCOUNT_QUERY  = "discount_query"
    OUT_OF_SCOPE    = "out_of_scope"

_OLD_MAP = {
    "product_info":    "product_info",
    "product_compare": "product_info",   # PRODUCT_COMPARE merged into product_info
    "size_guide":      "size_guide",
    "stock_check":     "stock_check",
    "store_policy":    "store_policy",
    "discount_query":  "store_policy",   # DISCOUNT_QUERY merged into store_policy
    "out_of_scope":    "out_of_scope",
}


def _old_raw(message: str) -> _OldIntent:
    text = (message or "").strip().lower()
    if not text:
        return _OldIntent.OUT_OF_SCOPE

    text = text.replace("t-shirt", "tshirt").replace("t shirt", "tshirt")
    tokens = set(re.findall(r"[a-z0-9']+", text))

    product_types = [
        "products", "product", "shirt", "shirts", "tshirt", "tshirts",
        "tee", "tees", "pants", "trousers", "jeans",
        "jacket", "jackets", "hoodie", "hoodies",
    ]
    non_clothing_tokens = {
        "tv", "tvs", "television", "televisions",
        "laptop", "laptops", "phone", "phones", "smartphone", "smartphones",
    }
    if tokens.intersection(non_clothing_tokens) and not tokens.intersection(product_types):
        return _OldIntent.OUT_OF_SCOPE

    service_patterns = [r"\border\s+status\b", r"\btrack\s+(my\s+)?order\b"]
    if any(re.search(p, text) for p in service_patterns):
        return _OldIntent.OUT_OF_SCOPE

    policy_keywords = [
        "shipping", "delivery", "deliver", "ship", "how long",
        "return", "refund", "exchange", "cancel",
        "payment", "pay", "credit card", "cod", "cash on delivery", "promptpay",
    ]
    thai_policy = ["ส่ง", "จัดส่ง", "คืนสินค้า", "คืนเงิน", "จ่าย", "ชำระ"]
    if any(k in text for k in policy_keywords) or any(t in text for t in thai_policy):
        return _OldIntent.STORE_POLICY

    discount_keywords = ["discount", "promo", "promotion", "coupon", "code", "deal", "sale", "offer"]
    thai_discount = ["โปรโมชัน", "ส่วนลด", "โค้ด", "ลดราคา"]
    if any(k in text for k in discount_keywords) or any(t in text for t in thai_discount):
        return _OldIntent.DISCOUNT_QUERY

    size_guide_patterns = [
        r"\bsize\s+guide\b", r"\bwhat\s+size\b", r"\bwhich\s+size\b",
        r"\bfit(s)?\s+me\b", r"\bmeasure", r"\d+\s*cm\b",
    ]
    thai_size = ["ไซส์ไหน", "วัดตัว", "รอบอก", "รอบเอว"]
    if any(re.search(p, text) for p in size_guide_patterns) or any(t in text for t in thai_size):
        return _OldIntent.SIZE_GUIDE

    single_kw = {
        "price", "cost", "size", "sizes", "color", "colors",
        "material", "feature", "features", "available", "stock", "detail",
    }
    stock_keywords = ["in stock", "out of stock", "left", "have size", "have colDor"]
    thai_stock = ["มีไหม", "เหลือไหม", "มีของ", "หมดไหม"]
    _pt_set = {"shirt", "pants", "jacket", "tshirt"}
    if (any(k in text for k in stock_keywords) or any(t in text for t in thai_stock)) and (
        tokens.intersection(_pt_set) or tokens.intersection(single_kw)
    ):
        return _OldIntent.STOCK_CHECK

    compare_kw = [
        "compare", "compair", "difference", "better than", "versus",
        "which is better", "whats the difference", "what's the difference",
    ]
    if re.search(r"(?<![a-z0-9])v\.?s\.?(?![a-z0-9])", text) or any(w in text for w in compare_kw):
        return _OldIntent.PRODUCT_COMPARE

    if tokens.intersection(single_kw) or any(p in text for p in ["how much", "how expensive"]):
        return _OldIntent.PRODUCT_INFO

    if tokens.intersection(product_types):
        return _OldIntent.PRODUCT_INFO

    shopping_phrases = [
        "show me", "find", "search", "looking for", "do you have", "have any",
        "sell", "buy", "order", "recommend", "suggest",
        "under", "below", "less than", "cheaper than",
    ]
    has_budget = bool(re.search(r"\d", text)) and any(
        p in text for p in ["under", "below", "less than", "cheaper than"]
    )
    if any(p in text for p in shopping_phrases) and (
        has_budget or tokens.intersection(single_kw) or tokens.intersection(product_types)
    ):
        return _OldIntent.PRODUCT_INFO

    thai_product_tokens = ["เสื้อ", "เสื้อยืด", "กางเกง", "แจ็กเก็ต", "ราคา", "ไซส์", "ขนาด"]
    if any(t in text for t in thai_product_tokens):
        return _OldIntent.PRODUCT_INFO

    return _OldIntent.OUT_OF_SCOPE


def old_detect_intent(message: str) -> str:
    return _OLD_MAP[_old_raw(message).value]


def hybrid_detect_intent(message: str) -> str:
    return _hmod.detect_intent(message).value


# ── evaluation ────────────────────────────────────────────────────────────────
LABELS = ["product_info", "size_guide", "stock_check", "store_policy", "out_of_scope"]


def run_classifier(data, fn, tag):
    preds = []
    for i, d in enumerate(data, 1):
        pred = fn(d["text"])
        preds.append(pred)
        ok = "✓" if pred == d["label"] else "✗"
        print(f"  {ok} [{tag} {i:3d}/{len(data)}] {pred:<15} exp={d['label']:<15} | {d['text'][:50]}")
    return preds


def mcnemar_p(y_true, pa, pb):
    b = sum(1 for t, a, b_ in zip(y_true, pa, pb) if a == t and b_ != t)
    c = sum(1 for t, a, b_ in zip(y_true, pa, pb) if a != t and b_ == t)
    if b + c == 0:
        return 1.0
    stat = (abs(b - c) - 1) ** 2 / (b + c)
    return float(1 - _chi2.cdf(stat, df=1))


def evaluate_subset(name, data):
    print(f"\n{'#' * 65}")
    print(f"  {name}  ({len(data)} questions)")
    print(f"{'#' * 65}")

    print("\n[System A — Rule-based]")
    pa = run_classifier(data, old_detect_intent, "A")

    print("\n[System B — Hybrid LLM]")
    pb = run_classifier(data, hybrid_detect_intent, "B")

    y = [d["label"] for d in data]
    ma = f1_score(y, pa, labels=LABELS, average="macro", zero_division=0)
    mb = f1_score(y, pb, labels=LABELS, average="macro", zero_division=0)
    p  = mcnemar_p(y, pa, pb)

    ra = classification_report(y, pa, labels=LABELS, zero_division=0)
    rb = classification_report(y, pb, labels=LABELS, zero_division=0)

    sep = "=" * 50
    print(f"\n{sep}  System A (Rule-based) — {name}  {sep}")
    print(f"Macro F1 = {ma:.3f}\n{ra}")
    print(f"{sep}  System B (Hybrid LLM) — {name}  {sep}")
    print(f"Macro F1 = {mb:.3f}\n{rb}")
    print(f"Δ Macro F1 = {mb - ma:+.3f}   McNemar p = {p:.4f}"
          f"  {'← significant (p<0.05)' if p < 0.05 else ''}")

    return {"name": name, "ma": ma, "mb": mb, "p": p, "ra": ra, "rb": rb,
            "y": y, "pa": pa, "pb": pb}


def save_markdown(results):
    out = Path(__file__).parent / "compare_intent_f1_results.md"
    lines = ["# Intent Classifier F1 Comparison: Rule-Based vs Hybrid LLM\n\n"]
    lines.append("| Subset | System A Rules (macro F1) | System B Hybrid (macro F1) | Δ | McNemar p |\n")
    lines.append("|---|---|---|---|---|\n")
    for r in results:
        sig = " ✓" if r["p"] < 0.05 else ""
        lines.append(
            f"| {r['name']} | {r['ma']:.3f} | {r['mb']:.3f} "
            f"| {r['mb']-r['ma']:+.3f} | {r['p']:.4f}{sig} |\n"
        )
    lines.append("\n")
    for r in results:
        lines.append(f"## {r['name']}\n\n")
        lines.append(f"**System A (Rule-based)**  macro F1 = {r['ma']:.3f}\n```\n{r['ra']}```\n\n")
        lines.append(f"**System B (Hybrid LLM)**  macro F1 = {r['mb']:.3f}\n```\n{r['rb']}```\n\n")
    out.write_text("".join(lines), encoding="utf-8")
    print(f"\nSaved: {out}")


if __name__ == "__main__":
    ds = Path(__file__).parent / "intent_eval_dataset.json"
    with open(ds, encoding="utf-8") as f:
        dataset = json.load(f)

    en = [d for d in dataset if d["lang"] == "en"]
    th = [d for d in dataset if d["lang"] == "th"]

    results = []
    for name, subset in [("English-only", en), ("Thai-only", th), ("Combined", dataset)]:
        results.append(evaluate_subset(name, subset))

    save_markdown(results)
