import sys
import requests
from datetime import datetime

CHAT_URL = "http://localhost:8000/chat"

QUESTIONS = [
    # PRODUCT_INFO (7)
    ("show me jackets under 1000 baht",            "product_info"),
    ("แนะนำเสื้อยืดสวยๆ หน่อย",                  "product_info"),
    ("what shirts do you have",                    "product_info"),
    ("เสื้อตัวไหนถูกกว่า",                        "product_info"),
    ("compare the two jackets",                    "product_info"),
    ("อยากได้กางเกงสีดำ ราคาไม่เกิน 500",         "product_info"),
    ("do you sell hoodies",                        "product_info"),
    # STOCK_CHECK (6)  — Q1 corrected here
    ("มีเสื้อสีแดงไหม",                            "stock_check"),
    ("เสื้อตัวนี้มีสต็อกไหม",                      "stock_check"),
    ("is the black jacket size L available",       "stock_check"),
    ("มีเสื้อยืดสีขาวไซส์ XL ไหม",               "stock_check"),
    ("do you have blue pants in stock",            "stock_check"),
    ("เหลือกางเกงสีกรมไหม",                       "stock_check"),
    # SIZE_GUIDE (5)
    ("เสื้อไซส์ M เหมาะกับใคร",                   "size_guide"),
    ("what size fits 80cm chest",                  "size_guide"),
    ("ฉันรอบอก 90 ซม. ควรใส่ไซส์อะไร",           "size_guide"),
    ("ไซส์ไหนเหมาะกับผู้หญิงตัวเล็ก",             "size_guide"),
    ("which size should I pick for 170cm height",  "size_guide"),
    # STORE_POLICY (8)
    ("ส่งฟรีไหม",                                 "store_policy"),
    ("how long does delivery take",                "store_policy"),
    ("can I return items if they don't fit",       "store_policy"),
    ("คืนสินค้าได้ไหม",                           "store_policy"),
    ("มีโค้ดส่วนลดไหม",                           "store_policy"),
    ("any promo codes available",                  "store_policy"),
    ("รับชำระด้วย promptpay ไหม",                 "store_policy"),
    ("what payment methods do you accept",         "store_policy"),
    # OUT_OF_SCOPE (4)
    ("ขายโทรศัพท์ไหม",                            "out_of_scope"),
    ("what's the weather today",                   "out_of_scope"),
    ("ราคาหุ้น SCB วันนี้เท่าไร",                 "out_of_scope"),
    ("recommend me a good restaurant",             "out_of_scope"),
    # SMALLTALK — early-exit path, returns out_of_scope intent
    ("สวัสดี",                                     "smalltalk"),
    ("hello",                                      "smalltalk"),
    ("ขอบคุณมาก",                                  "smalltalk"),
    ("thank you",                                  "smalltalk"),
]


def run(label: str = "llm"):
    """
    label: 'llm' (default) or 'rulebased' — controls the output filename.
    Run with:  python day1_sanity.py rulebased
    """
    out_path = f"day2_rulebased_results.md" if label == "rulebased" else "day1_results.md"
    title = "Day 2 — Rule-Based Intent Results" if label == "rulebased" else "Day 1–2 Sanity Check Results (LLM)"

    print(f"[{label.upper()}] Sending {len(QUESTIONS)} questions to {CHAT_URL} ...\n")
    results = []

    for q, expected in QUESTIONS:
        try:
            r = requests.post(CHAT_URL, json={"message": q}, timeout=30)
            data = r.json()
            actual = data.get("intent", "ERROR")
            reply_preview = (data.get("reply") or "")[:100].replace("\n", " ")
        except Exception as e:
            actual = "EXCEPTION"
            reply_preview = str(e)[:100]

        # Smalltalk returns out_of_scope — accept either
        if expected == "smalltalk":
            match = "✓" if actual in ("out_of_scope", "smalltalk") else "✗"
        else:
            match = "✓" if actual == expected else "✗"

        results.append((q, expected, actual, match, reply_preview))
        print(f"  {match}  [{expected:<12}] → [{actual:<12}]  {q}")

    passed = sum(1 for *_, m, _ in results if m == "✓")
    total = len(results)
    print(f"\nIntent match: {passed}/{total}  ({100*passed//total}%)\n")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        f.write(f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M')}  \n")
        f.write(f"Intent match: **{passed}/{total}** ({100*passed//total}%)  \n\n")
        f.write("| # | Question | Expected | Actual | Match | Reply Preview | Pass/Fail |\n")
        f.write("|---|---|---|---|---|---|---|\n")
        for i, (q, exp, act, m, preview) in enumerate(results, 1):
            f.write(f"| {i} | {q} | {exp} | {act} | {m} | {preview} | _(fill in)_ |\n")
        f.write("\n---\n\n")
        f.write("**Pass/Fail criteria**  \n")
        f.write("- Pass: intent correct AND reply is sensible (real products / correct policy)  \n")
        f.write("- Fail: intent wrong, reply empty, reply invents data, or crashes  \n")
        f.write("- Smalltalk: Pass if reply is a greeting/acknowledgement, not product mode  \n")

    print(f"Saved: {out_path}")


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "llm"
    run(label)
