"""
LLM model evaluation — 20 Thai/English questions against the live /chat API.

Each question has an expected fact taken from the real catalogue / store_policies /
discount_codes in the DB (checked 2026-10-10), so the answer can be scored for
correctness, not just "sounds nice". Each question runs in a fresh conversation
(no conversation_id) so earlier answers can't leak into later ones.

Run (chatbot must be up on :8000, and must be using the model you want to test):
    python llm_model_eval.py google/gemini-3.5-flash-lite

The label argument is only used for the output filename / report header — the
model actually used is whatever OPENROUTER_CHAT_MODEL the chatbot container has.
Output: reports/llm_eval_<label>.json  (raw replies, for scoring by hand)
"""
import json
import os
import sys
import time
from datetime import datetime

import requests

CHAT_URL = os.getenv("CHAT_URL", "http://localhost:8000/chat")

# (id, lang, category, question, expected — what a correct answer must contain / avoid)
QUESTIONS = [
    # ── Product search / recommendation ─────────────────────────────────────
    (1,  "th", "product",  "แนะนำเสื้อโปโลหน่อย",
         "Lists real polos from the catalogue (e.g. Solid Polo, Ribbed Polo, Corn Polo), price ~200–250 THB; no invented products"),
    (2,  "en", "product",  "Do you have linen shirts?",
         "Yes — Linen Shirt, 390 THB, Beige/Cream/White, M/L/XL"),
    (3,  "th", "product",  "มีกางเกงขาสั้นอะไรบ้าง",
         "Heavyweight Shorts (150 THB) and Swim Shorts (200 THB)"),
    (4,  "en", "product",  "What's the cheapest shirt you sell?",
         "Silk shirts at 150 THB (e.g. Monstera / Fern Line / floral silk shirt); must not quote a lower price"),
    (5,  "th", "product",  "อยากได้เสื้อยืดสีดำ",
         "Heavyweight T-Shirt, Black (XL), 200 THB"),
    (6,  "en", "product",  "Compare the Linen Shirt and the Heavyweight T-Shirt",
         "Linen 390 THB vs Heavyweight T-Shirt 200 THB; colours/sizes correct"),
    # ── Stock check ──────────────────────────────────────────────────────────
    (7,  "th", "stock",    "กางเกงผ้าไหมมีของไหม",
         "Silk Pants are OUT OF STOCK (stock 0 on every variant) — must not say available"),
    (8,  "en", "stock",    "Is the Linen Shirt available in white size M?",
         "Yes — White/M in stock (45)"),
    (9,  "th", "stock",    "เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม",
         "No black Linen Shirt exists (only Beige/Cream/White) — must say not available"),
    (10, "en", "stock",    "What colours do the Swim Shorts come in?",
         "10 colours: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, Yellow; size 30 only"),
    # ── Size guide ───────────────────────────────────────────────────────────
    (11, "th", "size",     "รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร",
         "Size L — 114 cm ≈ 44.9 in, chart is in inches (L = chest 44–46)"),
    (12, "en", "size",     "My chest is 49 inches, which size Heavyweight T-Shirt should I get?",
         "Size XL (chest 48–50)"),
    # ── Store policy / discounts ─────────────────────────────────────────────
    (13, "th", "policy",   "ค่าส่งเท่าไหร่ ส่งฟรีไหม",
         "50 THB flat; free from 200 THB; 2–5 business days"),
    (14, "en", "policy",   "Can I return a shirt if it doesn't fit?",
         "Yes within 7 days of receipt; unworn, unwashed, tags on; start via chat"),
    (15, "th", "policy",   "จ่ายเงินช่องทางไหนได้บ้าง",
         "Credit/debit card (Visa, Mastercard), PromptPay QR, COD"),
    (16, "en", "policy",   "Do you have any discount codes right now?",
         "WELCOME10 (10%, min 500) and SAVE100 (100 THB off, min 1000); must NOT mention expired SUMMER15/TESTUAT15"),
    # ── Out of scope / safety ────────────────────────────────────────────────
    (17, "th", "oos",      "ขายรองเท้าผ้าใบไหม",
         "Store doesn't sell shoes — politely say so, no invented shoes"),
    (18, "en", "oos",      "Can you help me write my homework essay?",
         "Polite refusal / out of scope"),
    # ── Mixed language & robustness ──────────────────────────────────────────
    (19, "th", "mixed",    "มี polo สี white size XL ไหม",
         "Yes — e.g. Corn Polo / Ribbed Polo / Solid Polo in White XL (any correct real one); reply in Thai"),
    (20, "en", "mixed",    "I want a shirt for the beach, something light, under 300 baht",
         "Suggests real items ≤300 THB (silk shirts 150 THB, maybe Swim Shorts); must not suggest Linen Shirt as under 300"),
]


def run(label: str):
    print(f"Sending {len(QUESTIONS)} questions to {CHAT_URL} (label: {label})\n")
    results = []
    for qid, lang, cat, q, expected in QUESTIONS:
        t0 = time.perf_counter()
        try:
            r = requests.post(CHAT_URL, json={"message": q, "lang": lang}, timeout=120)
            elapsed = time.perf_counter() - t0
            data = r.json()
            reply = data.get("reply", "")
            intent = data.get("intent", "")
            products = [c.get("name") for c in data.get("product_cards", []) or []]
            error = None if r.ok else f"HTTP {r.status_code}"
        except Exception as e:
            elapsed = time.perf_counter() - t0
            reply, intent, products, error = "", "", [], str(e)
        results.append({
            "id": qid, "lang": lang, "category": cat, "question": q,
            "expected": expected, "intent": intent, "reply": reply,
            "product_cards": products, "latency_s": round(elapsed, 2), "error": error,
        })
        print(f"  Q{qid:>2} [{cat:<7}] {elapsed:5.1f}s  intent={intent}  {'ERR ' + error if error else ''}")

    os.makedirs(os.path.join(os.path.dirname(__file__), "reports"), exist_ok=True)
    safe = label.replace("/", "_").replace(":", "_")
    out = os.path.join(os.path.dirname(__file__), "reports", f"llm_eval_{safe}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"label": label, "run_at": datetime.now().isoformat(timespec="seconds"),
                   "results": results}, f, ensure_ascii=False, indent=2)
    lat = [r["latency_s"] for r in results if not r["error"]]
    if lat:
        print(f"\nAvg latency {sum(lat)/len(lat):.1f}s, max {max(lat):.1f}s, errors {len(results)-len(lat)}")
    print(f"Saved → {out}")


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "unlabelled")
