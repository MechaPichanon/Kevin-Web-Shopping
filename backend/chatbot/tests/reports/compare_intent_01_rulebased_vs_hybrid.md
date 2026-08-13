# Compare Intent #1: Rule-Based vs Hybrid LLM

**Date:** 2026-06-11  
**Tester:** Kevin  
**Model:** qwen2.5:7b (Ollama, temperature=0)  
**Test script:** `backend/chatbot/tests/compare_intent_f1.py`  
**Dataset:** `backend/chatbot/tests/intent_eval_dataset.json`

---

## Objective

Compare the intent classification accuracy of two versions of the chatbot's `detect_intent()` function to determine whether upgrading from a pure rule-based system to a hybrid rules+LLM system was justified.

---

## Systems Compared

| | System A — Rule-Based | System B — Hybrid LLM |
|---|---|---|
| **Code version** | git HEAD (before upgrade) | Current working tree |
| **Method** | Pure keyword/regex matching | Fast rule pre-filters + qwen2.5:7b LLM |
| **Intents** | 7 (PRODUCT_COMPARE and DISCOUNT_QUERY merged to 5 for evaluation) | 5 |
| **Thai support** | Partial — small fixed token lists per intent | Full — LLM reads Thai natively |
| **LLM required** | No | Yes (Ollama on port 11434) |

**Label mapping applied to System A outputs (7 → 5):**  
- `product_compare` → `product_info`  
- `discount_query` → `store_policy`

---

## Dataset

- **Size:** 100 questions total
- **Balance:** 5 classes × 20 questions each (perfectly balanced)
- **Language split:** 50 English + 50 Thai
- **Per class per language:** 10 EN + 10 TH = 20 per class
- **Source file:** `intent_eval_dataset.json` (fresh questions, not reused from `day1_sanity.py`)

**Classes:** `product_info` · `size_guide` · `stock_check` · `store_policy` · `out_of_scope`

**Annotation rule for "do you have X" / "มี...ไหม":**
- `stock_check` = asks about a specific item + size or color
- `product_info` = general availability question

---

## Metrics Explained

### Precision, Recall, F1 (per class)

For each intent class (e.g. `stock_check`):

```
Precision = TP / (TP + FP)      → when it fires, is it right?
Recall    = TP / (TP + FN)      → of all real X questions, how many does it catch?
F1        = 2 × P × R / (P + R) → harmonic mean; punishes lopsided P or R
```

**Example — stock_check in System A (Combined):**
- 20 real stock_check questions; classifier predicted stock_check on only 5 (all correct)
- TP=5, FP=0, FN=15
- Precision = 5/5 = **1.00**  ·  Recall = 5/20 = **0.25**  ·  F1 = **0.40**

### Accuracy

```
Accuracy = (correct predictions) / (total questions)
```

System A accuracy = 72/100 = 72%. Note: accuracy alone is misleading — System A labels many Thai questions as `product_info` (low precision 0.46) but still gets 72% because it handles the easy English and policy cases well.

### Macro F1

```
Macro F1 = (F1_class1 + F1_class2 + ... + F1_class5) / 5
```

Simple average over all classes, each weighted equally. This is the headline comparison metric.

### McNemar's Test

Tests whether the difference between two classifiers on the **same** test set is statistically significant.

```
b = questions A got right but B got wrong
c = questions A got wrong but B got right
χ² = (|b − c| − 1)² / (b + c)
p-value → probability this gap happened by chance
```

**p < 0.05** = the difference is real, not random noise.

---

## Results

### Summary

| Subset | System A Rules | System B Hybrid | Δ | McNemar p |
|---|---|---|---|---|
| English-only (50 q) | 0.816 | 0.919 | **+0.103** | 0.1306 |
| Thai-only (50 q)    | 0.567 | 0.921 | **+0.354** | 0.0023 ✓ |
| Combined (100 q)    | 0.705 | 0.920 | **+0.215** | 0.0003 ✓ |

✓ = statistically significant (p < 0.05)

---

### English-only (50 questions)

**System A — Rule-Based**  Accuracy = 82%  Macro F1 = 0.816
```
              precision  recall  f1-score  support
product_info       0.60    0.90      0.72       10
  size_guide       1.00    0.70      0.82       10
 stock_check       1.00    0.50      0.67       10
store_policy       1.00    1.00      1.00       10
out_of_scope       0.77    1.00      0.87       10
```

**System B — Hybrid LLM**  Accuracy = 92%  Macro F1 = 0.919
```
              precision  recall  f1-score  support
product_info       1.00    1.00      1.00       10
  size_guide       0.77    1.00      0.87       10
 stock_check       1.00    0.70      0.82       10
store_policy       0.91    1.00      0.95       10
out_of_scope       1.00    0.90      0.95       10
```

---

### Thai-only (50 questions)

**System A — Rule-Based**  Accuracy = 62%  Macro F1 = 0.567
```
              precision  recall  f1-score  support
product_info       0.38    1.00      0.56       10
  size_guide       1.00    0.40      0.57       10
 stock_check       0.00    0.00      0.00       10
store_policy       1.00    0.80      0.89       10
out_of_scope       0.75    0.90      0.82       10
```

**System B — Hybrid LLM**  Accuracy = 92%  Macro F1 = 0.921
```
              precision  recall  f1-score  support
product_info       0.90    0.90      0.90       10
  size_guide       0.91    1.00      0.95       10
 stock_check       1.00    0.90      0.95       10
store_policy       0.82    0.90      0.86       10
out_of_scope       1.00    0.90      0.95       10
```

---

### Combined (100 questions)

**System A — Rule-Based**  Accuracy = 72%  Macro F1 = 0.705
```
              precision  recall  f1-score  support
product_info       0.46    0.95      0.62       20
  size_guide       1.00    0.55      0.71       20
 stock_check       1.00    0.25      0.40       20
store_policy       1.00    0.90      0.95       20
out_of_scope       0.76    0.95      0.84       20
```

**System B — Hybrid LLM**  Accuracy = 92%  Macro F1 = 0.920
```
              precision  recall  f1-score  support
product_info       0.95    0.95      0.95       20
  size_guide       0.83    1.00      0.91       20
 stock_check       1.00    0.80      0.89       20
store_policy       0.86    0.95      0.90       20
out_of_scope       1.00    0.90      0.95       20
```

---

## Per-Class Analysis

### product_info
System A precision = 0.46 — the old system over-predicts `product_info` as a catch-all. Many Thai `stock_check` and `size_guide` questions fall through keyword rules and land here. System B corrects this with LLM understanding (precision 0.95).

### size_guide
System A Thai recall = 0.40 — the old rules only catch Thai size questions that contain exact phrases like "ไซส์ไหน", "รอบอก", "รอบเอว", "วัดตัว". Questions like "ตารางไซส์เสื้ออยู่ที่ไหน" or "ไซส์ L เหมาะกับใคร" are missed and classified as product_info. The LLM understands context and gets all 10 Thai size questions right (recall 1.00).

### stock_check
System A Thai F1 = **0.00** — the old stock_check rule requires both a Thai keyword (มีไหม, เหลือไหม, มีของ, หมดไหม) AND an English product type token (shirt, pants, jacket). Thai-only messages never have English tokens, so every Thai stock question becomes product_info. This is the largest single gap. System B reaches F1 = 0.95 on Thai stock_check.

### store_policy
System A = **0.95** vs System B = **0.90** — the ONE intent where rules beat the LLM. Policy keywords (shipping, return, payment, ส่ง, จัดส่ง, จ่าย, ชำระ) are so explicit and unambiguous that hardcoded rules are sufficient. The LLM occasionally over-classifies edge cases as other intents.

### out_of_scope
System A Thai F1 = 0.82, System B = 0.95. The old system gets Thai out_of_scope partially right by fallthrough (no keywords match → OUT_OF_SCOPE), but fails on "อยากซื้อแล็ปท็อปราคาถูก" because "ราคา" is in its Thai product token list. The LLM understands the full sentence is about a laptop, not clothing.

---

## Conclusion

| Claim | Evidence |
|---|---|
| The hybrid upgrade improves intent classification | Combined Macro F1: 0.705 → 0.920 (+21.5%) |
| The improvement is statistically significant | McNemar p = 0.0003 (far below 0.05) |
| The primary gain is Thai language coverage | Thai Macro F1: 0.567 → 0.921 (+35.4%) |
| The hybrid also helps on English | English Macro F1: 0.816 → 0.919 (+10.3%) |
| Rule-based still wins on one specific intent | store_policy F1: 0.95 (rules) vs 0.90 (hybrid) |
| English-only improvement needs more data to prove | English McNemar p = 0.1306 (not yet significant) |

**Overall verdict:** The upgrade to a hybrid rules+LLM system is strongly justified. The improvement is real (not chance), large in magnitude, and especially critical for Thai-language users where the old system was effectively broken for stock_check queries.
