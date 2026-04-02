from enum import Enum
import re

class Intent(str, Enum):
    PRODUCT_INFO = "product_info"
    PRODUCT_COMPARE = "product_compare"
    OUT_OF_SCOPE = "out_of_scope"


def detect_intent(message: str) -> Intent:
    text = (message or "").strip().lower()
    if not text:
        return Intent.OUT_OF_SCOPE

    # Normalize a couple of common variants so token checks are more reliable.
    text = text.replace("t-shirt", "tshirt").replace("t shirt", "tshirt")
    tokens = set(re.findall(r"[a-z0-9']+", text))

    product_types = [
        "shirt",
        "shirts",
        "tshirt",
        "tshirts",
        "tee",
        "tees",
        "pants",
        "trousers",
        "jeans",
        "jacket",
        "jackets",
        "hoodie",
        "hoodies",
    ]

    compare_keywords = [
        "compare", "difference", "better than", "versus"
    ]

    # Obvious non-clothing categories to reduce false positives for budget/shopping phrases.
    non_clothing_tokens = {
        "tv",
        "tvs",
        "television",
        "televisions",
        "laptop",
        "laptops",
        "phone",
        "phones",
        "smartphone",
        "smartphones",
    }
    if tokens.intersection(non_clothing_tokens) and not tokens.intersection(product_types):
        return Intent.OUT_OF_SCOPE

    # Explicit service/support questions we don't handle with product JSON data.
    # Keep this before keyword matching to avoid accidental routing into PRODUCT_INFO.
    service_patterns = [
        r"\border\s+status\b",
        r"\btrack\s+(my\s+)?order\b",
        r"\bshipping\b",
        r"\bdelivery\b",
        r"\breturn(s)?\b",
        r"\brefund(s)?\b",
        r"\bcancel(lation)?\b",
    ]
    if any(re.search(p, text) for p in service_patterns):
        return Intent.OUT_OF_SCOPE

    # Compare detection:
    # - Use word boundaries for short tokens like "vs" to avoid false positives (e.g. "tvs").
    if re.search(r"(?<![a-z0-9])v\.?s\.?(?![a-z0-9])", text) or any(word in text for word in compare_keywords):
        return Intent.PRODUCT_COMPARE

    # Product info intent:
    # - Prefer token checks for single-word attributes/types.
    # - Allow shopping phrases only when there's some signal (type/attribute/budget).
    single_word_product_keywords = {
        "price",
        "cost",
        "size",
        "sizes",
        "color",
        "colors",
        "material",
        "feature",
        "features",
        "available",
        "stock",
        "detail",
    }

    if tokens.intersection(single_word_product_keywords) or any(phrase in text for phrase in ["how much", "how expensive"]):
        return Intent.PRODUCT_INFO

    if tokens.intersection(product_types):
        return Intent.PRODUCT_INFO

    shopping_phrases = [
        "show me",
        "find",
        "search",
        "looking for",
        "do you have",
        "have any",
        "sell",
        "buy",
        "order",
        "recommend",
        "suggest",
        "under",
        "below",
        "less than",
        "cheaper than",
    ]

    has_budget_signal = bool(re.search(r"\d", text)) and any(
        p in text for p in ["under", "below", "less than", "cheaper than"]
    )

    if any(p in text for p in shopping_phrases) and (
        has_budget_signal or tokens.intersection(single_word_product_keywords) or tokens.intersection(product_types)
    ):
        return Intent.PRODUCT_INFO

    return Intent.OUT_OF_SCOPE
