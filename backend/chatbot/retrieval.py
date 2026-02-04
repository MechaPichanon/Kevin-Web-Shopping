import json
from typing import List, Dict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PRODUCTS_PATH = BASE_DIR / "data" / "products.json"


def load_products() -> List[Dict]:
    with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def retrieve_products(query: str) -> List[Dict]:
    """
    Very simple keyword-based retrieval.
    Matches product name or category.
    """
    query = query.lower()
    products = load_products()

    matched = []

    for product in products:
        name = product["name"].lower()
        category = product["category"].lower()

        if name in query or category in query:
            matched.append(product)

    return matched