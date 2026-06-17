from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from .intent import detect_intent, Intent
    from .retrieval import retrieve_products, load_products
    from .db import get_conn, release_conn
except ImportError:
    from intent import detect_intent, Intent
    from retrieval import retrieve_products, load_products
    from db import get_conn, release_conn
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


def _build_catalog_summary() -> str:
    try:
        products = load_products()
        cats = sorted({p.get("category", "") for p in products if p.get("category")})
        prices = [
            float(v["price"])
            for p in products
            for v in (p.get("variants") or [])
            if v.get("price") is not None
        ]
        if prices and cats:
            return (
                f"{', '.join(cats)} "
                f"(prices {min(prices):.0f}–{max(prices):.0f} THB, "
                f"{len(products)} products)"
            )
        return ", ".join(cats) if cats else "shirts, pants, and jackets"
    except Exception:
        return "shirts, pants, and jackets"


_CATALOG_SUMMARY = _build_catalog_summary()

_STORE_POLICY_FALLBACK_EN = """\
Shipping:
- Standard shipping: 2–5 business days, flat rate 50 THB
- Free shipping on orders over 999 THB
- Bangkok same-day delivery available for orders placed before 12:00 PM

Returns & Exchanges:
- Return or exchange within 7 days of receipt
- Item must be unworn, unwashed, with original tags
- Contact us via chat to initiate a return

Payment Methods:
- Credit / debit card (Visa, Mastercard)
- PromptPay QR code
- Cash on delivery (COD)"""

_STORE_POLICY_FALLBACK_TH = """\
การจัดส่ง:
- จัดส่งมาตรฐาน: 2–5 วันทำการ ค่าจัดส่งคงที่ 50 บาท
- จัดส่งฟรีสำหรับคำสั่งซื้อที่มีมูลค่าตั้งแต่ 999 บาทขึ้นไป
- บริการส่งด่วนภายในวันเดียวสำหรับกรุงเทพฯ (สำหรับคำสั่งซื้อก่อน 12:00 น.)

การคืนและแลกเปลี่ยนสินค้า:
- สามารถคืนหรือแลกเปลี่ยนสินค้าได้ภายใน 7 วันหลังจากได้รับสินค้า
- สินค้าต้องอยู่ในสภาพที่ยังไม่ได้สวมใส่ ยังไม่ได้ซัก และมีป้ายครบ
- ติดต่อเราผ่านแชทเพื่อเริ่มกระบวนการคืนสินค้า

วิธีการชำระเงิน:
- บัตรเครดิต / บัตรเดบิต (Visa, Mastercard)
- พร้อมเพย์ QR code
- เก็บเงินปลายทาง (COD)"""


def _is_thai(text: str) -> bool:
    return bool(re.search(r'[฀-๿]', text or ''))


def _fetch_store_policy(message: str = "") -> str:
    use_thai = _is_thai(message)
    content_col = "content_th" if use_thai else "content_en"
    fallback = _STORE_POLICY_FALLBACK_TH if use_thai else _STORE_POLICY_FALLBACK_EN

    conn = get_conn()
    if not conn:
        return fallback
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT {content_col} FROM store_policies WHERE is_active = true ORDER BY policy_id"
        )
        rows = cur.fetchall()
        cur.close()
    except Exception:
        return fallback
    finally:
        release_conn(conn)

    if not rows:
        return fallback
    return "\n\n".join(row[0] for row in rows if row[0])


def _fetch_stock_context(product_ids: list) -> str:
    conn = get_conn()
    if not conn:
        return ""
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT product_id, size, color, stock
            FROM variants
            WHERE product_id = ANY(%s) AND is_active = true
            ORDER BY product_id, size, color
            """,
            (product_ids,),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        release_conn(conn)
    if not rows:
        return ""
    lines = ["Current stock:"]
    for pid, size, color, stock in rows:
        status = f"{stock} left" if stock > 0 else "out of stock"
        lines.append(f"  {pid} | {size} | {color}: {status}")
    return "\n".join(lines)


def _fetch_measurement_context(product_ids: list) -> str:
    conn = get_conn()
    if not conn:
        return ""
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT product_id, size, chest_min, chest_max, waist_min, waist_max
            FROM variants
            WHERE product_id = ANY(%s)
              AND (chest_min IS NOT NULL OR waist_min IS NOT NULL)
              AND is_active = true
            ORDER BY product_id, size
            """,
            (product_ids,),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        release_conn(conn)
    if not rows:
        return ""
    lines = ["Size measurement guide (cm):"]
    for pid, size, ch_min, ch_max, w_min, w_max in rows:
        parts = [f"{pid} | {size}"]
        if ch_min is not None:
            parts.append(f"chest {ch_min}–{ch_max}")
        if w_min is not None:
            parts.append(f"waist {w_min}–{w_max}")
        lines.append("  " + " | ".join(parts))
    return "\n".join(lines)


def _fetch_active_discounts() -> str:
    conn = get_conn()
    if not conn:
        return "No active discount codes at this time."
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT code, discount_type, discount_value, min_order, expires_at
            FROM discount_codes
            WHERE is_active = true
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY discount_value DESC
            """
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        release_conn(conn)
    if not rows:
        return "No active discount codes at this time."
    lines = ["Active discount codes:"]
    for code, dtype, value, min_order, expires in rows:
        val_str = f"{float(value):.0f}%" if dtype == "percent" else f"{float(value):.0f} THB off"
        line = f"  Code: {code} — {val_str}"
        if min_order and float(min_order) > 0:
            line += f" (min order {float(min_order):.0f} THB)"
        if expires:
            line += f", expires {expires.strftime('%Y-%m-%d')}"
        lines.append(line)
    return "\n".join(lines)


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
            sizes     = sorted(set(v.get("size",     "") for v in variants if v.get("size")))
            colors    = sorted(set(v.get("color",    "") for v in variants if v.get("color")))
            colors_th = sorted(set(v.get("color_th", "") for v in variants if v.get("color_th")))
            sleeves   = sorted(set(v.get("sleeve",   "") for v in variants if v.get("sleeve")))
            prices    = [float(v["price"]) for v in variants if v.get("price") is not None]
            price_str = ""
            if prices:
                lo, hi = min(prices), max(prices)
                price_str = f"{lo:.0f} THB" if lo == hi else f"{lo:.0f}–{hi:.0f} THB"

            name     = p.get("product_name") or p.get("name", "")
            name_th  = p.get("product_name_th", "") or ""
            category = p.get("category", "")
            sub_cat  = p.get("sub_category", "")
            desc     = p.get("description",  "")
            desc_th  = p.get("description_th", "") or ""

            name_display = f"{name} ({name_th})" if name_th else name

            block = f"- Name: {name_display}\n"
            block += f"  Category: {category}"
            if sub_cat:     block += f" ({sub_cat})"
            block += "\n"
            if price_str:   block += f"  Price: {price_str}\n"
            if sizes:       block += f"  Sizes: {', '.join(sizes)}\n"
            if colors:
                color_display = ", ".join(colors)
                if colors_th:
                    color_display += f" ({', '.join(colors_th)})"
                block += f"  Colors: {color_display}\n"
            if sleeves:     block += f"  Sleeve: {', '.join(sleeves)}\n"
            if desc:        block += f"  Description: {desc}\n"
            if desc_th:     block += f"  คำอธิบาย: {desc_th}\n"
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

    unsupported_context = ""
    if is_unsupported_store_question(request.message):
        logger.info("Unsupported store question detected; injecting soft context.")
        unsupported_context = (
            "Note: The user is asking about popularity or sales rankings. "
            "We don't have that data. Acknowledge this politely and offer to show "
            "available products instead.\n"
        )

    intent = detect_intent(request.message)
    logger.info(f"Detected intent: {intent}")

    # Short-circuit OUT_OF_SCOPE before any retrieval or LLM calls.
    # Exception: if the message looks like a follow-up referencing a previous product,
    # promote it to PRODUCT_INFO instead.
    if intent == Intent.OUT_OF_SCOPE:
        previous_products = _CONVERSATIONS.get(conversation_id, {}).get("last_products")
        if _is_followup_reference(request.message) and isinstance(previous_products, list) and previous_products:
            intent = Intent.PRODUCT_INFO
        else:
            out_msg = (
                "ขอโทษค่ะ ฉันช่วยได้แค่เรื่องสินค้า ขนาด ราคา และนโยบายร้านค้าเท่านั้นค่ะ 😊"
                if _is_thai(request.message)
                else OUT_OF_SCOPE_RESPONSE
            )
            return {"reply": out_msg, "intent": intent, "conversation_id": conversation_id}

    products = retrieve_products(request.message)
    logger.info(f"Retrieved products count: {len(products)}")

    if not products:
        previous_products = _CONVERSATIONS.get(conversation_id, {}).get("last_products")
        if _is_followup_reference(request.message) and isinstance(previous_products, list) and previous_products:
            logger.info("No products retrieved; using previous conversation products for follow-up.")
            products = previous_products
            if intent == Intent.OUT_OF_SCOPE:
                intent = Intent.PRODUCT_INFO
        elif intent == Intent.STORE_POLICY:
            pass  # this intent doesn't require product context — continue to LLM
        elif intent == Intent.OUT_OF_SCOPE:
            logger.warning("Out of scope detected (no retrieval results, no product signal).")
            return {
                "reply": OUT_OF_SCOPE_RESPONSE,
                "intent": intent,
                "conversation_id": conversation_id,
            }
        else:
            return {
                "reply": "Sorry, I couldn't find any products related to your query.",
                "intent": intent,
                "conversation_id": conversation_id,
            }

    if products:
        logger.info(f"Products used: {[p['id'] for p in products]}")
        _CONVERSATIONS[conversation_id]["last_products"] = products

    products_context = format_products_for_prompt(products)

    # Gather extra context based on intent.
    extra_context = ""
    product_ids = [p.get("product_id") or p.get("id", "") for p in products]

    if intent == Intent.STORE_POLICY:
        _discount_kw = ["discount", "promo", "promotion", "coupon", "code", "deal", "sale", "offer",
                        "โปรโมชัน", "ส่วนลด", "โค้ด", "ลดราคา"]
        _msg_lower = request.message.lower()
        if any(k in _msg_lower for k in _discount_kw):
            extra_context = f"\n{_fetch_active_discounts()}"
        else:
            extra_context = f"\nStore Policy:\n{_fetch_store_policy(request.message)}"
    elif intent == Intent.SIZE_GUIDE and product_ids:
        measurement_data = _fetch_measurement_context(product_ids)
        if measurement_data:
            extra_context = f"\n{measurement_data}"
    elif intent == Intent.STOCK_CHECK and product_ids:
        stock_data = _fetch_stock_context(product_ids)
        if stock_data:
            extra_context = f"\n{stock_data}"

    intent_instruction_map = {
        Intent.SIZE_GUIDE: (
            "The user wants sizing help. Use the measurement guide below to recommend a size. "
            "If they gave measurements, match them to the size ranges provided."
        ),
        Intent.STOCK_CHECK: (
            "The user wants to know if something is in stock. Use the stock data below. "
            "Be specific about which size/color combinations are available."
        ),
        Intent.STORE_POLICY: (
            "The user is asking about store policy or promotions. "
            "Answer using only the store info and discount data provided below."
        ),
    }
    intent_instruction = intent_instruction_map.get(
        intent,
        "The user is asking about products. Answer using only the provided product data. "
        "If comparing products, highlight differences in price, material, sizes, and colors.",
    )

    if _is_thai(request.message):
        lang_instruction = "IMPORTANT: The user is writing in Thai. You MUST respond entirely in Thai (ภาษาไทย). Do not use any English words except brand names, size labels (S/M/L/XL), and currency (THB/บาท)."
    else:
        lang_instruction = "Respond in English."

    prompt = f"""You are a helpful assistant for an online Thai clothing store.
{lang_instruction}

The store sells: {_CATALOG_SUMMARY}

Rules:
- Use ONLY the provided data below. Do not invent prices, sizes, colors, or policies.
- If no product matches the user's constraints, say so clearly and suggest the closest available option.
- Do not mention internal IDs. Do not copy field labels like "Name:", "Price:" — rewrite naturally.

Style:
- Sound natural and friendly, like a store assistant.
- Use **bold** for product names and key attributes (price, size, color).
- Use a bullet list (- item) when listing features, sizes, colors, or policy points.
- For comparisons, give a short intro sentence then a bullet block for each product.
- Keep it concise: 1–2 intro sentences + bullets. Avoid long paragraphs.
{unsupported_context}
Task:
{intent_instruction}

Product Data:
{products_context}
{extra_context}
User Question: {request.message}"""
    
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

    if isinstance(reply, str) and reply.strip().upper() == "OUT_OF_SCOPE":
        reply = OUT_OF_SCOPE_RESPONSE
        intent = Intent.OUT_OF_SCOPE
        products = []
    logger.info("LLM response received")
    return{
        "reply": reply,
        "intent": intent,
        "products_used": [p["id"] for p in products],
        "conversation_id": conversation_id,
    }
