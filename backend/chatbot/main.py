from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from .intent import detect_intent, Intent
    from .retrieval import retrieve_products
except ImportError:
    from intent import detect_intent, Intent
    from retrieval import retrieve_products
from typing import Dict, Any, List, Optional
import uuid
import requests
import logging
import re
import os

logging.basicConfig(
    filename='chatbot.log',
    level=logging.INFO,
    format="%(asctime)s - %(message)s"
)

logger = logging.getLogger(__name__)

"ollama run qwen2.5:7b uvicorn chatbot.main:app --reload"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")

OUT_OF_SCOPE_RESPONSE = (
    "Sorry, I can only help with questions about products"
)

# Lightweight in-memory conversation state for demos (not persistent).
# Keyed by conversation_id generated/returned by this API.
_CONVERSATIONS: Dict[str, Dict[str, Any]] = {}
_MAX_CONVERSATIONS = 500

def _get_or_create_conversation_id(conversation_id: Optional[str]) -> str:
    cid = (conversation_id or "").strip()
    if not cid:
        cid = str(uuid.uuid4())
    if cid not in _CONVERSATIONS:
        if len(_CONVERSATIONS) >= _MAX_CONVERSATIONS:
            # Drop an arbitrary item to keep memory bounded.
            _CONVERSATIONS.pop(next(iter(_CONVERSATIONS)))
        _CONVERSATIONS[cid] = {}
    return cid

def _is_followup_reference(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    tokens = set(re.findall(r"[a-z0-9']+", text))
    referential = {
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "they",
        "them",
        "one",
        "ones",
    }
    if tokens.intersection(referential):
        return True

    # Short follow-ups like "what about size?" often omit a product name.
    return len(tokens) <= 5

def format_products_for_prompt(products):
    """
    Format retrieved products for the LLM system prompt.
    Handles both new format (variants list) and old flat format.
    """
    lines = []
    for p in products:
        # ── New format: variants list ────────────────────────────
        variants = p.get("variants", []) or []
        if variants:
            sizes   = sorted(set(v.get("size",  "") for v in variants if v.get("size")))
            colors  = sorted(set(v.get("color", "") for v in variants if v.get("color")))
            sleeves = sorted(set(v.get("sleeve","") for v in variants if v.get("sleeve")))
            prices  = [float(v["price"]) for v in variants if v.get("price") is not None]
            price_str = ""
            if prices:
                lo, hi = min(prices), max(prices)
                price_str = f"{lo:.0f} THB" if lo == hi else f"{lo:.0f}–{hi:.0f} THB"

            name     = p.get("product_name") or p.get("name", "")
            category = p.get("category", "")
            sub_cat  = p.get("sub_category", "")
            desc     = p.get("description",  "")

            block = f"- Name: {name}\n"
            block += f"  Category: {category}"
            if sub_cat:     block += f" ({sub_cat})"
            block += "\n"
            if price_str:   block += f"  Price: {price_str}\n"
            if sizes:       block += f"  Sizes: {', '.join(sizes)}\n"
            if colors:      block += f"  Colors: {', '.join(colors)}\n"
            if sleeves:     block += f"  Sleeve: {', '.join(sleeves)}\n"
            if desc:        block += f"  Description: {desc}\n"
            lines.append(block)
        else:
            # ── Legacy flat format ───────────────────────────────
            name     = p.get("product_name") or p.get("name", "")
            category = p.get("category",     "")
            price    = p.get("price",        "")
            currency = p.get("currency",     "THB")
            sizes    = p.get("sizes",        []) or []
            colors   = p.get("colors",       []) or []
            material = p.get("material",     "")
            desc     = p.get("description",  "")

            block = (
                f"- Name: {name}\n"
                f"  Category: {category}\n"
                f"  Price: {price} {currency}\n"
            )
            if sizes:    block += f"  Sizes: {', '.join(str(s) for s in sizes)}\n"
            if colors:   block += f"  Colors: {', '.join(str(c) for c in colors)}\n"
            if material: block += f"  Material: {material}\n"
            if desc:     block += f"  Description: {desc}\n"
            lines.append(block)

    return "\n".join(lines)

app = FastAPI()

# Allow the Next.js dev server (and similar local demos) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Welcome to the Chatbot API!"}

def is_unsupported_store_question(message: str) -> bool:
    """
    Questions that require data we don't have in the product JSON,
    like sales/popularity over time.
    """
    text = (message or "").lower()
    patterns = [
        "best-selling",
        "best selling",
        "bestselling",
        "top seller",
        "top sellers",
        "most popular",
        "most sold",
        "best seller",
        "best sellers",
        "this week",
        "this month",
        "today's best",
        "trending",
    ]
    return any(p in text for p in patterns)

def is_smalltalk(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    tokens = set(re.findall(r"[a-z0-9']+", text))

    single_word = {
        "hello",
        "hi",
        "hey",
        "thanks",
    }
    if tokens.intersection(single_word):
        return True

    # Multi-word phrases are safe to check as substrings.
    phrases = [
        "good morning",
        "good afternoon",
        "good evening",
        "how are you",
        "how's it going",
        "hows it going",
        "what's up",
        "whats up",
        "thank you",
        "สวัสดี",
        "หวัดดี",
        "ขอบคุณ",
    ]
    return any(p in text for p in phrases)

def is_product_domain_query(message: str) -> bool:
    """
    Lightweight router: returns True when the query is likely about store products.

    This prevents embedding retrieval from "hallucinating" relevance for unrelated queries
    (e.g., weather) and accidentally flipping OUT_OF_SCOPE into PRODUCT_INFO.
    """
    text = (message or "").strip().lower()
    if not text:
        return False

    tokens = set(re.findall(r"[a-z0-9']+", text))

    product_type_tokens = {
        "shirt",
        "shirts",
        "tshirt",
        "tshirts",
        "t-shirt",
        "tee",
        "pants",
        "trousers",
        "jeans",
        "jacket",
        "hoodie",
    }
    if tokens.intersection(product_type_tokens):
        return True

    product_attribute_tokens = {
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
        "cotton",
        "polyester",
    }
    if tokens.intersection(product_attribute_tokens):
        return True

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
    return any(p in text for p in shopping_phrases)


def is_smalltalk_strict(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False

    # Avoid substring matches like "s(h)i(r)t" matching "hi".
    patterns = [
        r"\bhello\b",
        r"\bhi\b",
        r"\bhey\b",
        r"\bgood\s+morning\b",
        r"\bgood\s+afternoon\b",
        r"\bgood\s+evening\b",
        r"\bhow\s+are\s+you\b",
        r"\bhow'?s\s+it\s+going\b",
        r"\bwhat'?s\s+up\b",
        r"\bthanks\b",
        r"\bthank\s+you\b",
        r"สวัสดี",
        r"หวัดดี",
        r"ขอบคุณ",
    ]

    return any(re.search(p, text) for p in patterns)

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@app.post("/chat")
def chat(request: ChatRequest):
    conversation_id = _get_or_create_conversation_id(request.conversation_id)
    logger.info(f"Incoming message: {request.message}")

    if is_smalltalk_strict(request.message):
        logger.info("Smalltalk detected; returning a friendly greeting.")
        return {
            "reply": "Hi! I can help you find and compare our shirts and pants. What are you looking for today?",
            "intent": Intent.OUT_OF_SCOPE,
            "conversation_id": conversation_id,
        }

    if is_unsupported_store_question(request.message):
        logger.info("Unsupported store question detected; returning OUT_OF_SCOPE.")
        return {"reply": "OUT_OF_SCOPE", "intent": Intent.OUT_OF_SCOPE, "conversation_id": conversation_id}

    intent = detect_intent(request.message)
    logger.info(f"Detected intent: {intent}")

    products = []

    if intent == Intent.OUT_OF_SCOPE:
        if not is_product_domain_query(request.message):
            logger.warning("Out of scope detected (non-product query).")
            return {
                "reply": OUT_OF_SCOPE_RESPONSE,
                "intent": intent,
                "conversation_id": conversation_id,
            }

        logger.info("Intent out_of_scope; trying retrieval to confirm product relevance.")
        products = retrieve_products(request.message)
        if products:
            intent = Intent.PRODUCT_INFO
            logger.info("Retrieval found products; overriding intent to product_info.")
        else:
            logger.warning("Out of scope detected (no products retrieved).")
            return {
                "reply": OUT_OF_SCOPE_RESPONSE,
                "intent": intent
                ,
                "conversation_id": conversation_id,
            }
    else:
        products = retrieve_products(request.message)

    logger.info(f"Retrieved products count: {len(products)}")
    if not products:
        previous_products = _CONVERSATIONS.get(conversation_id, {}).get("last_products")
        if _is_followup_reference(request.message) and isinstance(previous_products, list) and previous_products:
            logger.info("No products retrieved; using previous conversation products for follow-up.")
            products = previous_products
            if intent == Intent.OUT_OF_SCOPE:
                intent = Intent.PRODUCT_INFO
        else:
            return {
                "reply": "Sorry, I couldn't find any products related to your query.",
                "intent": intent,
                "conversation_id": conversation_id,
            }
    logger.info(f"Products used: {[p['id'] for p in products]}")

    _CONVERSATIONS[conversation_id]["last_products"] = products

    products_context = format_products_for_prompt(products)
    
    intent_instruction = ""
    if intent == Intent.PRODUCT_COMPARE:
        intent_instruction = (
            "The user wants a comparison. Compare the relevant products using only the provided data. "
            "Focus on price, material, sizes, and colors. "
        )
    else:
        intent_instruction = (
            "The user is asking about products. Answer using only the provided product data. "
        )

    prompt = f"""
You are a helpful assistant for an online clothing store.
Answer in English.

Hard rules:
- Use ONLY the provided product data. Do not invent anything.
- If the question is not about store products (shirts, pants, jackets), reply exactly: OUT_OF_SCOPE
- If the question is about products but none match the user's constraints (e.g., budget), say you couldn't find a match (do NOT reply OUT_OF_SCOPE).
- Do not mention internal ids or the word "Product Data".
- Do not copy the field labels verbatim (avoid lines like "Name: ...", "Price: ..."). Rewrite naturally.

Style:
- Sound natural and friendly, like a store assistant.
- Prefer 1–2 short sentences first.
- If needed, add up to 3 bullets for key details.

Task:
{intent_instruction}

Product Data:
{products_context}

User Question: {request.message}
"""
    
    logger.info("sending prompt to LLM")

    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": OLLAMA_CHAT_MODEL,
            "prompt": prompt,
            "stream": False,
        },
        timeout=60
    )
    
    data = response.json()
    reply = data.get("response", "Sorry, something went wrong.")

    # Guard: the model may output the literal string OUT_OF_SCOPE even for in-scope queries
    # (e.g., when no products match constraints). Keep API semantics consistent.
    if isinstance(reply, str) and reply.strip() == "OUT_OF_SCOPE" and intent != Intent.OUT_OF_SCOPE:
        if not is_product_domain_query(request.message):
            reply = OUT_OF_SCOPE_RESPONSE
            intent = Intent.OUT_OF_SCOPE
            products = []
        else:
            reply = "Sorry, I couldn't find any products that match what you're looking for."
    logger.info("LLM response received")
    return{
        "reply": reply,
        "intent": intent,
        "products_used": [p["id"] for p in products],
        "conversation_id": conversation_id,
    }
