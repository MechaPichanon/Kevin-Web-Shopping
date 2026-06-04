from enum import Enum
import re

class Intent(str, Enum):
    PRODUCT_INFO    = "product_info"
    PRODUCT_COMPARE = "product_compare"
    SIZE_GUIDE      = "size_guide"
    STOCK_CHECK     = "stock_check"
    STORE_POLICY    = "store_policy"
    DISCOUNT_QUERY  = "discount_query"
    OUT_OF_SCOPE    = "out_of_scope"


def detect_intent(message: str) -> Intent:
    text = (message or "").strip().lower()
    if not text:
        return Intent.OUT_OF_SCOPE

    # Normalize a couple of common variants so token checks are more reliable.
    text = text.replace("t-shirt", "tshirt").replace("t shirt", "tshirt")
    tokens = set(re.findall(r"[a-z0-9']+", text))

    product_types = [
        "products",
        "product",
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
        "compare", "compair", "difference", "better than", "versus",
        "which is better", "whats the difference", "what's the difference",
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

    # Only block genuine order-tracking requests — shipping/returns/payment are now
    # handled by STORE_POLICY below.
    service_patterns = [
        r"\border\s+status\b",
        r"\btrack\s+(my\s+)?order\b",
    ]
    if any(re.search(p, text) for p in service_patterns):
        return Intent.OUT_OF_SCOPE

    # Store policy: shipping, delivery, returns, payment questions.
    policy_keywords = [
        "shipping", "delivery", "deliver", "ship", "how long",
        "return", "refund", "exchange", "cancel",
        "payment", "pay", "credit card", "cod", "cash on delivery", "promptpay",
    ]
    thai_policy = ["ส่ง", "จัดส่ง", "คืนสินค้า", "คืนเงิน", "จ่าย", "ชำระ"]
    if any(k in text for k in policy_keywords) or any(t in text for t in thai_policy):
        return Intent.STORE_POLICY

    # Discount / promo code questions.
    discount_keywords = ["discount", "promo", "promotion", "coupon", "code", "deal", "sale", "offer"]
    thai_discount = ["โปรโมชัน", "ส่วนลด", "โค้ด", "ลดราคา"]
    if any(k in text for k in discount_keywords) or any(t in text for t in thai_discount):
        return Intent.DISCOUNT_QUERY

    # Size guide: user gives measurements or asks which size to pick.
    size_guide_patterns = [
        r"\bsize\s+guide\b",
        r"\bwhat\s+size\b",
        r"\bwhich\s+size\b",
        r"\bfit(s)?\s+me\b",
        r"\bmeasure",
        r"\d+\s*cm\b",
    ]
    thai_size = ["ไซส์ไหน", "วัดตัว", "รอบอก", "รอบเอว"]
    if any(re.search(p, text) for p in size_guide_patterns) or any(t in text for t in thai_size):
        return Intent.SIZE_GUIDE

    # Stock check: user asks if a specific variant is in stock.
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
    stock_keywords = ["in stock", "out of stock", "left", "have size", "have color"]
    thai_stock = ["มีไหม", "เหลือไหม", "มีของ", "หมดไหม"]
    _product_type_set = {"shirt", "pants", "jacket", "tshirt"}
    if (any(k in text for k in stock_keywords) or any(t in text for t in thai_stock)) and (
        tokens.intersection(_product_type_set) or tokens.intersection(single_word_product_keywords)
    ):
        return Intent.STOCK_CHECK

    # Compare detection:
    # - Use word boundaries for short tokens like "vs" to avoid false positives (e.g. "tvs").
    if re.search(r"(?<![a-z0-9])v\.?s\.?(?![a-z0-9])", text) or any(word in text for word in compare_keywords):
        return Intent.PRODUCT_COMPARE

    # Product info intent:
    # - Prefer token checks for single-word attributes/types.
    # - Allow shopping phrases only when there's some signal (type/attribute/budget).
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

    _THAI_PRODUCT_TOKENS = ["เสื้อ", "เสื้อยืด", "กางเกง", "แจ็กเก็ต", "ราคา", "ไซส์", "ขนาด"]
    if any(t in text for t in _THAI_PRODUCT_TOKENS):
        return Intent.PRODUCT_INFO

    return Intent.OUT_OF_SCOPE
