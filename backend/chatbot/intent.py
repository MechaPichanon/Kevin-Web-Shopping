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

    compare_keywords = [
        "compare", "difference", "vs", "better than"
    ]

    if any(word in text for word in compare_keywords):
        return Intent.PRODUCT_COMPARE

    if any(word in text for word in product_keywords):
        return Intent.PRODUCT_INFO

    return Intent.OUT_OF_SCOPE