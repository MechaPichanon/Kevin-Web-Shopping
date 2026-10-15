# Thai retrieval evaluation — RAG fixes (2026-10-10)

Script: `retrieval_eval_th.py` · Dataset: `retrieval_eval_th.json` (25 in-scope Thai queries + 4 out-of-scope) · Raw: `reports/retrieval_eval_th_<stage>.json`

Calls `retrieval.retrieve_products()` directly (no LLM), so this measures only the RAG step. Expected answers are sets of `product_id`s from the live catalogue (any polo counts for "แนะนำเสื้อโปโล"). **Hit@k** = a correct product appears in the top k. **MRR** = mean of 1/rank of the first correct product. Out-of-scope queries pass when retrieval returns nothing.

> **Caveat:** this dataset was written by the same person (Claude) who diagnosed the failures, and the Thai words added in stage C were chosen while looking at these failures. The 100% in stage C is therefore optimistic. The 20-question end-to-end test (`llm_eval_ollama_qwen2.5-7b_after_fixes_results.md`) was written beforehand and is the independent check.

## Results by stage

| Stage | Hit@1 | Hit@3 | MRR | Out-of-scope empty |
|---|---|---|---|---|
| Baseline (before any fix) | 0.56 | 0.68 | 0.61 | 0/4 |
| A — HIGH-1: full product text + Thai re-embedded | 0.56 | 0.64 | 0.59 | 1/4 |
| B — + HIGH-2: embed raw Thai query | 0.80 | 0.84 | 0.82 | 1/4 |
| C — + type filter (polo/shorts, pant=pants) + Thai words | 1.00 | 1.00 | 1.00 | 1/4 |

**What each stage shows**

- **A alone barely changes anything (Hit@3 0.68 → 0.64).** The product side improved, but the query side still embedded only the word "shirt", so the better product text was never compared against the real question.
- **B is the main fix (Hit@1 0.56 → 0.80).** bge-m3 is multilingual. Once it sees the original Thai, polo, linen, floral and Monstera queries all work.
- **C fixes what's left: shorts and colours.** "กางเกง" became `pants`, but the admin page saves the category as `pant`. The hard type filter therefore dropped both Shorts products. Thai colour words (เหลือง, น้ำตาล) weren't translated either.
- **Out-of-scope queries still retrieve products (1/4 empty).** Out-of-scope is mainly decided by the intent classifier and its rule pre-filters, not by retrieval, but they don't catch everything. In the end-to-end test Q18 (homework) was caught, while Q17 (shoes) was classified `product_info` and went through retrieval. The LLM still said "no shoes", but with stage B the raw Thai "ผ้าใบไหม" now pulls silk products to the top (see `llm_eval_ollama_qwen2.5-7b_after_fixes_results.md`, Q17).

## Per query (top-3 product names)

| # | Query | Expected | Baseline | After (C) |
|---|---|---|---|---|
| 1 | แนะนำเสื้อโปโลหน่อย | polo (any) | ✗ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo |
| 2 | มีโปโลถักไหม | knit polos | ✓ Folk Motif Knit Polo, Solid Polo, Corn Polo | ✓ Crochet Knit Polo Shirt, Folk Motif Knit Polo, Pinstripe Knit Polo |
| 3 | โปโลคอซิป | Zip Collar Polo | ✓ Zip Collar Polo, Pinstripe Knit Polo, Crochet Knit Polo Shirt | ✓ Zip Collar Polo, Crochet Knit Polo Shirt, Pinstripe Knit Polo |
| 4 | โปโลลายริ้ว | striped polos | ✓ Ribbed Polo, Star Stitch Knit Polo, Solid Polo | ✓ Ribbed Polo, Multi-Stripe Knit Polo, Spaced Stripe Knit Polo |
| 5 | โปโลข้าวโพด | Corn Polo | ✓ Corn Polo, Ribbed Polo, Folk Motif Knit Polo | ✓ Corn Polo, Ribbed Polo, Pebble Knit Polo |
| 6 | โปโลสีพื้นสีดำ | Solid Polo | ✓ Heavyweight Shorts, Solid Polo, Silk Pants | ✓ Solid Polo, Crochet Knit Polo Shirt, Ribbed Polo |
| 7 | โปโลลายดาว | Star Stitch Knit Polo | ✓ Star Stitch Knit Polo, Pebble Knit Polo, Ribbed Polo | ✓ Star Stitch Knit Polo, Ribbed Polo, Pebble Knit Polo |
| 8 | มีกางเกงขาสั้นอะไรบ้าง | shorts | ✗ Silk Pants | ✓ Heavyweight Shorts, Swim Shorts, Silk Pants |
| 9 | กางเกงว่ายน้ำ | Swim Shorts | ✗ Silk Pants | ✓ Swim Shorts, Silk Pants, Heavyweight Shorts |
| 10 | ชุดว่ายน้ำ | Swim Shorts | ✓ Swim Shorts, Pebble Knit Polo, Lace Panel Knit Polo | ✓ Swim Shorts, Abstract Swirl Silk Shirt, Silk Pants |
| 11 | อยากได้กางเกงผ้าไหม | Silk Pants | ✓ Silk Pants | ✓ Silk Pants, Heavyweight Shorts, Swim Shorts |
| 12 | กางเกงขายาว | Silk Pants | ✓ Silk Pants | ✓ Silk Pants, Heavyweight Shorts, Swim Shorts |
| 13 | มีกางเกงอะไรบ้าง | any pants | ✓ Silk Pants | ✓ Silk Pants, Heavyweight Shorts, Swim Shorts |
| 14 | เสื้อเชิ้ตลินิน | Linen Shirt | ✓ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Linen Shirt, Fern Line Silk Shirt, shirt test |
| 15 | เสื้อเชิ้ตลินินสีดำไซส์ M | Linen Shirt | ✗ Monstera Silk Shirt, shirt test, Solid Polo | ✓ Linen Shirt, Monstera Silk Shirt, Crochet Knit Polo Shirt |
| 16 | เสื้อเชิ้ตผ้าไหมลายดอก | floral silk shirt | ✗ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ floral silk shirt, Leaf Shadow Silk Shirt, shirt test |
| 17 | เสื้อเชิ้ตไหมลายมอนสเตอร่า | Monstera Silk Shirt | ✗ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Monstera Silk Shirt, Leaf Shadow Silk Shirt, Abstract Swirl Silk Shirt |
| 18 | เชิ้ตลายใบไม้ ใส่ไปทะเล | botanical silk shirts | ✓ Leaf Shadow Silk Shirt, Fern Line Silk Shirt, Monstera Silk Shirt | ✓ Leaf Shadow Silk Shirt, Fern Line Silk Shirt, Monstera Silk Shirt |
| 19 | เสื้อเชิ้ตผ้าไหม | silk shirts | ✓ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Leaf Shadow Silk Shirt, shirt test, floral silk shirt |
| 20 | อยากได้เสื้อยืดสีดำ | Heavyweight T-Shirt | ✓ Heavyweight T-Shirt, Heavyweight Shorts | ✓ Heavyweight T-Shirt, Heavyweight Shorts |
| 21 | เสื้อยืดหนาๆ | Heavyweight T-Shirt | ✓ Heavyweight T-Shirt, Heavyweight Shorts | ✓ Heavyweight T-Shirt, Heavyweight Shorts |
| 22 | เสื้อสีเหลือง | Multi-Stripe Knit Polo (only yellow top) | ✗ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Multi-Stripe Knit Polo, shirt test, floral silk shirt |
| 23 | เสื้อสีน้ำตาล | brown tops | ✓ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Solid Polo, Abstract Swirl Silk Shirt, shirt test |
| 24 | เสื้อเชิ้ตสีแดง | red shirts | ✗ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ floral silk shirt, Fern Line Silk Shirt, Chain Loop Knit Polo |
| 25 | เสื้อผ้าเบาๆ ใส่สบาย อากาศร้อน | linen/silk shirts | ✓ shirt test, Linen Shirt, Abstract Swirl Silk Shirt | ✓ Linen Shirt, shirt test, Leaf Shadow Silk Shirt |
| 26 | ขายรองเท้าผ้าใบไหม | out of scope | ✗ Leaf Shadow Silk Shirt, Spaced Stripe Knit Polo, Linen Shirt | ✗ Silk Pants, Leaf Shadow Silk Shirt, shirt test |
| 27 | หุ้นวันนี้เป็นไง | out of scope | ✗ Zip Collar Polo, Leaf Shadow Silk Shirt, shirt test | ✗ Leaf Shadow Silk Shirt, shirt test, Abstract Swirl Silk Shirt |
| 28 | ขอสูตรทำต้มยำ | out of scope | ✗ Monstera Silk Shirt, Leaf Shadow Silk Shirt, Pebble Knit Polo | ✓ (none) |
| 29 | มีโทรศัพท์มือถือขายไหม | out of scope | ✗ Pebble Knit Polo, Swim Shorts, Zip Collar Polo | ✗ Pebble Knit Polo, Solid Polo, floral silk shirt |

## Root causes found

1. **Thai text was thrown away before embedding** (`_retrieve_products_core`). `_tokenize` keeps only `[a-z0-9]`, and the query vector was built from those tokens alone. "แนะนำเสื้อโปโลหน่อย" was embedded as just `shirt`.
2. **Admin-created products had thin embeddings** (`productControllers.js buildChunkText`). The text came from `variants[0]` only (one colour, size and price) and had no Thai. Corn Polo's chunk said "Sizes: L, Colors: Grey"; now it lists L/M/XL and Green Silk/Grey/White plus all the Thai fields.
3. **The type filter only knew shirt/pants/jacket/tshirt**, and needed an exact match on `pants`, while the data says `pant`.
4. **The Thai→English dictionary had 16 words** and was missing โปโล, เชิ้ต, ลินิน, ขาสั้น and most colours. Bare `ไหม` (silk) is deliberately left out, because it is also the question particle in "มีไหม".

## Data issues noticed (not changed)

- `Chain Loop Knit Polo` has category `shirt` (it's a polo). It still shows up for polo queries because its name contains "Polo".
- Size chart: `Monstera Silk Shirt` L has chest 44–43, and `Heavyweight Shorts` 32 has waist 32–39. Both look like typos.
- `shirt test` (เชิ้ต เทส) is an active test product, and it often takes one of the top-3 slots for shirt queries.
## 2026-10-15 — "set" category (live Supabase DB, Ollama bge-m3)

Added `ชุดเซ็ต`/`เซ็ต` → `set` to `_THAI_TO_EN` and `set`/`sets` to `_TYPE_TARGETS` (bare `ชุด` left out: `ชุดว่ายน้ำ` = swimwear). Added Q30–Q32 (expected: the first set product, `P1792064357762`, live DB only).

| Run | In-scope | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| `set_before` (Q1–Q29, old code) | 25 | 1.000 | 1.000 | 1.000 |
| `set_after` (Q1–Q32, new code) | 28 | 1.000 | 1.000 | 1.000 |

Before the change, "อยากได้เซ็ตเสื้อกับกางเกง" didn't return the set at all (top-3: Silk Pants, Chain Loop Knit Polo, Crochet Knit Polo Shirt); after, the set is #1. Q10 `ชุดว่ายน้ำ` still → Swim Shorts. The data issues listed above were fixed on the live DB on 2026-10-15 (Chain Loop → polo, size charts rewritten, test products removed in the earlier wipe).
