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

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(request: ChatRequest):
    logger.info(f"Incoming message: {request.message}")

    intent = detect_intent(request.message)
    logger.info(f"Detected intent: {intent}")

    if intent == Intent.OUT_OF_SCOPE:
        logger.warning("Out of scope detected.")
        return {
            "reply": OUT_OF_SCOPE_RESPONSE,
            "intent": intent
        }
    
    products = retrieve_products(request.message)
    logger.info(f"Retrieved products count: {len(products)}")
    if not products:
        return {
            "reply": "Sorry, I couldn't find any products related to your query.",
            "intent": intent
        }
    logger.info(f"Products used: {[p['id'] for p in products]}")

    products_context = format_products_for_prompt(products)
    
    prompt = f"""
You are a chatbot for an online clothing store.

Rules:
- Answer ONLY using the provided product information.
- If the question is not about store products, reply exactly: OUT_OF_SCOPE
- Keep answers short and clear.
- Use bullet points when listing information.
- Maximum 5 bullet points or 5 short sentences.
- Do NOT explain concepts.
- Do NOT add suggestions unless asked.

Product Data:
{products_context}

User Question: {request.message}"""
    
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
