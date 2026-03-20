from fastapi import FastAPI
from pydantic import BaseModel
from intent import detect_intent,Intent
from retrieval import retrieve_products
import requests
import logging

logging.basicConfig(
    filename='chatbot.log',
    level=logging.INFO,
    format="%(asctime)s - %(message)s"
)

logger = logging.getLogger(__name__)

"ollama run qwen2.5:7b uvicorn chatbot.main:app --reload"


OUT_OF_SCOPE_RESPONSE = (
    "Sorry, I can only help with questions about products"
)

def format_products_for_prompt(products):
    lines = []
    for p in products:
        lines.append(
            f"- Name: {p['name']}\n"
            f" Category: {p['category']}\n"
            f" Price: {p['price']} {p['currency']}\n"
            f" Sizes: {', '.join(p['sizes'])}\n"
            f" Colors: {', '.join(p['colors'])}\n"
            f" Material: {p['material']}\n"
            f" Description: {p['description']}\n"
        )
    return "\n".join(lines)

app = FastAPI()

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

    patterns = [
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "how are you",
        "how's it going",
        "hows it going",
        "what's up",
        "whats up",
        "thanks",
        "thank you",
        "สวัสดี",
        "หวัดดี",
        "ขอบคุณ",
    ]
    return any(p in text for p in patterns)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(request: ChatRequest):
    logger.info(f"Incoming message: {request.message}")

    if is_smalltalk(request.message):
        logger.info("Smalltalk detected; returning a friendly greeting.")
        return {
            "reply": "Hi! I can help you find and compare our shirts and pants. What are you looking for today?",
            "intent": Intent.OUT_OF_SCOPE,
        }

    if is_unsupported_store_question(request.message):
        logger.info("Unsupported store question detected; returning OUT_OF_SCOPE.")
        return {"reply": "OUT_OF_SCOPE", "intent": Intent.OUT_OF_SCOPE}

    intent = detect_intent(request.message)
    logger.info(f"Detected intent: {intent}")

    products = []

    if intent == Intent.OUT_OF_SCOPE:
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
            }
    else:
        products = retrieve_products(request.message)

    logger.info(f"Retrieved products count: {len(products)}")
    if not products:
        return {
            "reply": "Sorry, I couldn't find any products related to your query.",
            "intent": intent
        }
    logger.info(f"Products used: {[p['id'] for p in products]}")

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
- If the question is not about store products, reply exactly: OUT_OF_SCOPE
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
        "http://localhost:11434/api/generate",
        json={
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False,
        },
        timeout=60
    )
    
    data = response.json()
    reply = data.get("response", "Sorry, something went wrong.")
    logger.info("LLM response received")
    return{
        "reply": reply,
        "intent": intent,
        "products_used": [p["id"] for p in products]
    }
