from enum import Enum
import logging
import re

try:
    from . import llm_client
except ImportError:
    import llm_client

logger = logging.getLogger(__name__)

class Intent(str, Enum):
    PRODUCT_INFO = "product_info"
    SIZE_GUIDE   = "size_guide"
    STOCK_CHECK  = "stock_check"
    STORE_POLICY = "store_policy"
    OUT_OF_SCOPE = "out_of_scope"

_INTENT_LABELS = {
    "product_info": Intent.PRODUCT_INFO,
    "size_guide":   Intent.SIZE_GUIDE,
    "stock_check":  Intent.STOCK_CHECK,
    "store_policy": Intent.STORE_POLICY,
    "out_of_scope": Intent.OUT_OF_SCOPE,
}

_CLASSIFICATION_PROMPT = """\
You are an intent classifier for a Thai clothing store chatbot.
Classify the customer message into exactly one category. Reply with only the category name, nothing else.

Categories:
- product_info : asking about products, prices, recommendations, comparisons, features, descriptions
- size_guide   : asking about sizes, measurements, which size fits them, body measurements
- stock_check  : asking if a specific item, size, or color is available or in stock
- store_policy : asking about shipping, delivery, returns, refunds, payments, discounts, promo codes, promotions
- out_of_scope : not related to a clothing store at all

Message: "{message}"

Category:"""


def _llm_classify_intent(message: str) -> Intent:
    # Same backend as the chat reply (OpenRouter when configured, else Ollama).
    # temperature 0 so production matches how the classifier was evaluated.
    try:
        raw = llm_client.complete(
            _CLASSIFICATION_PROMPT.format(message=message), temperature=0, timeout=15
        )
    except llm_client.LLMError as exc:
        logger.warning("intent LLM call failed, defaulting to product_info: %s", exc)
        return Intent.PRODUCT_INFO

    words = raw.strip().lower().split()
    # Strip any punctuation the model might append (e.g. "product_info.")
    label = re.sub(r"[^a-z_]", "", words[0]) if words else ""
    if label not in _INTENT_LABELS:
        logger.warning("intent LLM returned unknown label %r, defaulting to product_info", raw[:80])
        return Intent.PRODUCT_INFO
    return _INTENT_LABELS[label]


def detect_intent(message: str) -> Intent:
    text = (message or "").strip().lower()
    if not text:
        return Intent.OUT_OF_SCOPE

    tokens = set(re.findall(r"[a-z0-9']+", text))

    # Pre-filter: obvious non-clothing product domains — fast, no LLM needed.
    non_clothing_tokens = {"tv", "tvs", "television", "televisions",
                           "laptop", "laptops", "phone", "phones",
                           "smartphone", "smartphones"}
    clothing_tokens = {"shirt", "shirts", "tshirt", "tshirts", "tee", "tees",
                       "pants", "trousers", "jeans", "jacket", "jackets",
                       "hoodie", "hoodies"}
    if tokens.intersection(non_clothing_tokens) and not tokens.intersection(clothing_tokens):
        return Intent.OUT_OF_SCOPE

    # Pre-filter: order tracking (we don't support it).
    if re.search(r"\border\s+status\b|\btrack\s+(my\s+)?order\b", text):
        return Intent.OUT_OF_SCOPE

    # Pre-filter: Thai non-clothing domains.
    thai_non_clothing = ["หุ้น", "หวย", "ลอตเตอรี่", "สภาพอากาศ", "ร้านอาหาร", "อาหาร", "ข่าว"]
    thai_clothing = ["เสื้อ", "เสื้อยืด", "กางเกง", "แจ็กเก็ต", "ไซส์", "ขนาด"]
    if any(t in text for t in thai_non_clothing) and not any(t in text for t in thai_clothing):
        return Intent.OUT_OF_SCOPE

    return _llm_classify_intent(message)
