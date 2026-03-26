from enum import Enum

class Intent(str, Enum):
    PRODUCT_INFO = "product_info"
    PRODUCT_COMPARE = "product_compare"
    OUT_OF_SCOPE = "out_of_scope"


def detect_intent(message: str) -> Intent:
    text = message.lower()

    product_keywords = [
        "price", "cost", "how much", "how expensive",
        "size", "sizes",
        "color", "colors",
        "material",
        "feature", "features",
        "available", "stock", "detail"
    ]

    product_search_keywords = [
        "show me", "find", "search", "looking for",
        "do you have", "have any", "sell", "buy", "order",
        "recommend", "suggest",
        "under", "below", "less than", "cheaper than",
    ]

    product_types = [
        "shirt", "t-shirt", "tshirt", "tee",
        "pants", "trousers", "jeans",
        "jacket", "hoodie",
    ]

    compare_keywords = [
        "compare", "difference", "vs", "better than"
    ]

    if any(word in text for word in compare_keywords):
        return Intent.PRODUCT_COMPARE

    if any(word in text for word in product_keywords):
        return Intent.PRODUCT_INFO

    if any(word in text for word in product_search_keywords):
        return Intent.PRODUCT_INFO

    if any(word in text for word in product_types):
        return Intent.PRODUCT_INFO

    return Intent.OUT_OF_SCOPE
