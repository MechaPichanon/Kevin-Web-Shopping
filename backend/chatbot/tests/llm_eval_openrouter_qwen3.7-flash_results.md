# LLM evaluation — OpenRouter `qwen/qwen3.7-flash`, 3 runs

Runs: 2026-10-12 08:42:40, 2026-10-12 08:52:32, 2026-10-12 09:01:16 · Script: `llm_model_eval.py` · Raw: `reports/llm_eval_openrouter_qwen3.7-flash_run{1,2,3}.json`

Same 20 questions, same code and same grading as the baseline `llm_eval_ollama_qwen2.5-7b_v2_baseline_results.md`. The only change is the LLM: `OPENROUTER_API_KEY` set, `OPENROUTER_CHAT_MODEL=qwen/qwen3.7-flash` (both the chat reply and the intent classifier go through `llm_client.py`). Embeddings are still local bge-m3. The model's default reasoning ("thinking") is on — `llm_client.py` sends no reasoning setting.

Expected answers were re-checked against the live DB on 2026-10-12 (prices, colours, size↔colour pairs, stock, discount codes, store policies): no changes since 2026-10-10.

**Grading:** ✓ = 1 · ◐ = 0.5 (right core fact, wrong or missing detail, or wrong language) · ✗ = 0. **Cause:** *Retrieval* = wrong products retrieved; *Prompt* = fact not usable in the prompt; *LLM* = fact in the prompt, model got it wrong. Mixing ครับ/ค่ะ in one Thai reply is noted but not graded.

## Summary

| | Run 1 | Run 2 | Run 3 | **Mean** |
|---|---|---|---|---|
| **Overall (/20)** | 19 | 19 | 19.5 | **19.17** |
| Thai (/10) | 9 | 9 | 9.5 | 9.17 |
| English (/10) | 10 | 10 | 10 | 10.00 |
| Replies with Chinese/Japanese/Korean/Arabic text | 0 | 0 | 0 | 0 |
| Thai replies mixing ครับ and ค่ะ | 1 [7] | 2 [7, 19] | 3 [3, 11, 19] | 2.0 |
| Avg latency | 28.8s | 29.6s | 26.2s | 28.2s |

## Compared with the baseline (local Ollama `qwen2.5:7b`)

| | qwen2.5:7b (local) | qwen3.7-flash (OpenRouter) | Change |
|---|---|---|---|
| **Overall, 3-run mean (/20)** | 15.33 | **19.17** | +3.84 |
| Thai (/10) | 5.50 | 9.17 | +3.67 |
| English (/10) | 9.83 | 10.00 | +0.17 |
| Run range (/20) | 14.5–16.5 | 19–19.5 | |
| Foreign-script replies per run | 3.3 | 0 | −3.3 |
| Avg latency | 3.7s | 28.2s | ~7.6× slower |
| Cost | free (local GPU) | ≈ US$0.006 per 20-question run (≈ US$0.0003 per question) | |

Cost is from the key's usage counter: US$0.0194 total after all checks, which includes 3 runs (≈ 63 /chat calls, each with an intent call + a reply call) plus a few manual test calls.

**Findings**

1. **A clear win on quality.** The gap (+3.8 points) is far larger than the ~2-point run-to-run spread, and the worst qwen3.7-flash run (19) beats the best qwen2.5 run (16.5).
2. **Every qwen2.5 weakness on Thai is gone:** no foreign-script text in any reply (qwen2.5: 3.3 per run), size↔colour pairs right (Q5, Q9, Q19), and the cm→inch size question Q11 right in all 3 runs (qwen2.5: never).
3. **What's left:** Q17 (Retrieval + LLM — 'ผ้าใบ' pulls silk products and the model recommends the out-of-stock Silk Pants and the test product 'shirt test'), one colour slip each in Q1/Q3, and style: occasional ครับ/ค่ะ mixing and small Thai typos.
4. **Latency is the cost:** ~28s per reply vs 3.7s. qwen3.7-flash reasons ("thinks") by default: a one-off check gave 404 of 452 output tokens as reasoning, 8.4s; the same call with `reasoning: {enabled: false}` took 1.4s with 30 tokens. Whether quality holds with reasoning off is untested — it needs its own 3-run eval before changing `llm_client.py`.
5. **Catalogue data:** the active product 'shirt test' (created 2026-09-27) shows up in answers (Q9, Q17). It should be deactivated in the admin if it isn't a real product.

## Results

| # | Lang | Type | Question | Run 1 | Run 2 | Run 3 | Cause |
|---|---|---|---|---|---|---|---|
| 1 | TH | product | แนะนำเสื้อโปโลหน่อย | ✓ | ◐ | ✓ | LLM |
| 2 | EN | product | Do you have linen shirts? | ✓ | ✓ | ✓ | — |
| 3 | TH | product | มีกางเกงขาสั้นอะไรบ้าง | ◐ | ✓ | ✓ | LLM |
| 4 | EN | product | What's the cheapest shirt you sell? | ✓ | ✓ | ✓ | — |
| 5 | TH | product | อยากได้เสื้อยืดสีดำ | ✓ | ✓ | ✓ | — |
| 6 | EN | product | Compare the Linen Shirt and the Heavyweight T-Shirt | ✓ | ✓ | ✓ | — |
| 7 | TH | stock | กางเกงผ้าไหมมีของไหม | ✓ | ✓ | ✓ | — |
| 8 | EN | stock | Is the Linen Shirt available in white size M? | ✓ | ✓ | ✓ | — |
| 9 | TH | stock | เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม | ✓ | ✓ | ✓ | — |
| 10 | EN | stock | What colours do the Swim Shorts come in? | ✓ | ✓ | ✓ | — |
| 11 | TH | size | รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร | ✓ | ✓ | ✓ | — |
| 12 | EN | size | My chest is 49 inches, which size Heavyweight T-Shirt should I get? | ✓ | ✓ | ✓ | — |
| 13 | TH | policy | ค่าส่งเท่าไหร่ ส่งฟรีไหม | ✓ | ✓ | ✓ | — |
| 14 | EN | policy | Can I return a shirt if it doesn't fit? | ✓ | ✓ | ✓ | — |
| 15 | TH | policy | จ่ายเงินช่องทางไหนได้บ้าง | ✓ | ✓ | ✓ | — |
| 16 | EN | policy | Do you have any discount codes right now? | ✓ | ✓ | ✓ | — |
| 17 | TH | oos | ขายรองเท้าผ้าใบไหม | ◐ | ◐ | ◐ | Retrieval + LLM |
| 18 | EN | oos | Can you help me write my homework essay? | ✓ | ✓ | ✓ | — |
| 19 | TH | mixed | มี polo สี white size XL ไหม | ✓ | ✓ | ✓ | — |
| 20 | EN | mixed | I want a shirt for the beach, something light, under 300 baht | ✓ | ✓ | ✓ | — |

## Question-by-question

### Q1 · TH · product · ✓ ◐ ✓

**Question:** แนะนำเสื้อโปโลหน่อย

**Correct answer must:** Lists real polos from the catalogue (e.g. Solid Polo, Ribbed Polo, Corn Polo), price ~200–250 THB; no invented products

**LLM actually answered — run 1** (✓, 38.39s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> สวัสดีค่ะ! ทางร้านมีเสื้อโปโลแขนสั้นให้เลือก 3 รุ่น ราคาค่อนข้างเท่ากันที่ **200 บาท** ต่อตัวค่ะ แต่ละรุ่นมีเท็กซ์เจอร์ของผ้าและจำนวนสีแตกต่างกันเล็กน้อย มาดูรายละเอียดกันนะคะ:
>
> - **Ribbed Polo (โปโลริ้ว)**: เนื้อผ้ามีความละเอียดเป็นริ้วๆ สัมผัสนุ่มสบาย เพิ่มมิติให้ดีไซน์แบบเรียบสะอาดตา มีสีให้เลือก **ขาว, ครีม, ดำ, น้ำเงิน, ฟ้า, เขียวขี้ม้า, แดง** พร้อมไซส์ **L, M, XL** เหมาะสำหรับใส่ประจำวันและลุคแคชชวล
> - **Crochet Knit Polo Shirt (โปโลลายถัก)**: ทรงสลิมฟิตพร้อมลวดลายถักโครเชต์ที่โดดเด่น ใส่แล้วได้ลุคทันสมัยมีเอกลักษณ์ มีสีให้เลือก **ครีม, ดำ, น้ำเงิน, เขียว** พร้อมไซส์ **L, M, XL** เหมาะกับคนที่ชอบสไตล์แฟชั่นที่มีรายละเอียด
> - **Solid Polo (โปโลพื้น)**: ดีไซน์สีพื้นเรียบง่าย ไม่มีลวดลาย แมตช์เข้ากันได้ง่ายทุกชุด มีสีให้เลือก **ขาว, ครีม, ดำ, น้ำตาล, เขียวมะกอก, เขียวใบสน, เทา** พร้อมไซส์ **L, M, XL** เป็นตัวเลือกคลาสสิกที่ใช้งานได้หลากหลายโอกาส
>
> ทั้ง 3 รุ่นเป็นแขนสั้น หมดสต็อกสีบางเฉดตามไซส์อยู่แล้วค่ะ หากคุณสนใจเจาะรุ่นใด หรืออยากได้คำแนะนำในการจับคู่สี บอกมาได้เลยนะคะ เดี๋ยวทางร้านช่วยเช็คสต็อกและจัดให้ทันทีค่ะ!

**LLM actually answered — run 2** (◐, 52.64s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> ยินดีค่ะ! ทางร้านมีเสื้อโปโลแขนสั้น 3 รุ่นให้เลือก โดยทุกตัวราคา **200 THB** และมีขนาด **L, M, XL** พร้อมสีหลากหลายค่ะ:
>
> - **Ribbed Polo (โปโลริ้ว)** เนื้อผ้าริ้วละเอียดสัมผัสนุ่ม สไตล์คลาสสิกใส่สบายทุกวัน มาในสี **ดำ น้ำเงิน ครีม เขียวขี้ม้า ฟ้า แดง ขาว** (คู่สีและไซส์มีหลายตัวเลือกตามสต็อกค่ะ)
> - **Crochet Knit Polo Shirt (โปโลลายถัก)** ทรงสลิมโดดเด่นด้วยลายถักโครเชต์บนตัวเสื้อและคอปก เพิ่มเท็กซ์เจอร์ให้ลุคทันสมัย มีสี **ขาว ครีม ดำ น้ำเงิน**
> - **Solid Polo (โปโลพื้น)** ดีไซน์สีพื้นเรียบสะอาดตา ไม่ลวดลาย แมตช์เสื้อผ้าง่ายสุด รองรับสี **เทา ดำ ครีม น้ำตาล เขียวมะกอก เขียวใบสน ขาว**
>
> ลองดูว่าแบบไหนตรงกับสไตล์ที่ชอบที่สุดไหมคะ? บอกไซส์และสีที่ต้องการมาได้เลยนะ เดี๋ยวทางร้านช่วยเช็กของให้ทันทีค่ะ 😊

**LLM actually answered — run 3** (✓, 39.26s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> ยินดีครับ! ร้านมียอดสินค้าเสื้อโปโล 3 รุ่นให้เลือก โดยทุกรุ่นเป็นแขนสั้นและราคาเท่ากันที่ **200 บาท** ครับ สามารถเลือกตามสไตล์ที่ต้องการได้เลย:
>
> - **Ribbed Polo (โปโลริ้ว)** เนื้อผ้าเนื้อริบละเอียด สัมผัสนุ่มใส่สบาย เหมาะสำหรับใส่ทุกวัน มีสีให้เลือกทั้ง **ดำ, น้ำเงิน, ครีม, เขียวขี้ม้า, แดง, ฟ้า และขาว** ในไซส์ **M, L, XL**
> - **Crochet Knit Polo Shirt (โปโลลายถัก)** ทรงสลิมพอดีตัว โดดเด่นด้วยลายถักโครเชต์ เพิ่มเท็กซ์เจอร์ให้น่าสนใจ มีสี **ดำ, น้ำเงิน, ครีม และเขียว** ในไซส์ **M, L, XL**
> - **Solid Polo (โปโลพื้น)** ดีไซน์คลาสสิก สีเรียบไม่มีลวดลาย แมตช์ง่ายกับกางเกงหลายแบบ มีสี **ดำ, น้ำตาล, ครีม, เทา, เขียวมะกอก, เขียวใบสน และขาว** ในไซส์ **M, L, XL**
>
> ต้องการรุ่นไหน หรืออยากเช็คสี/ไซส์ที่มีคงไว้ไหมครับ? พิมพ์บอกมาได้เลย เดี๋ยวช่วยดูแลให้ครับ!

**Grade notes:** All runs list three real polos at 200 THB with correct sizes. Run 2 gives Crochet Knit Polo a white option it doesn't have and drops green (the same mistake qwen2.5 made). Runs 1 and 3 have every colour right. Cause: LLM.

### Q2 · EN · product · ✓ ✓ ✓

**Question:** Do you have linen shirts?

**Correct answer must:** Yes — Linen Shirt, 390 THB, Beige/Cream/White, M/L/XL

**LLM actually answered — run 1** (✓, 24.86s, intent `stock_check`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we have them in stock! You can grab the **Linen Shirt** priced at **390 THB**, and it’s currently available in these exact size and colour combinations:
> - **Linen Shirt**: **L – Beige** (45 left), **M – White** (45 left), and **XL – Cream** (45 left)
>
> Each option features a lightweight, breathable weave and a relaxed short-sleeve cut, ideal for staying cool all day. Let me know if you'd like to place an order or need help with sizing!

**LLM actually answered — run 2** (✓, 26.93s, intent `stock_check`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we definitely have them! Our **Linen Shirt** is a short-sleeve, lightweight top made from breathable fabric, perfect for staying cool and comfortable during warm days. Here are the exact size and color combinations currently in stock:
>
> - **L – Beige**: 45 left
> - **M – White**: 45 left
> - **XL – Cream**: 45 left
>
> All options are priced at **390 THB**. Just let me know which size and color you prefer, and I’ll gladly assist you!

**LLM actually answered — run 3** (✓, 19.26s, intent `stock_check`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do! Here’s exactly what’s currently in stock for our **Linen Shirt**:
> - **L – Beige**: 45 pieces left
> - **M – White**: 45 pieces left
> - **XL – Cream**: 45 pieces left
>
> Each shirt is priced at **390 THB** and features a **short sleeve**, lightweight breathable fabric, and a relaxed cut that’s perfect for everyday wear in warm weather. Let me know which size and color you prefer, and I’ll gladly help you get it ready!

**Grade notes:** All runs correct, and they now give the exact size↔colour pairs with stock (L Beige / M White / XL Cream, 45 each).

### Q3 · TH · product · ◐ ✓ ✓

**Question:** มีกางเกงขาสั้นอะไรบ้าง

**Correct answer must:** Heavyweight Shorts (150 THB) and Swim Shorts (200 THB)

**LLM actually answered — run 1** (◐, 37.79s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> สวัสดีค่ะ! ร้านมียากางเกงขาสั้นให้เลือกทั้งหมด 2 รุ่น ค่ะ รายละเอียดมีดังนี้ค่ะ:
>
> - **Heavyweight Shorts (กางเกงขาสั้นหนา)** ราคา **150 บาท**
>   - **ไซส์**: 32, 34, 36
>   - **สี**: ขาว, เทา, ดำ
>   - **คุณสมบัติ**: เนื้อผ้าหนาที่มีลวดลายถักเฉพาะตัว ดีไซน์มาพร้อมกับเอวยางยืดและเชือกผูกเพื่อความกระชับสวมใส่สบาย เหมาะแก่การแมตช์คู่กับเสื้อยืดหนาในคอลเลกชันเดียวกัน
>
> - **Swim Shorts (กางเกงขาสั้นว่ายน้ำ)** ราคา **200 บาท**
>   - **ไซส์**: 30
>   - **สี**: ดำ, ฟ้าอมเขียว, เขียว, กรมท่า, ชมพู, แดง, ฟ้า, ขาว, เหลือง
>   - **คุณสมบัติ**: ตัวผ้าเบา สบายตัว พร้อมเอวยางยืดและเชือกผูกปรับระดับได้นะคะ ออกแบบมาให้ลงเล่นน้ำหรือพักผ่อนริมชายหาด/สระว่ายน้ำได้อย่างเต็มที่
>
> หากสนใจสั่งไซส์ไหนหรือมีข้อสงสัย เพิ่มเติมแจ้งได้เลยค่ะ ยินดีให้บริการค่ะ!

**LLM actually answered — run 2** (✓, 31.48s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> ยินดีเลยครับ ในร้านเรามีกางเกงขาสั้นให้เลือกทั้งหมด 2 แบบ ตามข้อมูลดังนี้ครับ:
>
> - **Heavyweight Shorts (กางเกงขาสั้นหนา)** ราคา **150 THB**
>   - ไซส์: **32, 34, 36**
>   - สี: **ดำ, เทา, ขาว** (มาในคู่สีเฉพาะไซส์: 32–ขาว, 34–เทา, 36–ดำ)
>   - ลักษณะพิเศษ: เนื้อผ้าหนาสไตล์ถักเท็กซ์เจอร์ มีเอวยางยืดพร้อมเชือกผูกปรับกระชับได้ ออกแบบมาให้เข้ากับชุดลำลองหรือสวมคู่กับเสื้อยืดหนักจากคอลเลกชันเดียวกันได้ลงตัว
>
> - **Swim Shorts (กางเกงขาสั้นว่ายน้ำ)** ราคา **200 THB**
>   - ไซส์: **30**
>   - สี: **ดำ, กรมท่า, ชมพู, ฟ้า, ฟ้าอมเขียว, เขียว, เขียวมะกอก, เหลือง, แดง, ขาว** (เลือกสีใดก็ได้ในไซส์ 30)
>   - ลักษณะพิเศษ: เนื้อผ้าบางเบาแห้งเร็ว มีเอวยางยืดและเชือกผูกปรับระดับความกระชับ เหมาะสำหรับกิจกรรมทางน้ำ เดินชายหาด หรือพักผ่อนริมสระ
>
> หากคุณต้องการทราบ Stock สี/ไซส์ที่ตรงใจ หรือต้องการคำแนะนำในการจับคู่อุปกรณ์เสริม บอกได้เลยนะครับ ยินดีช่วยเหลือครับ! 🛍️

**LLM actually answered — run 3** (✓, 36.55s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> มีกางเกงขาสั้นให้คุณเลือกทั้งหมด 2 รุ่นดังนี้ครับ:
>
> - **กางเกงขาสั้นหนา** - ราคา **150 THB**
>   - ดีไซน์มาพร้อมเอวยางยืดและเชือกผูกสำหรับปรับความกระชับ
>   - เนื้อผ้าหนาลายถักพิเศษ สามารถใส่คู่กับเสื้อยืดหนาเพื่อสร้างลุคเข้าชุดกันได้อย่างลงตัว
>   - ขนาด: 32, 34, 36
>   - สี: ดำ, เทา, ขาว
>
> - **กางเกงขาสั้นว่ายน้ำ** - ราคา **200 THB**
>   - โครงสร้างเบาสบาย เหมาะสำหรับการว่ายน้ำ เดินเล่นชายหาด หรือพักผ่อนริมสระ
>   - ใส่สบายด้วยเอวยางยืดและเชือกผูกที่ยึดเกาะมั่นคงขณะเคลื่อนไหว
>   - ขนาด: 30
>   - สี: ดำ, ขาว, ชมพู, กรมท่า, ฟ้า, ฟ้าอมเขียว, เขียว, เขียวมะกอก, เหลือง, แดง
>
> หากต้องการสอบถามรายละเอียดเพิ่มเติมหรือต้องการสั่งซื้อสินค้า แจ้งทางร้านได้เลยนะคะ ยินดีบริการค่ะ!

**Grade notes:** All runs name exactly the two real shorts, with prices, sizes and pairs correct, and none drag in Silk Pants (qwen2.5 did). Run 1 lists 9 of the 10 Swim Shorts colours (Olive missing) as if complete. Cause: LLM.

### Q4 · EN · product · ✓ ✓ ✓

**Question:** What's the cheapest shirt you sell?

**Correct answer must:** Silk shirts at 150 THB (e.g. Monstera / Fern Line / floral silk shirt); must not quote a lower price

**LLM actually answered — run 1** (✓, 19.75s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The most affordable shirt we carry is the **Leaf Shadow Silk Shirt**, priced at just **150 THB**. Here are the quick details:
>
> - **Size**: M
> - **Color**: Green
> - **Sleeve**: Short
> - **Style**: A lightweight silk design featuring overlapping leaves that create a soft shadow effect, giving it a calm look that pairs easily with everyday outfits.
>
> Let me know if you'd like help checking availability or placing an order!

**LLM actually answered — run 2** (✓, 18.0s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The cheapest shirt we carry is the **Leaf Shadow Silk Shirt**, available for just **150 THB**. Here are the details:
>
> - **Color:** Green
> - **Size:** M
> - **Sleeve Length:** Short
> - **Style:** Made from lightweight silk with a dense, overlapping leaf pattern that creates a soft shadow effect. Its calm and refined botanical design makes it effortless to style with most outfits.
>
> Let me know if you'd like to purchase this one or need help with anything else!

**LLM actually answered — run 3** (✓, 25.55s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The cheapest shirt we currently carry is the **Leaf Shadow Silk Shirt**, priced at just **150 THB**. Here are the details:
>
> - **Material**: Silk
> - **Sleeve**: Short
> - **Available Size**: M
> - **Color**: Green
> - **Design**: Features a densely layered leaf pattern that creates a soft, shadow-like effect for a calm and refined look. Its understated style makes it easy to pair with almost any outfit.
>
> Let me know if you'd like to see other styles or need help with anything else!

**Grade notes:** All runs correct: Leaf Shadow Silk Shirt, 150 THB, M / Green.

### Q5 · TH · product · ✓ ✓ ✓

**Question:** อยากได้เสื้อยืดสีดำ

**Correct answer must:** Heavyweight T-Shirt, Black (XL), 200 THB

**LLM actually answered — run 1** (✓, 34.29s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> สวัสดีค่ะ! สำหรับเสื้อยืดสีดำที่คุณต้องการคือ **เสื้อยืดหนา (Heavyweight T-Shirt)** ราคา **200 THB** นะคะ
> เนื่องจากสินค้ามีการกำหนดการจับคู่สีและไซส์ไว้ล่วงหน้า เสื้อยืดสีดำจึงมีให้เฉพาะ **ไซส์ XL** เท่านั้น โดยมีรายละเอียดดังนี้:
> - สไตล์: เสื้อยืดแขนสั้น
> - เนื้อผ้า & ดีไซน์: ผ้าหนาพิเศษ พร้อมเท็กซ์เจอร์ถักพื้นผิวและลวดลายกากบาท เพิ่มความอบอุ่นและให้ความรู้สึกเรียบเท่
> - สี: **ดำ** (ใช้ได้เฉพาะ **ไซส์ XL**)
> - ราคา: **200 THB**
>
> หากต้องการสั่งซื้อหรือสอบถามเพิ่มเติม แจ้งได้เลยนะคะ ยินดีดูแลให้ตลอดเลย! 😊

**LLM actually answered — run 2** (✓, 35.34s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> ทางร้านมี **Heavyweight T-Shirt (เสื้อยืดหนา)** สีดำให้คุณเลือกค่ะ! เสื้อตัวนี้ตัดจากเนื้อผ้าหนาพิเศษ พร้อมลายถักกากบาทที่ช่วยเพิ่มมิติให้ลุคดูทันสมัยและสวมใส่สบายค่ะ
>
> รายละเอียดสินค้า:
> - ราคา: **200 THB**
> - ขนาดและสี: สีดำจะจับคู่กับไซส์ **XL** เท่านั้น (ไซส์ M เป็นเทา, L เป็นขาว)
> - ดีไซน์: แขนสั้น เนื้อผ้าหนาพิเศษ พร้อมเท็กซ์เจอร์พื้นผิวละเอียด
> - จุดเด่น: ออกแบบมาเพื่อเพิ่มความอบอุ่น เหมาะสำหรับการสวมใส่ในอากาศเย็น พร้อมลุคเรียบง่ายแต่มีเอกลักษณ์
>
> หากต้องการสั่งซื้อไซส์ XL สีดำ หรือมีคำถามเพิ่มเติม แจ้งได้เลยนะคะ ยินดีช่วยเหลือค่ะ 😊

**LLM actually answered — run 3** (✓, 26.82s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> สวัสดีค่ะ! ทางร้านพอมีเสื้อยืดสีตรงกับที่คุณต้องการเลยค่ะ คือรุ่น:
>
> - **Heavyweight T-Shirt (เสื้อยืดหนา)**
>   - ราคา: **200 THB**
>   - สีและไซส์: **ดำ** (จัดสรรเฉพาะไซส์ XL) / ยังเหลือสีขาว (L) และ เทา (M) สำหรับไซส์อื่นค่ะ
>   - ไซส์รวม: **L, M, XL**
>   - แขน: **แขนสั้น**
>   - ดีไซน์และเนื้อผ้า: เสื้อยืดเนื้อผ้าหนาพิเศษ พร้อมเท็กซ์เจอร์ลายถักผสมลวดลายกากบาททั่วตัว ช่วยเพิ่มการกักเก็บความร้อนและความสบายในการสวมใส่ ให้ความรู้สึกเรียบเท่และมีเอกลักษณ์
>
> หากคุณสนใจไซส์ XL สีดำใบนี้ หรืออยากให้ช่วยเตรียมสินค้าไว้ให้ล่วงหน้า แจ้งได้เลยนะคะ ยินดีบริการค่ะ!

**Grade notes:** All runs correct: Heavyweight T-Shirt, black only in XL, 200 THB. Runs 2 and 3 also give the other pairs (M grey, L white) correctly. qwen2.5 got the pairing wrong in all 3 runs.

### Q6 · EN · product · ✓ ✓ ✓

**Question:** Compare the Linen Shirt and the Heavyweight T-Shirt

**Correct answer must:** Linen 390 THB vs Heavyweight T-Shirt 200 THB; colours/sizes correct

**LLM actually answered — run 1** (✓, 31.45s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> Here’s how the **Linen Shirt** and **Heavyweight T-Shirt** compare across price, material, sizing, and color options:
>
> - **Linen Shirt**
>   - **Price:** 390 THB
>   - **Material:** Lightweight linen fabric that is highly breathable and soft, ideal for warm weather
>   - **Sizes:** L, M, XL
>   - **Colors:** Beige, Cream, White
>   - Designed with a simple, relaxed cut for effortless everyday wear
>
> - **Heavyweight T-Shirt**
>   - **Price:** 200 THB
>   - **Material:** Thick heavyweight fabric with a distinctive textured knit and cross-shaped detailing, built for cooler weather
>   - **Sizes:** L, M, XL
>   - **Colors:** Black, Grey, White
>   - Adds subtle depth and character to a classic casual silhouette
>
> Let me know if you need help deciding on a size or want styling suggestions!

**LLM actually answered — run 2** (✓, 32.04s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> Here’s how the **Heavyweight T-Shirt** and **Linen Shirt** compare based on our current collection:
>
> - **Heavyweight T-Shirt** | 200 THB
>   - Fabric: Thick, textured knit with subtle cross-shaped detailing
>   - Seasonal fit: Built for cooler weather and added warmth
>   - Colors: **Black, Grey, White**
>   - Sizes: **L, M, XL**
>
> - **Linen Shirt** | 390 THB
>   - Fabric: Lightweight, soft linen woven for maximum airflow
>   - Seasonal fit: Designed for warm weather and relaxed everyday wear
>   - Colors: **Beige, Cream, White**
>   - Sizes: **L, M, XL**
>
> While both styles share the same **size** options, they cater to different seasons and feature distinct textures. The **Heavyweight T-Shirt** focuses on thickness and warmth at a lower **price**, whereas the **Linen Shirt** prioritizes breathability and a premium feel for hotter climates. Let me know which season or color preference you're shopping for!

**LLM actually answered — run 3** (✓, 29.32s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> Here’s how our **Heavyweight T-Shirt** and **Linen Shirt** stack up so you can pick the best option:
>
> - **Heavyweight T-Shirt** (**200 THB**)
>   - Fabric: Thicker heavyweight knit with a textured cross-pattern
>   - Sleeve: Short
>   - Sizes: L, M, XL
>   - Colors: Black, Grey, White
>   - Best for: Cooler weather and a cozy, distinctive casual look
>   - Color pairing: L with White, M with Grey, XL with Black
>
> - **Linen Shirt** (**390 THB**)
>   - Fabric: Lightweight, breathable linen for a soft, airy feel
>   - Sleeve: Short
>   - Sizes: L, M, XL
>   - Colors: Beige, Cream, White
>   - Best for: Warm weather and effortless everyday styling
>   - Color pairing: L with Beige, M with White, XL with Cream
>
> Both styles share the same **sizes**, but the **Heavyweight T-Shirt** is more budget-friendly and built for cool days, while the **Linen Shirt** comes at a higher price point and focuses on breathability for summer heat. Let me know which one fits your vibe!

**Grade notes:** All runs correct. Run 3 also lists the pinned size↔colour pairs for both products, correctly.

### Q7 · TH · stock · ✓ ✓ ✓

**Question:** กางเกงผ้าไหมมีของไหม

**Correct answer must:** Silk Pants are OUT OF STOCK (stock 0 on every variant) — must not say available

**LLM actually answered — run 1** (✓, 40.91s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> ขอโทษนะครับ ตอนนี้ **Silk Pants (กางเกงผ้าไหม)** ทุกไซซ์และสีที่บันทึกไว้กำลัง **หมดสต็อกชั่วคราว** ครับ โดยมีรายละเอียดดังนี้:
> - ไซซ์ 30 สี **ขาว**: หมด
> - ไซซ์ 32 สี **ครีม**, **เทา**: หมด
> - ไซซ์ 34 สี **ดำ**, **น้ำเงิน**, **เขียวมะกอก**: หมด
>
> หากคุณต้องการกางเกงที่ยังมีของพร้อมส่ง ร้านค้าขอแนะนำตัวเลือกเหล่านี้แทนครับ:
> - **Swim Shorts (กางเกงขาสั้นว่ายน้ำ)** - ราคา 200 THB - ไซซ์ 30 ทุกสี (ดำ, ฟ้า, เขียว, กรมท่า, เขียวมะกอก, ชมพู, แดง, ฟ้าอมเขียว, ขาว, เหลือง) เหลือประมาณ 67 ตัวต่อสี
> - **Heavyweight Shorts (กางเกงขาสั้นหนา)** - ราคา 150 THB - ไซซ์ 32 สี **ขาว** (26 ตัว), ไซซ์ 34 สี **เทา** (26 ตัว), ไซซ์ 36 สี **ดำ** (50 ตัว)
>
> สินค้ามีดีไซน์ใส่สบายประจำวัน พร้อมจัดส่งทันที หากสนใจไซซ์หรือสีใดเป็นพิเศษ แจ้งร้านได้เลยนะคะ ยินดีให้บริการครับ!

**LLM actually answered — run 2** (✓, 41.86s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> ขออภัยนะคะ ตอนนี้ **กางเกงผ้าไหม (Silk Pants)** ทุกไซส์และสีที่จัดเตรียมไว้ในระบบกำลัง **หมดสต็อก** ไปทั้งหมดค่ะ หากกำลังมองหากางเกงใส่สบายหรือราคาใกล้เคียง สามารถเลือกชมตัวเลือกที่มีพร้อมส่ง ดังนี้ค่ะ:
>
> - **กางเกงขาสั้นหนา (Heavyweight Shorts)** : ราคา **150 THB** มีเหลือในไซส์ **32** สี **ขาว**, ไซส์ **34** สี **เทา** และไซส์ **36** สี **ดำ**
> - **กางเกงขาสั้นว่ายน้ำ (Swim Shorts)** : ราคา **200 THB** มีครบทุกสีในไซส์ **30** (ดำ, ฟ้า, เขียว, กรมท่า, เขียวมะกอก, ชมพู, แดง, ฟ้าอมเขียว, ขาว, เหลือง)
>
> หากต้องการสอบถามรายละเอียดเพิ่มเติม หรือให้ทีมช่วยคัดสรรสินค้าตัวอื่นที่เหมาะสม แจ้งเราได้ยีนดีค่ะ ยินดีบริการเสมอครับ/ค่ะ!

**LLM actually answered — run 3** (✓, 31.5s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> ตอนนี้ **Silk Pants (กางเกงผ้าไหม)** กำลังไม่มีสินค้าในสต็อกครับ โดยทุกรุ่นและทุกสีที่เตรียมไว้มีสถานะดังนี้:
> - ขนาด 30 สีขาว: หมดสต็อก
> - ขนาด 32 สีครีม: หมดสต็อก
> - ขนาด 32 สีเทา: หมดสต็อก
> - ขนาด 34 สีดำ: หมดสต็อก
> - ขนาด 34 สีน้ำเงิน: หมดสต็อก
> - ขนาด 34 สีเขียวมะกอก: หมดสต็อก
>
> หากคุณต้องการกางเกงขายาวเนื้อผ้าเบาหรือรอสินค้าเข้ามาใหม่ สามารถแจ้งกลับได้เลยครับ หรือหากคุณสนใจรุ่นอื่นอย่าง **Heavyweight Shorts** (150 THB) หรือ **Swim Shorts** (200 THB) ที่ยังมีจำนวนจำกัดในสต็อก ยินดีช่วยเช็กและจัดออเดอร์ให้ทันทีครับ! 😊

**Grade notes:** All runs say Silk Pants are out of stock. Runs 1 and 3 list all six size/colour variants as sold out, correctly. Alternatives (Heavyweight Shorts, Swim Shorts) have correct pairs and stock. Runs 1 and 2 mix ครับ and ค่ะ in one reply (style only, not graded).

### Q8 · EN · stock · ✓ ✓ ✓

**Question:** Is the Linen Shirt available in white size M?

**Correct answer must:** Yes — White/M in stock (45)

**LLM actually answered — run 1** (✓, 23.65s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, the **Linen Shirt** in **size M** and **white** is currently in stock! There are **45 pieces** available for that exact combination.
>
> Here’s what you’ll get with this item:
> - **Fabric & Sleeve:** Lightweight, breathable linen with a short-sleeve cut
> - **Style:** Simple, relaxed design made for comfortable everyday wear in warm weather
> - **Price:** 390 THB
>
> Let me know if you'd like to add it to your order or need help with anything else!

**LLM actually answered — run 2** (✓, 24.39s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, that combination is currently in stock! Here are the details:
> - **Linen Shirt** in **Size M** and **White**: 45 pieces remaining
>
> Let me know if you'd like to place an order or need help with anything else!

**LLM actually answered — run 3** (✓, 26.72s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, the **Linen Shirt** in size **M** and color **White** is in stock, with 45 units currently available. Here are the key details:
> - **Price**: 390 THB
> - **Sleeve**: Short sleeve
> - **Features**: Lightweight, breathable linen fabric for a soft, comfortable feel; simple relaxed design perfect for everyday warm-weather wear.
>
> Let me know if you’d like to proceed with your purchase or need help with anything else!

**Grade notes:** All runs correct: White/M in stock, 45.

### Q9 · TH · stock · ✓ ✓ ✓

**Question:** เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม

**Correct answer must:** No black Linen Shirt exists (only Beige/Cream/White) — must say not available

**LLM actually answered — run 1** (✓, 31.21s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> ขออภัยครับ ตอนนี้ทางร้านไม่มี **เสื้อเชิ้ตลินิน สีดำ** ไซส์ M ครับ แต่มีรุ่นที่ตรงตามไซส์และคุณสมบัติใกล้เคียงที่สุดดังนี้:
> - **Linen Shirt** ไซส์ **M** สี **White** เหลือ **45 ตัว** (ราคา **390 THB**)
>
> รุ่นนี้ผลิตจากผ้าลินินน้ำหนักเบา ระบายอากาศดี สวมใส่สบายและดีไซน์เรียบง่าย แมตช์ออกได้หลากหลายโอกาสเลยครับ หากต้องการสินค้่าชิ้นนี้หรืออยากสอบถามสีอื่นๆ เพิ่มเติม แจ้งแอดมินได้เลยนะครับ ยินดีให้บริการครับ!

**LLM actually answered — run 2** (✓, 48.25s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> ร้านเราไม่มีเสื้อเชิ้ตลินินสีดำไซส์ M ค่ะ เนื่องจาก **เสื้อเชิ้ตลินิน (Linen Shirt)** มีให้เลือกเพียงสี **เบจ**, **ครีม** และ **ขาว** เท่านั้นค่ะ อย่างไรก็ตาม สำหรับไซส์ **M** ปัจจุบันยังมีสี **ขาว** อยู่ค่ะ โดยมีรายละเอียดดังนี้:
> - **เสื้อเชิ้ตลินิน (Linen Shirt)** ไซส์ **M** สี **ขาว**: เหลือ **45 ตัว** ราคา **390 THB**
>
> หากต้องการเปลี่ยนไซส์หรือสไตล์อื่น สามารถพิจารณาตัวเลือกด้านล่างแทนได้นะคะ:
> - **เสื้อเชิ้ตลินิน (Linen Shirt)**: ไซส์ **L** สี **เบจ** (เหลือ **45 ตัว**), ไซส์ **XL** สี **ครีม** (เหลือ **45 ตัว**)
> - **เสื้อเชิ้ตไหม (Leaf Shadow Silk Shirt)**: ไซส์ **M** สี **เขียว** (เหลือ **67 ตัว**)
> - **เสื้อเชิ้ตไหมลายทาง (shirt test)**: ไซส์ **L** สี **เทา** / ไซส์ **M** สี **ชมพู** (เหลือไซส์ละ **12 ตัว**)
>
> ยินดีช่วยตรวจสอบหรือสรุปยอดสั่งซื้อให้ได้เลยค่ะ!

**LLM actually answered — run 3** (✓, 18.19s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> ตอนนี้ทางร้านยังไม่มี**เสื้อเชิ้ตลินินสีดำไซส์ M** ครับ แต่มีตัวเลือกที่ใกล้เคียงที่สุดคือ **เสื้อเชิ้ตลินิน** ในไซส์ **M** สี **ขาว** คงเหลือ **45 ตัว** พร้อมจัดส่งครับ
>
> หากต้องการพิจารณารุ่นอื่นที่พร้อมสต็อก สามารถดูรายละเอียดได้ตามนี้:
> - **เสื้อเชิ้ตลินิน** ไซส์ **L** สี **เบจ** (คงเหลือ 45 ตัว)
> - **เสื้อเชิ้ตลินิน** ไซส์ **XL** สี **ครีม** (คงเหลือ 45 ตัว)
>
> หากคุณยังอยากได้สีโทนสว่างหรือต้องการดูสินค้าหมวดอื่นๆ แจ้งทางเราก่อนได้นะครับ ยินดีช่วยเหลือและแนะนำขนาดที่เหมาะสมให้คุณครับ

**Grade notes:** All runs say there is no black Linen Shirt and offer White/M (45) instead. Run 2 also explains that the only colours are beige/cream/white. qwen2.5 got the pairing wrong in all 3 runs.

### Q10 · EN · stock · ✓ ✓ ✓

**Question:** What colours do the Swim Shorts come in?

**Correct answer must:** 10 colours: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, Yellow; size 30 only

**LLM actually answered — run 1** (✓, 19.95s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The **Swim Shorts** are available in the following colors:
> - **Black**
> - **Cyan**
> - **Green**
> - **Navy**
> - **Olive**
> - **Pink**
> - **Red**
> - **Sky Blue**
> - **White**
> - **Yellow**
>
> They are currently offered in size **30** at **200 THB**. Let me know if you'd like help picking a color or browsing our other styles!

**LLM actually answered — run 2** (✓, 13.37s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The **Swim Shorts** are available in the following colors:
> - **Black**
> - **Cyan**
> - **Green**
> - **Navy**
> - **Olive**
> - **Pink**
> - **Red**
> - **Sky Blue**
> - **White**
> - **Yellow**
>
> All options come in size **30**. Let me know if you'd like help checking availability for a specific color or have any other questions!

**LLM actually answered — run 3** (✓, 27.08s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The **Swim Shorts** come in a variety of shades. They are available in:
> - **Black**
> - **Cyan**
> - **Green**
> - **Navy**
> - **Olive**
> - **Pink**
> - **Red**
> - **Sky Blue**
> - **White**
> - **Yellow**
>
> Each color option is offered in size **30**. Let me know if you'd like help checking availability or placing an order!

**Grade notes:** All runs list all 10 colours, size 30 only.

### Q11 · TH · size · ✓ ✓ ✓

**Question:** รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร

**Correct answer must:** Size L — 114 cm ≈ 44.9 in, chart is in inches (L = chest 44–46)

**LLM actually answered — run 1** (✓, 35.33s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> รอบอกของคุณวัดได้ประมาณ **44.9 นิ้ว** (114 ซม.) ซึ่งตรงกับไซส์ **L** ของ **เสื้อเชิ้ตลินิน** ครับ
>
> - ขนาดแนะนำ: ไซส์ **L** (รอบอก **44.0–46.0 นิ้ว**)
> - ราคา: **390 บาท**
> - สีที่มีจำหน่าย: **เบจ**, **ครีม**, **ขาว**
>
> หากสนใจสั่งซื้อหรือต้องการข้อมูลการจัดส่งเพิ่มเติม แจ้งได้เลยครับ ยินดีให้บริการ!

**LLM actually answered — run 2** (✓, 24.5s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> จากขนาดรอบอก 114 ซม. (ประมาณ 45 นิ้ว) แนะนำให้เลือกไซส์ **L** สำหรับ **เสื้อเชิ้ตลินิน** ค่ะ โดยตรงกับช่วงรอบอก 44.0–46.0 นิ้วในตารางวัดขนาดค่ะ
>
> รายละเอียดสำหรับไซส์ **L**:
> - สี: **เบจ**
> - ราคา: **390 THB**
> - แขน: **สั้น**
> - ลักษณะผ้า: เนื้อเบา ระบายอากาศดี สวมใส่สบาย เหมาะกับอากาศอุ่นและใช้งานประจำวัน
>
> หากต้องการสั่งซื้อหรือสอบถามข้อมูลเพิ่มเติม แจ้งได้เลยนะคะ ยินดีให้บริการค่ะ!

**LLM actually answered — run 3** (✓, 31.08s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> จากข้อมูลของคุณที่รอบอก **114 ซม.** (เทียบเท่าประมาณ **44.9 นิ้ว**) แนะนำให้เลือกไซส์ **L** สำหรับเสื้อเชิ้ตลินิน เนื่องจากไซส์ L รองรับรอบอกช่วง **44.0–46.0 นิ้ว** ซึ่งตรงกับสรีระคุณพอดีครับ
>
> - ราคา: **390 THB**
> - ตัวเลือกสีพร้อมไซส์: **L เบจ**, M ขาว, XL ครีม
> - รายละเอียดสินค้า: เสื้อเชิ้ตแขนสั้น ทำจากผ้าลินินน้ำหนักเบา ระบายอากาศดี สัมผัสสบาย เหมาะสำหรับวันที่อากาศอบอุ่น ดีไซน์เรียบง่ายและผ่อนคลาย แมตช์ได้ง่ายทุกโอกาส
>
> หากต้องการเปรียบเทียบไซส์อื่นหรือมีคำถามเพิ่มเติม แจ้งได้เลยนะครับ ยินดีช่วยเหลือค่ะ!

**Grade notes:** All runs convert 114 cm ≈ 44.9 in and recommend L (44–46 in). qwen2.5 got this wrong in all 3 runs; it is the biggest single improvement.

### Q12 · EN · size · ✓ ✓ ✓

**Question:** My chest is 49 inches, which size Heavyweight T-Shirt should I get?

**Correct answer must:** Size XL (chest 48–50)

**LLM actually answered — run 1** (✓, 29.0s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of **49 inches**, I recommend the **XL** size for the **Heavyweight T-Shirt**. This size is designed to comfortably fit chest measurements ranging from **48.0 to 50.0 inches**.
>
> Here’s what you can expect with that size:
> - **Fit & Style**: Short-sleeve heavyweight tee with a thick, textured knit and cross-shaped detailing for added warmth and a unique casual look.
> - **Size-Colour Pairing**: Available in **Black**
> - **Price**: **200 THB**
>
> Let me know if you’d like to pair it with another item or need help with anything else!

**LLM actually answered — run 2** (✓, 27.08s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> With a chest measurement of 49 inches, you fit perfectly into the **XL** size for the **Heavyweight T-Shirt**, which is designed for chest measurements between 48 and 50 inches. Here’s what you’ll get with that size:
> - Color: **Black**
> - Price: **200 THB**
> - Sleeve style: **Short sleeve**
>
> Let me know if you need help measuring elsewhere or want pairing suggestions for the rest of the collection!

**LLM actually answered — run 3** (✓, 23.08s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your **49-inch** chest measurement, the **XL** size of the **Heavyweight T-Shirt** is the perfect match for you. Here’s what to expect:
>
> - **Fit**: The **XL** size is tailored for a **chest 48.0–50.0 inch** range, ensuring a comfortable and relaxed fit around your midsection.
> - **Design**: Crafted from **thick heavyweight fabric** with a unique **textured knit pattern** and cross-shaped detailing, making it ideal for cooler days while keeping a clean, casual look.
> - **Color Availability**: In this size, you can select it in **Black** (please note that matching sets pair **L** with **White** and **M** with **Grey**, while **XL** is available in **Black**).
>
> Let me know if you'd like sizing advice for the shorts or need help with anything else!

**Grade notes:** All runs correct: XL (48–50 in), black.

### Q13 · TH · policy · ✓ ✓ ✓

**Question:** ค่าส่งเท่าไหร่ ส่งฟรีไหม

**Correct answer must:** 50 THB flat; free from 200 THB; 2–5 business days

**LLM actually answered — run 1** (✓, 31.87s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> ค่าจัดส่งมาตรฐานของเราอยู่ที่ **50 บาท** ต่อครั้ง โดยใช้เวลา **2–5 วันทำการ** ครับ แต่หากสั่งซื้อสินค้ารวมกันครบมูลค่า **200 บาทขึ้นไป** จะได้รับสิทธิ์ **จัดส่งฟรี** ทันทีครับ
>
> รายละเอียดการขนส่งเพิ่มเติมมีดังนี้ครับ:
> - **จัดส่งด่วนภายในวันเดียว** สำหรับพื้นที่กรุงเทพฯ (รองรับเฉพาะคำสั่งซื้อก่อน 12:00 น.)
>
> อยากให้ช่วยเลือกเสื้อผ้าสักตัวเพื่อรวมยอดให้ถึงเกณฑ์จัดส่งฟรี หรือต้องการสอบถามข้อมูลเพิ่มเติม บอกได้เลยนะครับ ยินดีช่วยเหลือครับ!

**LLM actually answered — run 2** (✓, 28.83s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> สวัสดีค่ะ! เกี่ยวกับค่าจัดส่งทางร้านมีเงื่อนไขดังนี้ค่ะ
> - ค่าจัดส่งมาตรฐาน: คงที่ที่ **50 THB** ต่อออเดอร์ (ใช้เวลา 2–5 วันทำการ)
> - เงื่อนไขจัดส่งฟรี: เมื่อสั่งซื้อมีมูลค่ารวมกัน **200 THB** ขึ้นไป จะยกเว้นค่าจัดส่งให้ทันทีค่ะ
> - ตัวเลือกเพิ่มเติม: มีบริการส่งด่วนในเขต **กรุงเทพฯ** ภายในวันเดียว (เฉพาะออเดอร์ที่สั่งซื้อก่อน 12:00 น.)ค่ะ
>
> หากต้องการเช็คว่าสินค้าในร้านชิ้นไหนบ้างที่ช่วยเพิ่มยอดถึงเกณฑ์จัดส่งฟรี หรือมีคำถามอื่นๆเพิ่มเติม แจ้งทีมงานได้เลยนะคะ ยินดีช่วยเหลือค่ะ! 💛

**LLM actually answered — run 3** (✓, 18.3s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> ยินดีให้บริการครับ! รายละเอียดค่าจัดส่งมีดังนี้ครับ:
> - ค่าจัดส่งมาตรฐานคิดเป็นเงิน **50 บาท** ต่อคำสั่งซื้อ ใช้เวลาจัดส่ง **2–5 วันทำการ**
> - แจก**ฟรีค่าจัดส่ง** ให้ทันทีเมื่อสั่งซื้อสินค้ารวมมูลค่าตั้งแต่ **200 บาท** ขึ้นไป
> - หากท่านอยู่ในเขตกรุงเทพฯ และทำรายการก่อนเวลา **12:00 น.** มีบริการส่งด่วนภายในวันเดียวให้เลือกด้วยครับ
>
> สนใจเลือกเสื้อตัวไหนหรือต้องการปรับจำนวนเพื่อติดเงื่อนไขส่งฟรี แจ้งได้เลยนะครับ เดี๋ยวผมช่วยเช็คตัวเลือกที่ตรงกับความต้องการให้ครับ 😊

**Grade notes:** All runs correct: 50 THB, free from 200 THB, 2–5 days, plus the real same-day Bangkok option.

### Q14 · EN · policy · ✓ ✓ ✓

**Question:** Can I return a shirt if it doesn't fit?

**Correct answer must:** Yes within 7 days of receipt; unworn, unwashed, tags on; start via chat

**LLM actually answered — run 1** (✓, 23.05s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Yes, you can absolutely return or exchange your shirt if it doesn’t fit! Here’s what you need to know about our return policy:
> - You have **7 days** from the date of receipt to request a return or exchange.
> - The item must be **unworn, unwashed**, and still attached to its **original tags**.
> - Simply contact us via chat to initiate the return, and we’ll guide you through the process.
>
> Need help checking sizes for a specific shirt before you order? Just let me know your preferred fit, and I’ll gladly point you to the right options!

**LLM actually answered — run 2** (✓, 22.79s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Yes, you can absolutely return or exchange a shirt if it doesn’t fit! Just review these simple steps to make sure the process goes smoothly:
> - You have **7 days** from delivery to request a return or exchange
> - The shirt must be **unworn, unwashed**, and still attached with its **original tags**
> - Simply contact us via **chat** to start the process
>
> If you'd like, tell me your preferred size or the exact fit you're looking for, and I’ll gladly help you pick the best matching style!

**LLM actually answered — run 3** (✓, 23.54s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Yes, you can easily return or exchange your shirt if it doesn’t fit! Here’s what you need to know:
> - You have **7 days from the date of receipt** to request a return or exchange.
> - The garment must remain **unworn, unwashed, and still attached with its original tags**.
> - Simply message us via **chat** to initiate the return, and we’ll walk you through the steps.
>
> Let me know if you’d like help picking a different size or browsing our current shirt selection!

**Grade notes:** All runs correct.

### Q15 · TH · policy · ✓ ✓ ✓

**Question:** จ่ายเงินช่องทางไหนได้บ้าง

**Correct answer must:** Credit/debit card (Visa, Mastercard), PromptPay QR, COD

**LLM actually answered — run 1** (✓, 36.31s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> คุณสามารถชำระเงินได้สะดวกรวดเร็วผ่านช่องทางต่อไปนี้ครับ:
> - บัตรเครดิตหรือบัตรเดบิต (**Visa**, **Mastercard**)
> - โอนผ่าน **พร้อมเพย์ QR Code**
> - เลือกชำระแบบ **เก็บเงินปลายทาง (COD)** เมื่อรับสินค้า
>
> หากสนใจสั่งซื้อหรือมีข้อสงสัยเพิ่มเติมเกี่ยวกับคำสั่งซื้อ ติดต่อเราได้ตลอดเวลานะครับ ยินดีดูแลคุณเสมอ!

**LLM actually answered — run 2** (✓, 28.71s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> คุณสามารถชำระเงินได้ผ่านช่องทางหลักๆ ดังนี้ค่ะ:
> - **บัตรเครดิต/บัตรเดบิต** (รองรับ Visa และ Mastercard)
> - **พร้อมเพย์** สแกน QR Code
> - **เก็บเงินปลายทาง** (COD)
>
> หากต้องการความช่วยเหลือเรื่องการเลือกช่องทางชำระเงินหรือมีคำถามเพิ่มเติมเกี่ยวกับคำสั่งซื้อ แจ้งเราได้ตลอดเลยนะคะ ยินดีให้บริการ! 🛍️💳

**LLM actually answered — run 3** (✓, 17.2s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> เราสนับสนุนการชำระเงินผ่านช่องทางต่อไปนี้ค่ะ:
> - **บัตรเครดิต/บัตรเดบิต** (รองรับ Visa และ Mastercard)
> - **พร้อมเพย์ (QR Code)**
> - **เก็บเงินปลายทาง (COD)**
>
> เลือกช่องทางที่สะดวกที่สุดได้เลยนะคะ หากอยากสั่งซื้อหรือมีคำถามเพิ่มเติม ติดต่อเราผ่านแชทได้เลย ยินดีช่วยเหลือค่ะ!

**Grade notes:** All runs correct.

### Q16 · EN · policy · ✓ ✓ ✓

**Question:** Do you have any discount codes right now?

**Correct answer must:** WELCOME10 (10%, min 500) and SAVE100 (100 THB off, min 1000); must NOT mention expired SUMMER15/TESTUAT15

**LLM actually answered — run 1** (✓, 16.34s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have two active discount codes you can use at checkout:
>
> - **SAVE100**: Get **100 THB off** your order with a minimum spend of **1000 THB** (expires **Dec 10, 2026**)
> - **WELCOME10**: Enjoy **10% off** your order with a minimum spend of **500 THB** (expires **Jun 10, 2027**)
>
> Simply enter the code at checkout to apply the discount. Let me know if you'd like quick suggestions on items that hit those spending thresholds!

**LLM actually answered — run 2** (✓, 16.5s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have two active discount codes you can apply at checkout! Here are the details:
>
> - **SAVE100**: Get **100 THB off** your order with a minimum spend of **1000 THB** (expires December 10, 2026)
> - **WELCOME10**: Enjoy **10% off** your order with a minimum spend of **500 THB** (expires June 10, 2027)
>
> Just enter the code before completing your payment to see the discount applied. Let me know if you'd like help browsing our collection or need anything else!

**LLM actually answered — run 3** (✓, 21.55s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have two active promo codes ready for your next order:
> - **SAVE100**: Get **100 THB off** with a minimum spend of **1000 THB** (expires Dec 10, 2026)
> - **WELCOME10**: Enjoy **10% off** with a minimum spend of **500 THB** (expires Jun 10, 2027)
>
> Just enter the code at checkout to automatically apply your savings! Let me know if you’d like help putting together an order that meets these thresholds. 😊

**Grade notes:** All runs list only WELCOME10 and SAVE100 with correct minimums and expiry dates; expired codes not mentioned.

### Q17 · TH · oos · ◐ ◐ ◐

**Question:** ขายรองเท้าผ้าใบไหม

**Correct answer must:** Store doesn't sell shoes — politely say so, no invented shoes

**LLM actually answered — run 1** (◐, 36.96s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ทางร้านยังไม่มีสินค้าหมวดรองเท้าผ้าใต้นะคะ แต่ขอแนะนำให้ลองชมคอลเลกชันเสื้อผ้าคุณภาพดีราคาประหยัดที่เราจัดเตรียมไว้แทนค่ะ:
>
> - **Silk Pants (กางเกงผ้าไหม)** ราคา **250 THB** มีขนาด **30, 32, 34** และสีให้เลือกหลากหลาย ได้แก่ ขาว ดำ ครีม เทา น้ำเงิน เขียวมะกอก เนื้อผ้าไหมบางเบา ใส่สบาย ระบายอากาศดี เหมาะกับทุกโอกาส
> - **Leaf Shadow Silk Shirt (เสื้อเชิ้ตไหมลายเงาใบไม้)** ราคา **150 THB** ขนาด **M** สีเขียว ดีไซน์ลายใบไม้ซ้อนชั้นให้ความรู้สึกสุขุมและแมตช์กับเสื้อผ้าอื่นได้ง่าย
> - **shirt test (เชิ้ต เทส)** ราคา **150 THB** มีขนาด **L, M** และสีชมพู เทา เป็นเสื้อไหมลายทางดีไซน์เรียบง่ายสวยงาม
>
> หากสนใจสอบถามข้อมูลเพิ่มเติมหรืออยากได้คำแนะนำในการจับคู่เสื้อผ้า แจ้งได้เลยนะคะ ยินดีให้บริการค่ะ! 🛍️

**LLM actually answered — run 2** (◐, 51.34s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ร้านเราตอนนี้ยังไม่มีรองเท้าผ้าใยนะคะ แต่มีกางเกงและเสื้อผ้าไหมคุณภาพดีที่ให้ความรู้สึกเย็นสบายแทน ขอแนะนำสินค้าที่มีอยู่ในข้อมูลดังนี้ค่ะ:
>
> - **Silk Pants** – ขายาวผ้าไหมทรงตรง ราคา **250 บาท** • Sizes: 30, 32, 34 • Colors: Black, Blue, Cream, Grey, Olive, White • ผ้าบางเบา ระบายอากาศดี ทรงขากระบอกปล่อยเป็นธรรมชาติ ใส่สบายเหมาะสำหรับชีวิตประจำวันหรือวันพักผ่อน
> - **Leaf Shadow Silk Shirt** – เสื้อเชิ้ตไหมลายเงาใบไม้สั้นแขน ราคา **150 บาท** • Sizes: M • Colors: Green • ลายใบไม้ซ้อนทับกันอย่างละเอียด ให้ความรู้สึกสุขุม เรียบหรู และแมตช์ง่ายกับหลากหลายลุค
> - **shirt test** – เสื้อไหมลายทางยาวแขน ราคา **150 บาท** • Sizes: L, M • Colors: Grey, Pink • งานตัดเย็บเนี้ยบ เน้นความนุ่มนวลและสวมใส่สบายในอากาศร้อน
>
> หากคุณสนใจสินค้าตัวไหนเป็นพิเศษ หรือต้องการสอบถามเรื่องไซส์และการดูแลเนื้อผ้า แจ้งได้เลยนะคะ ยินดีแนะนำและช่วยเลือกไซส์ที่เหมาะสมค่ะ!

**LLM actually answered — run 3** (◐, 42.04s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ขออภัยค่ะ ตอนนี้ทางร้าน**ยังไม่มีจำหน่ายรองเท้าผ้าใบ**นะคะ เนื่องจากเราจำหน่ายเฉพาะคอลเลกชันเสื้อผ้าเท่านั้นค่ะ หากกำลังมองหาชุดลำลองเนื้อผ้าเย็นสบาย สไตล์ใกล้เคียงกับที่อาจต้องการ ได้แก่:
> - **Silk Pants (กางเกงผ้าไหม)** ราคา **250 THB** | ขนาด **30, 32, 34** | สี **Black, Blue, Cream, Grey, Olive, White** | เนื้อผ้าไหมบางเบา ระบายอากาศดี ทรงขาตรง ใส่สบายตลอดวัน
> - **Leaf Shadow Silk Shirt (เสื้อเชิ้ตไหมลายเงาใบไม้)** ราคา **150 THB** | ขนาด **M** | สี **Green** | ลายใบไม้ซ้อนทับกันให้ความรู้สึกสุขุม เรียบหรู แมตช์ลุคง่าย
> - **shirt test (เชิ้ต เทส)** ราคา **150 THB** | ขนาด **L, M** | สี **Grey, Pink** | ดีไซน์ลายทางสวยงาม เข้ากับชุดลำลองได้หลากหลาย
>
> ต้องการให้ช่วยเช็ควงเหลือไซส์หรือสีตัวไหน ส่งชื่อสินค้ามาได้เลยนะคะ ยินดีดูแลค่ะ! 🛍️✨

**Grade notes:** All runs correctly say the store doesn't sell sneakers. But 'ผ้าใบ' still retrieves silk products (same retrieval side effect as the baseline), and every run then *recommends* Silk Pants (stock 0 on every variant) as if buyable. They also recommend the 'shirt test' product, which is a leftover test product still active in the catalogue. Runs 1 and 2 also misspell ผ้าใบ (ผ้าใต้ / ผ้าใย). Cause: Retrieval + LLM.

### Q18 · EN · oos · ✓ ✓ ✓

**Question:** Can you help me write my homework essay?

**Correct answer must:** Polite refusal / out of scope

**LLM actually answered — run 1** (✓, 4.29s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**LLM actually answered — run 2** (✓, 3.59s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**LLM actually answered — run 3** (✓, 3.37s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**Grade notes:** All runs: canned out-of-scope reply (the intent classifier handles this, no LLM reply).

### Q19 · TH · mixed · ✓ ✓ ✓

**Question:** มี polo สี white size XL ไหม

**Correct answer must:** Yes — e.g. Corn Polo / Ribbed Polo / Solid Polo in White XL (any correct real one); reply in Thai

**LLM actually answered — run 1** (✓, 32.15s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> สวัสดีค่ะ 🙏 สำหรับเสื้อโปโลสีขาวขนาด **XL** ทางร้านมีคงเหลืออยู่ในสต็อกค่ะ ดังนี้:
> - **Solid Polo (โปโลพื้น)** ราคา **200 THB**: มีขนาด **XL** สี **ขาว** คงเหลืออยู่ **48 ตัว** ค่ะ เสื้อดีไซน์แขนสั้นสไตล์คลาสสิก สีพื้นเรียบง่ายต่อการใช้งาน และสวมใส่สบายเหมาะกับการแต่งตัวประจำวัน
>
> หากต้องการสั่งซื้อหรือสอบถามข้อมูลเพิ่มเติม แจ้งได้เลยนะคะ ยินดีให้บริการค่ะ 😊

**LLM actually answered — run 2** (✓, 34.26s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีค่ะ! ตอนนี้ทางร้านมี **Solid Polo (โปโลพื้น)** ในสี **White** ขนาด **XL** คงเหลืออยู่ **48 ตัว** ค่ะ โดยราคาอยู่ที่ **200 THB** ค่ะ/ครับ
>
> หากต้องการสั่งซื้อหรือสอบถามรุ่นอื่นเพิ่มเติม แจ้งได้เลยนะคะ/ครับ ยินดีช่วยเหลือเสมอค่ะ/ครับ

**LLM actually answered — run 3** (✓, 29.83s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีครับ! ตอนนี้ทางร้านมีเสื้อ **Polo** สี **White** ขนาด **XL** ให้เลือกซื้ออยู่ค่ะ รายละเอียดสินค้าดังนี้ครับ:
> - รุ่น: **Solid Polo (โปโลพื้น)**
> - ราคา: **200 บาท**
> - ไซส์ & สีที่พร้อมส่ง: **XL – White** (คงเหลือ 48 ตัว)
>
> หากสนใจสั่งซื้อหรืออยากสอบถามรุ่นเพิ่มเติม แจ้งเราได้เลยนะครับ! 😊

**Grade notes:** All runs name Solid Polo, White XL, 48 left, 200 THB, in Thai. qwen2.5 scored ◐ ◐ ✗ here. Runs 2 and 3 use awkward 'ค่ะ/ครับ' slashes (style only).

### Q20 · EN · mixed · ✓ ✓ ✓

**Question:** I want a shirt for the beach, something light, under 300 baht

**Correct answer must:** Suggests real items ≤300 THB (silk shirts 150 THB, maybe Swim Shorts); must not suggest Linen Shirt as under 300

**LLM actually answered — run 1** (✓, 28.37s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> Great choice for a breezy beach look! Based on your budget of **under 300 THB**, here are the two light, short-sleeve shirts that match your request:
>
> - **Fern Line Silk Shirt** – **150 THB**
>   - Size: **M**
>   - Color: **Red**
>   - Material & Vibe: Lightweight silk with an airy fern pattern designed for a relaxed tropical feel
>   - Best for: Bright, effortless resort styling with a bold accent
>
> - **Leaf Shadow Silk Shirt** – **150 THB**
>   - Size: **M**
>   - Color: **Green**
>   - Material & Vibe: Soft, layered leaf design creating a subtle shadow effect for a calm, refined aesthetic
>   - Best for: Muted, nature-inspired beach wear that pairs easily with casual bottoms
>
> Both shirts share the exact same **price (150 THB)**, **single size option (M)**, and **short-sleeve cut**, but stand out through their botanical prints and color tones. Let me know which shade you prefer, and I’ll guide you through placing your order!

**LLM actually answered — run 2** (✓, 29.61s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> Here are two lightweight, resort-ready shirts under **300 THB** that work beautifully for the beach:
>
> - **Fern Line Silk Shirt**: Priced at **150 THB**, this short-sleeve top features a clean fern and palm frond print with spacious detailing for a relaxed tropical vibe. Made from breathable silk, it is only available in size **M** and comes in color **Red**.
> - **Leaf Shadow Silk Shirt**: Also priced at **150 THB**, this short-sleeve option uses overlapping leaf patterns to create a soft, shadow-like texture for a calmer, more refined look. Crafted from the same lightweight silk, it shares the **M** sizing but offers color **Green**.
>
> Both options share identical pricing, material, and size availability, with the main difference being their color and print style. Let me know which one suits your taste best!

**LLM actually answered — run 3** (✓, 33.16s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> Here are two lightweight silk shirts under 300 THB that are perfect for a relaxed beach vibe:
>
> - **Fern Line Silk Shirt**: Designed with an airy fern and palm motif for a breezy resort feel. Key attributes: **150 THB**, Size **M**, Color **Red**, **Short sleeve**
> - **Leaf Shadow Silk Shirt**: Features a softly layered leaf pattern for a calm, refined look. Key attributes: **150 THB**, Size **M**, Color **Green**, **Short sleeve**
>
> Both options match your budget and material preference, differing only in color and print style. Which one would you like to order?

**Grade notes:** All runs suggest the two 150 THB silk shirts with correct size/colour and do not offer the 390 THB Linen Shirt.
