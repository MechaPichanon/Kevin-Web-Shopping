"""
Multi-turn follow-up check via /chat: after a product question, a pointer
follow-up ("ตัวนี้…", "ไซส์ M เหลือไหม", "is it…") must reuse the previous
products, and an unrelated message must not.

    python followup_eval.py <label>      # chatbot on :8000
Output: reports/followup_eval_<label>.json
"""
import json
import os
import sys

import requests

CHAT_URL = os.getenv("CHAT_URL", "http://localhost:8000/chat")

# (first message, follow-up, lang, expectation)
CASES = [
    ("แนะนำเสื้อโปโลหน่อย", "ตัวนี้มีสีดำไหม", "th", "reuse"),
    ("แนะนำเสื้อโปโลหน่อย", "ไซส์ M เหลือไหม", "th", "reuse"),
    ("Do you have linen shirts?", "Is it available in black?", "en", "reuse"),
    ("แนะนำเสื้อโปโลหน่อย", "หุ้นวันนี้เป็นไง", "th", "out_of_scope"),
    ("แนะนำเสื้อโปโลหน่อย", "มีกางเกงขาสั้นไหม", "th", "new_search"),
]


def send(msg, cid, lang):
    d = requests.post(CHAT_URL, json={"message": msg, "conversation_id": cid, "lang": lang}, timeout=120).json()
    return d, [c["name"] for c in d.get("product_cards", []) or []]


def run(label):
    rows = []
    for first, follow, lang, expect in CASES:
        d1, cards1 = send(first, None, lang)
        d2, cards2 = send(follow, d1["conversation_id"], lang)
        if expect == "reuse":
            ok = bool(cards2) and set(cards2) == set(cards1)
        elif expect == "out_of_scope":
            ok = d2["intent"] == "out_of_scope"
        else:
            ok = bool(cards2) and set(cards2) != set(cards1)
        rows.append({"first": first, "follow_up": follow, "expect": expect, "pass": ok,
                     "cards_turn1": cards1, "cards_turn2": cards2,
                     "intent_turn2": d2["intent"], "reply_turn2": d2["reply"]})
        print(f"  {'✓' if ok else '✗'} [{expect:<12}] {first} → {follow}\n      turn1 {cards1}\n      turn2 {cards2} intent={d2['intent']}")
    os.makedirs(os.path.join(os.path.dirname(__file__), "reports"), exist_ok=True)
    out = os.path.join(os.path.dirname(__file__), "reports", f"followup_eval_{label}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"label": label, "results": rows}, f, ensure_ascii=False, indent=1)
    print(f"{sum(r['pass'] for r in rows)}/{len(rows)} passed → {out}")


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "run")
