# LLM evaluation — new baseline: local Ollama `qwen2.5:7b` (after the prompt fix), 3 runs

Runs: 2026-10-10 16:01:16, 2026-10-10 16:02:30, 2026-10-10 16:03:45 · Script: `llm_model_eval.py` · Raw: `reports/llm_eval_ollama_qwen2.5-7b_v2_run{1,2,3}.json`

**This is the baseline the OpenRouter models are compared against.** Same 20 questions and grading as `llm_eval_ollama_qwen2.5-7b_results.md`. The code includes all the 2026-10-10 fixes: retrieval (see `retrieval_eval_th_results.md`), intent routing, and now also **the prompt fix**:
- the stock and size-chart rows carry the product **name** instead of the ID
- each product lists its `Size/colour options`
- follow-up questions like 'ตัวนี้…' reuse the previous products (`followup_eval.py`: 5/5)

Each run sends every question in a new conversation. The chat call has no fixed temperature, so the three runs differ.

**Grading:** ✓ = 1 · ◐ = 0.5 (right core fact, wrong detail or wrong language) · ✗ = 0. **Cause:** *Retrieval* = wrong products retrieved; *Prompt* = fact not usable in the prompt; *LLM* = fact in the prompt, model got it wrong.

## Summary

| | Run 1 | Run 2 | Run 3 | **Mean** |
|---|---|---|---|---|
| **Overall (/20)** | 16.5 | 15.0 | 14.5 | **15.33** |
| Thai (/10) | 6.5 | 5.5 | 4.5 | 5.50 |
| English (/10) | 10 | 9.5 | 10 | 9.83 |
| Replies with Chinese/Japanese/Korean/Arabic text | 2 [11, 17] | 4 [3, 11, 17, 19] | 4 [3, 13, 15, 19] | 3.3 |
| Avg latency | 3.7s | 3.7s | 3.7s | 3.7s |

Earlier single runs, for reference (different code, 1 run each): before any fix 14.5/20; after the retrieval fixes 14.5/20.

**Findings**

1. **The prompt fix helps where the prompt was the cause.** Q7 says 'out of stock' in all 3 runs (before the fix: wrong in 1 of 3). Q19 named the product in 1 of 3 runs (before: never). No error is caused by retrieval or the prompt any more, except the 'ผ้าใบไหม'→silk side effect in Q17.
2. **What's left is qwen2.5:7b itself:**
   - foreign-script text in Thai replies (Chinese mostly; also Japanese, Korean and Arabic characters)
   - wrong size↔colour pairing even when the pairs are in the prompt (Q5, Q9)
   - a size question it never gets right (Q11)
   These are what the OpenRouter models need to beat.
3. **English is solid; Thai carries all the errors.** Every ✗ and almost every ◐ is on a Thai question.
4. **Compare models by the 3-run mean, not by one run.** Identical runs differ by up to 2 points (16.5 vs 14.5), so a gap of 1–2 points between two models in a single run means nothing.

## Results

| # | Lang | Type | Question | Run 1 | Run 2 | Run 3 | Cause |
|---|---|---|---|---|---|---|---|
| 1 | TH | product | แนะนำเสื้อโปโลหน่อย | ✓ | ◐ | ◐ | LLM |
| 2 | EN | product | Do you have linen shirts? | ✓ | ✓ | ✓ | — |
| 3 | TH | product | มีกางเกงขาสั้นอะไรบ้าง | ◐ | ◐ | ◐ | LLM |
| 4 | EN | product | What's the cheapest shirt you sell? | ✓ | ✓ | ✓ | — |
| 5 | TH | product | อยากได้เสื้อยืดสีดำ | ◐ | ◐ | ◐ | LLM |
| 6 | EN | product | Compare the Linen Shirt and the Heavyweight T-Shirt | ✓ | ✓ | ✓ | — |
| 7 | TH | stock | กางเกงผ้าไหมมีของไหม | ✓ | ✓ | ◐ | — |
| 8 | EN | stock | Is the Linen Shirt available in white size M? | ✓ | ✓ | ✓ | — |
| 9 | TH | stock | เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม | ◐ | ◐ | ◐ | LLM |
| 10 | EN | stock | What colours do the Swim Shorts come in? | ✓ | ✓ | ✓ | — |
| 11 | TH | size | รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร | ✗ | ✗ | ✗ | LLM |
| 12 | EN | size | My chest is 49 inches, which size Heavyweight T-Shirt should I get? | ✓ | ✓ | ✓ | — |
| 13 | TH | policy | ค่าส่งเท่าไหร่ ส่งฟรีไหม | ✓ | ◐ | ◐ | LLM |
| 14 | EN | policy | Can I return a shirt if it doesn't fit? | ✓ | ✓ | ✓ | — |
| 15 | TH | policy | จ่ายเงินช่องทางไหนได้บ้าง | ✓ | ✓ | ◐ | LLM |
| 16 | EN | policy | Do you have any discount codes right now? | ✓ | ✓ | ✓ | — |
| 17 | TH | oos | ขายรองเท้าผ้าใบไหม | ◐ | ◐ | ✓ | Retrieval + LLM |
| 18 | EN | oos | Can you help me write my homework essay? | ✓ | ✓ | ✓ | — |
| 19 | TH | mixed | มี polo สี white size XL ไหม | ◐ | ◐ | ✗ | LLM |
| 20 | EN | mixed | I want a shirt for the beach, something light, under 300 baht | ✓ | ◐ | ✓ | LLM |

## Question-by-question

### Q1 · TH · product · ✓ ◐ ◐

**Question:** แนะนำเสื้อโปโลหน่อย

**Correct answer must:** Lists real polos from the catalogue (e.g. Solid Polo, Ribbed Polo, Corn Polo), price ~200–250 THB; no invented products

**LLM actually answered — run 1** (✓, 5.0s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> แน่นอนค่ะ มีทั้งหมด 3 แบบของเสื้อโปโลให้เลือก
>
> - **โปโลริ้ว** (200 บาท) มี sizing L, M, XL และมีสีขาว, ครีม, ดำ, น้ำเงิน, ฟ้า, เขียวขี้ม้า, แดง แขนสั้น
> - **โปโลลายถัก** (200 บาท) มี sizing L, M, XL และมีสีครีม, ดำ, น้ำเงิน, เขียว แขนสั้น
> - **โปโลพื้น** (200 บาท) มี sizing L, M, XL และมีสีขาว, ครีม, ดำ, น้ำตาล, เขียวมะกอก, เขียวใบสน, เทา แขนสั้น
>
> ทุกรุ่นมีราคาเท่ากัน 200 บาท และเป็นเสื้อแขนสั้น สำหรับการใส่ทั่วไปและลุคแคชชวล

**LLM actually answered — run 2** (◐, 6.16s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> ขอแนะนำเสื้อโปโลของเราให้ค่ะ มีทั้งหมด 3 แบบ:
>
> - **โปโลริ้ว**: เป็นเสื้อแขนสั้นคอปก สไตล์คลาสสิกด้วยเนื้อผ้าที่มีเท็กซ์เจอร์ริบละเอียด ราคา 200 บาท มีให้เลือกขนาด L, M, XL และสีขาว, ครีม, ดำ, น้ำเงิน, ฟ้า, เขียวขี้ม้า, แดง
>
> - **โปโลลายถัก**: เสื้อแขนสั้นทรงสลิม ดีไซน์ด้วยลายถักโครเชต์ที่ทำให้เสื้อมีเท็กซ์เจอร์พิเศษ เหมาะสำหรับลุคแคชชวล ราคา 200 บาท มีขนาด L, M, XL และสีขาว, ครีม, ดำ, น้ำเงิน
>
> - **โปโลพื้น**: เสื้อแขนสั้นสไตล์คลาสสิกที่มีสีพื้นไม่มีลาย ราคา 200 บาท มีให้เลือกขนาด L, M, XL และสีขาว, ครีม, ดำ, น้ำตาล, เขียวมะกอก, เขียวใบสน, เทา
>
> ทุกแบบสามารถใส่ได้ในโอกาสต่างๆ ค่ะ ถ้าสนใจสามารถเลือกขนาดและสีตามความชอบได้เลยนะคะ

**LLM actually answered — run 3** (◐, 5.07s, intent `product_info`, cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> แน่นอนค่ะ มีเสื้อโปโลให้เลือกหลายแบบ ลองดูสิ:
>
> - **Ribbed Polo (โปโลริ้ว)** ราคา 200 บาท ไซส์มี L, M, XL สีขาว, ครีม, ดำ, น้ำเงิน, ฟ้า, เขียวขี้ม้า, แดง
> - **Crochet Knit Polo Shirt (โปโลลายถัก)** ราคา 200 บาท ไซส์ L, M, XL สีขาว, ครีม, ดำ, เขียว
> - **Solid Polo (โปโลพื้น)** ราคา 200 บาท ไซส์ L, M, XL สีขาว, ครีม, ดำ, น้ำตาล, เขียวมะกอก, เขียวใบสน, เทา
>
> เสื้อแต่ละแบบมีลวดลายและสีให้เลือก ซึ่งออกแบบมาสำหรับการใส่ในชีวิตประจำวันและลุคแคชชวลที่เรียบง่ายแต่มีสไตล์ค่ะ

**Grade notes:** All runs list three real polos at 200 THB. Runs 2 and 3 give Crochet Knit Polo a white option it doesn't have (its colours are cream/black/blue/green). Cause: LLM.

### Q2 · EN · product · ✓ ✓ ✓

**Question:** Do you have linen shirts?

**Correct answer must:** Yes — Linen Shirt, 390 THB, Beige/Cream/White, M/L/XL

**LLM actually answered — run 1** (✓, 3.12s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do have linen shirts. Here are the details:
>
> - **Linen Shirt**: Price 390 THB, available in sizes L, M, XL with colors Beige, Cream, and White. It's a short-sleeve shirt made from lightweight, breathable fabric for a comfortable wear, especially suitable for warm weather.

**LLM actually answered — run 2** (✓, 3.5s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do have a linen shirt. Here are the details:
>
> - **Linen Shirt**
>   - Price: 390 THB
>   - Sizes: L, M, XL
>   - Colors: Beige, Cream, White
>   - Sleeve: short
>   - Description: A short-sleeve linen shirt made from lightweight, breathable fabric for a soft and comfortable feel. Ideal for warm weather and easy to wear in everyday situations.

**LLM actually answered — run 3** (✓, 3.46s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do have a linen shirt. Here are the details:
>
> - **Linen Shirt**
>   - Price: 390 THB
>   - Sizes: L, M, XL
>   - Colors: Beige, Cream, White
>   - Sleeve: Short-sleeve
>   - Description: A short-sleeve linen shirt made from lightweight, breathable fabric for a soft and comfortable feel. It's perfect for everyday wear in warm weather.

**Grade notes:** All runs correct.

### Q3 · TH · product · ◐ ◐ ◐

**Question:** มีกางเกงขาสั้นอะไรบ้าง

**Correct answer must:** Heavyweight Shorts (150 THB) and Swim Shorts (200 THB)

**LLM actually answered — run 1** (◐, 4.99s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> มีกางเกงขาสั้นให้เลือก 3 ประเภทครับ
>
> - **Heavyweight Shorts (กางเกงขาสั้นหนา)** ราคา 150 บาท มี sizing 32, 34, 36 และสีดำ, เทา, ขาว ซิลูห์ตแบบ long sleeve
> - **Swim Shorts (กางเกงขาสั้นว่ายน้ำ)** ราคา 200 บาท มี sizing 30 และมีหลายสีให้เลือก ได้แก่ ดำ, ชมพู, ขาว, กรมท่า, ฟ้า, ฟ้าอมเขียว, เขียว, เขียวมะกอก, เหลือง, แดง ซิลูห์ตแบบ long sleeve
> - **Silk Pants (กางเกงผ้าไหม)** ราคา 250 บาท มี sizing 30, 32, 34 และสีขาว, ครีม, ดำ, น้ำเงิน, เขียวมะกอก, เทา ซิลูห์ตทรงกระบอกยาว

**LLM actually answered — run 2** (◐, 6.53s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> ที่ขายมีกางเกงขาสั้น 2 แบบครับ
>
> - **Heavyweight Shorts** (กางเกงขาสั้นหนา)
>   - ราคา: 150 บาท
>   - ไซส์: 32, 34, 36
>   - สี: 黑色, 灰色, 白色 (ดำ, เทา, ขาว)
>   - มีให้เลือก: 32–White, 34–Grey, 36–Black
>   - มีแขนสั้น
>
> - **Swim Shorts** (กางเกงขาสั้นว่ายน้ำ)
>   - ราคา: 200 บาท
>   - ไซส์: 30
>   - สี: 黑色, 蓝色, 绿色, 海军蓝, 棕褐色, 粉红色, 红色, 天蓝色, 白色, 黄色 (ดำ, น้ำเงิน, เขียว, กรมท่า, เขียวมะกอก, ชมพู, แดง, ฟ้าอมเขียว, ขาว, เหลือง)
>   - มีให้เลือก: 30–Black, 30–Cyan, 30–Green, 30–Navy, 30–Olive, 30–Pink, 30–Red, 30–Sky Blue, 30–White, 30–Yellow
>   - มีแขนสั้น
>
> ทั้งสองแบบเป็นกางเกงขาสั้นที่มีแขนสั้นค่ะ แต่ Heavyweight Shorts มีขนาดและสีมากกว่า Swim Shorts ครับ

**LLM actually answered — run 3** (◐, 4.94s, intent `product_info`, cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> ที่เรามีขายค่ะ มี **Heavyweight Shorts (กางเกงขาสั้นหนา)** และ **Swim Shorts (กางเกงขาสั้นว่ายน้ำ)** ลองดูได้ไหมคะ?
>
> - **Heavyweight Shorts**
>   - ราคา: 150 บาท
>   - ขนาด: 32, 34, 36
>   - สี: 黑色 (ดำ), 灰色 (เทา), 白色 (ขาว)
>   - มีส่วนแขนยาว
>
> - **Swim Shorts**
>   - ราคา: 200 บาท
>   - ขนาด: 30
>   - สี: 黑色 (ดำ), 青色 (ครีม), 蓝色 (น้ำเงิน), 海军蓝 (กรมท่า), 橄榄绿 (เขียวมะกอก), 粉红色 (ชมพู), 红色 (แดง), 天蓝色 (ฟ้าอมเขียว), 白色 (ขาว), 黄色 (เหลือง)
>   - มีส่วนแขนยาว

**Grade notes:** Both shorts found every run. Run 1 also lists Silk Pants as shorts. Runs 2 and 3 write colour names in Chinese. All runs make up 'sleeve' details for shorts. Cause: LLM.

### Q4 · EN · product · ✓ ✓ ✓

**Question:** What's the cheapest shirt you sell?

**Correct answer must:** Silk shirts at 150 THB (e.g. Monstera / Fern Line / floral silk shirt); must not quote a lower price

**LLM actually answered — run 1** (✓, 3.08s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The **Leaf Shadow Silk Shirt** is the cheapest option at 150 THB. It features a unique, shadow-like botanical design and is made of silk. Available in size M and color Green (เขียว).
>
> - Size/colour options: M–Green

**LLM actually answered — run 2** (✓, 2.99s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The **Leaf Shadow Silk Shirt** is the cheapest option at 150 THB. It features a subtle botanical pattern and is perfect for cooler weather or layering.
>
> - Sizes: M
> - Colors: Green

**LLM actually answered — run 3** (✓, 3.04s, intent `product_info`, cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The **Leaf Shadow Silk Shirt** is the cheapest option at 150 THB. Here are its details:
> - **Size:** M
> - **Color:** Green
>
> It features a delicate botanical pattern and is perfect for casual wear.

**Grade notes:** All runs correct.

### Q5 · TH · product · ◐ ◐ ◐

**Question:** อยากได้เสื้อยืดสีดำ

**Correct answer must:** Heavyweight T-Shirt, Black (XL), 200 THB

**LLM actually answered — run 1** (◐, 3.63s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> มี **เสื้อยืดหนา** สี **ดำ** ให้เลือก มีขนาด **M** และ **XL** เลยค่ะ
>
> - **ขนาด M**: ราคา 200 บาท
> - **ขนาด XL**: ราคา 200 บาท
>
> อยากแนะนำว่าถ้าคุณต้องการขนาดที่แน่นหน่อย M จะสบายใส่ ส่วน XL สำหรับคนที่ต้องการ sizing ใหญ่กว่านิดหนึ่งค่ะ

**LLM actually answered — run 2** (◐, 3.09s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> มีเสื้อยืด Black ให้เลือกครับ **200 บาท** มีขนาด **L** เท่านั้นค่ะ
>
> ต้องการลองชมแบบอื่นๆ หรือมีคำถามเพิ่มเติมไหมคะ?

**LLM actually answered — run 3** (◐, 4.0s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> สำหรับเสื้อยืดของทางร้านที่เป็นสีดำ มีให้เลือกmodel นี้ครับ:
>
> - **-heavyweight t-shirt (เสื้อยืดหนา)**:
>   - ราคา: 200 THB
>   - ขนาด: L, M, XL
>   - สี: Black (ดำ)
>   - แขนสั้น
>
> เสื้อตัวนี้เป็นเสื้อยืดแขนสั้นที่เนื้อผ้าหนา อุ่นสบายในอากาศเย็น มีลวดลายถักแบบกากบาทและมีขนาดให้เลือก 3 ขนาดครับ

**Grade notes:** Right product and price. The prompt now says `XL–Black`, but the model still gives black as M+XL, then L only, then L/M/XL. Still a model error after the prompt fix. Cause: LLM.

### Q6 · EN · product · ✓ ✓ ✓

**Question:** Compare the Linen Shirt and the Heavyweight T-Shirt

**Correct answer must:** Linen 390 THB vs Heavyweight T-Shirt 200 THB; colours/sizes correct

**LLM actually answered — run 1** (✓, 4.28s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> Sure, let's compare the **Linen Shirt** and the **Heavyweight T-Shirt**.
>
> - The **Linen Shirt** (390 THB) is made from lightweight, breathable fabric. It comes in sizes L, M, XL with colors Beige, Cream, and White. Perfect for warm weather.
>   - Available in: Beige, White, Cream
>   - Sizes: L, M, XL
>
> - The **Heavyweight T-Shirt** (200 THB) has a thicker fabric to keep you warm during cooler weather. It features a distinctive textured knit pattern with cross-shaped detailing and is available in Black, Grey, and White.
>   - Available in: Black, Grey, White
>   - Sizes: L, M, XL
>
> Both shirts have short sleeves, but the Linen Shirt is more suitable for warmer climates, while the Heavyweight T-Shirt offers added warmth during cooler months.

**LLM actually answered — run 2** (✓, 4.16s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> The **Linen Shirt** and the **Heavyweight T-Shirt** have some differences in price, fabric, and design. Here’s a comparison:
>
> - The **Linen Shirt** costs 390 THB, which is more expensive than the **Heavyweight T-Shirt** at 200 THB.
> - The **Linen Shirt** is made from lightweight and breathable fabric, while the **Heavyweight T-Shirt** has a thicker fabric for added warmth in cooler weather.
> - In terms of size and color options, both have similar sizes (L, M, XL) but different colors. The Linen Shirt offers Beige, Cream, and White, whereas the Heavyweight T-Shirt provides Black, Grey, and White.
>
> Both are short-sleeved, making them suitable for warmer weather or layering in cooler conditions.

**LLM actually answered — run 3** (✓, 4.15s, intent `product_info`, cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> The **Linen Shirt** and the **Heavyweight T-Shirt** have some differences in terms of price, material, sizes, and colors. Here's a comparison:
>
> - The **Linen Shirt** costs 390 THB, while the **Heavyweight T-Shirt** is priced at 200 THB.
> - The **Linen Shirt** is made from lightweight, breathable fabric, suitable for warmer weather. It comes in Beige, Cream, and White colors. Available sizes are L, M, and XL.
> - The **Heavyweight T-Shirt** is designed with a thicker fabric for added warmth and comfort in cooler weather. It features a distinctive textured knit pattern with cross-shaped detailing. Sizes available are L, M, and XL, and the colors are Black, Grey, and White.

**Grade notes:** All runs correct.

### Q7 · TH · stock · ✓ ✓ ◐

**Question:** กางเกงผ้าไหมมีของไหม

**Correct answer must:** Silk Pants are OUT OF STOCK (stock 0 on every variant) — must not say available

**LLM actually answered — run 1** (✓, 4.62s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> กางเกงผ้าไหมที่ทางร้านมีในปัจจุบันนี้ไม่มีให้เลือกในสีและขนาดที่คุณต้องการ ดังนี้:
>
> - **30–White**: หมดสินค้าแล้ว
> - **32–Cream**: หมดสินค้าแล้ว
> - **32–Grey**: หมดสินค้าแล้ว
> - **34–Black**: หมดสินค้าแล้ว
> - **34–Blue**: หมดสินค้าแล้ว
> - **34–Olive**: หมดสินค้าแล้ว
>
> แนะนำให้คุณเลือกซื้อกางเกงขาสั้นว่ายน้ำแทนที่มีในสต็อคครบถ้วนมากกว่า หรือรอการจัดสินค้าใหม่จากทางร้านได้ครับ/ค่ะ

**LLM actually answered — run 2** (✓, 4.36s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> กางเกงผ้าไหมในขนาดและสีที่คุณต้องการไม่มีอยู่ในสต็อกขณะนี้ครับ - 30-White, 32-Cream, 32-Grey, 34-Black, 34-Blue และ 34-Olive หมดแล้ว
>
> ถ้าคุณยังสนใจกางเกงผ้าไหม เราขอแนะนำกางเกงขาสั้นว่ายน้ำ (swim-shorts) มีขนาด 30 เท่าน่ะครับ สีมีให้เลือกหลายสี เช่น Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White และ Yellow ละตัวมีจำนวน 67 ตัวอยู่ในสต็อกครับ

**LLM actually answered — run 3** (◐, 3.8s, intent `stock_check`, cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> ขออภัยครับ ณ ตอนนี้ไม่มี **Silk Pants** (กางเกงผ้าไหม) ในขนาดและสีที่คุณต้องการ แต่เราสามารถแนะนำ **Heavyweight Shorts** (กางเกงขาสั้นหนา) แทนครับ
>
> - 32 - Cream: 26 ตัวเหลือ
> - 34 - Grey: 26 ตัวเหลือ
> - 36 - Black: 50 ตัวเหลือ

**Grade notes:** Fixed: all 3 runs say Silk Pants are out of stock (before the fix, 1 of 3 said 'in stock'). Run 3 gets the alternative's colours wrong (says 32 Cream; it's 32 White).

### Q8 · EN · stock · ✓ ✓ ✓

**Question:** Is the Linen Shirt available in white size M?

**Correct answer must:** Yes — White/M in stock (45)

**LLM actually answered — run 1** (✓, 2.96s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, we have the Linen Shirt (ขาว) in size M available. There are 45 pieces left. Would you like to proceed with this option or need help with anything else?

**LLM actually answered — run 2** (✓, 3.06s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, we have the **Linen Shirt** in **size M and color White** currently in stock. There are 45 pieces left. Would you like to place an order or need more information on this shirt?

**LLM actually answered — run 3** (✓, 3.03s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, we have the **Linen Shirt** in **size M and color White** currently in stock. There are 45 pieces left. Would you like to place an order or need more information about this product?

**Grade notes:** All runs correct.

### Q9 · TH · stock · ◐ ◐ ◐

**Question:** เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม

**Correct answer must:** No black Linen Shirt exists (only Beige/Cream/White) — must say not available

**LLM actually answered — run 1** (◐, 3.63s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> เสื้อเชิ้ตลินินของเรากำลังขาดขนาด M สีดำครับ แต่เรามี sizing และสีอื่นๆ ให้คุณเลือกครับ:
>
> - **Linen Shirt** (เสื้อเชิ้ตลินิน)
>   - **M Beige**: มีอยู่ 45 ตัว
>   - **XL Cream**: มีอยู่ 45 ตัว
>
> ยังไงคุณสนใจขนาดและสีที่มีอยู่ไหมครับ?

**LLM actually answered — run 2** (◐, 3.25s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> ไม่มีไซส์ M สีดำของเสื้อเชิ้ตลินินในสต็อกครับ แต่เรามีไซส์ L สีขาว และไซส์ XL สีครีมให้คุณเลือกครับ - L-Beige, XL-Cream

**LLM actually answered — run 3** (◐, 3.41s, intent `stock_check`, cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> ไม่มีขนาด M สีดำของเสื้อเชิ้ตลินินในสต็อกค่ะ แต่เรามีให้เลือกในขนาด L และ XL ดังนี้:
>
> - ขนาด L สีขาว จำนวน 45 ชิ้น
> - ขนาด XL สีครีม จำนวน 45 ชิ้น

**Grade notes:** Every run correctly says there's no black. None mentions that M comes in white, and runs 1 and 2 pair the wrong colours with sizes (M Beige, L White). Cause: LLM.

### Q10 · EN · stock · ✓ ✓ ✓

**Question:** What colours do the Swim Shorts come in?

**Correct answer must:** 10 colours: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, Yellow; size 30 only

**LLM actually answered — run 1** (✓, 2.81s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The swim shorts are available in several colors including **Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, and Yellow**.

**LLM actually answered — run 2** (✓, 2.98s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The swim shorts come in several colors including **Black**, **Cyan**, **Green**, **Navy**, **Olive**, **Pink**, **Red**, **Sky Blue**, **White**, and **Yellow**.

**LLM actually answered — run 3** (✓, 2.98s, intent `product_info`, cards: Swim Shorts, Heavyweight Shorts):

> The Swim Shorts come in several colors including **Black**, **Cyan**, **Green**, **Navy**, **Olive**, **Pink**, **Red**, **Sky Blue**, **White**, and **Yellow**.

**Grade notes:** All runs correct.

### Q11 · TH · size · ✗ ✗ ✗

**Question:** รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร

**Correct answer must:** Size L — 114 cm ≈ 44.9 in, chart is in inches (L = chest 44–46)

**LLM actually answered — run 1** (✗, 5.36s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> คุณมีรอบอกประมาณ 45 นิ้ว ตามที่ได้量身推荐如下尺寸：
>
> 对于您的围度，Linen Shirt 的 M 尺码比较合适。建议您可以选择 L 极其宽松的尺码以确保舒适度。
>
> - ไซส์ M รอบอก 40.0–42.0 นิ้ว
> - ไซส์ L รอบอก 44.0–46.0 นิ้ว
> - ไซส์ XL รอบอก 48.0–50.0 นิ้ว
>
> **เสื้อเชิ้ตลินินไซส์ M (390 THB)**:
> - **สี**: เบจ, ครีม, ขาว
> - **แขนสั้น**
> - ดีไซน์เรียบง่ายและผ่อนคลาย
>
> **เสื้อเชิ้ตลินินไซส์ L (390 THB)**:
> - **สี**: เบจ, ครีม, ขาว
> - **แขนสั้น**
> - ดีไซน์เรียบง่ายและผ่อนคลาย

**LLM actually answered — run 2** (✗, 4.11s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> ตามช่วงขนาดที่ให้มา รอบอก 114 ซม. ประมาณ 45 นิ้ว (114 除以 2.54 约等于 45) สำหรับเสื้อเชิ้ตลินิน มีไซส์ M และ XL
>
> - **ขนาด M** มีรอบอกประมาณ 40.0–42.0 นิ้ว
> - **ขนาด XL** มีรอบอกประมาณ 48.0–50.0 นิ้ว
>
>  suger ขนาด XL เลยค่ะ เพราะรอบอกของคุณอยู่ระหว่างช่วงที่รอบอก XL รองรับได้ค่ะ.

**LLM actually answered — run 3** (✗, 4.43s, intent `size_guide`, cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> คุณมีขนาดรอบอก 45 นิ้ว (114 ซม. หารด้วย 2.54) ตามแนะนำจากตารางขนาด เราจะแนะนำให้ลองใส่เสื้อเชิ้ตลินินไซส์ M เลยค่ะ ไซส์ M มีรอบอกประมาณ 40-42 นิ้ว ซึ่งเหมาะสมกับขนาดของคุณมากที่สุด
>
> ถ้าคุณต้องการความพอดีมากขึ้น สามารถลองไซส์ L ได้เช่นกัน เพราะมีรอบอกประมาณ 44-46 นิ้ว กรอบร่างของคุณจะทำให้ใส่ขนาดใหญ่ยังคงดูสบายและดูเท่มากค่ะ

**Grade notes:** Every run converts 114 cm → ~45 in correctly and the prompt shows `Linen Shirt | L | chest 44–46`, yet the answers are M (Chinese text, then 'or L'), XL, and M. A pure model reasoning error. Cause: LLM.

### Q12 · EN · size · ✓ ✓ ✓

**Question:** My chest is 49 inches, which size Heavyweight T-Shirt should I get?

**Correct answer must:** Size XL (chest 48–50)

**LLM actually answered — run 1** (✓, 3.44s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of 49 inches, the **Heavyweight T-Shirt** in size **XL** would be the best fit for you. Here are some details:
>
> - **Size:** XL
> - **Price:** 200 THB
> - **Color Options:** Black
>
> This size should provide a comfortable and secure fit according to the sizing guide provided.

**LLM actually answered — run 2** (✓, 3.48s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of 49 inches, you might want to consider sizing up from the usual M size. For the **Heavyweight T-Shirt**, here are your options:
>
> - **Size L**: Chest fit: 46.0–48.0 inches (closest to your size)
> - **Size XL**: Chest fit: 48.0–50.0 inches (perfect for you)
>
> Given your measurement, the **XL** size would be a better fit.

**LLM actually answered — run 3** (✓, 3.18s, intent `size_guide`, cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of 49 inches, the **Heavyweight T-Shirt** in size **XL** would be the best fit for you. Here’s why:
>
> - **Size**: XL (chest: 48.0–50.0 inches)
> - **Color Options**: Black

**Grade notes:** All runs correct.

### Q13 · TH · policy · ✓ ◐ ◐

**Question:** ค่าส่งเท่าไหร่ ส่งฟรีไหม

**Correct answer must:** 50 THB flat; free from 200 THB; 2–5 business days

**LLM actually answered — run 1** (✓, 4.02s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> ค่าจัดส่งของเรามีอยู่สองระดับค่ะ
>
> - **การจัดส่งมาตรฐาน** จะใช้เวลา 2–5 วันทำการ และมีค่าใช้จ่าย 50 บาท
> - **จัดส่งฟรีสำหรับคำสั่งซื้อที่มีมูลค่าตั้งแต่ 200 บาทขึ้นไป**
>
> หากคำสั่งซื้อของคุณมีมูลค่าน้อยกว่า 200 บาท คุณจะต้องชำระค่าจัดส่งตามที่กำหนดนะคะ.

**LLM actually answered — run 2** (◐, 3.57s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> การจัดส่งมาตรฐานจะมีค่าใช้จ่าย 50 บาท แต่ถ้าคุณซื้อสินค้ามูลค่า 200 บาทขึ้นไป การจัดส่งจะเป็นฟรีครับ
>
> สำหรับบริการส่งด่วนภายในวันเดียว จะมีให้บริการเฉพาะในกรุงเทพฯ และคุณต้องชำระเงินค้างก่อนนะครับ

**LLM actually answered — run 3** (◐, 4.02s, intent `store_policy`, cards: floral silk shirt, shirt test, Linen Shirt):

> การจัดส่งมาตรฐานจะมีค่าใช้จ่ายอยู่ที่ **50 บาท** แต่หากคำสั่งซื้อของคุณมียอดกว่า **200 บาท** คุณสามารถได้รับบริการจัดส่งฟรี哦，这里是错误的提示，请忽略这个答案。以下是正确的回答：
>
> ค่าจัดส่งมาตรฐานอยู่ที่ **50 บาท** แต่หากยอดสั่งซื้อของคุณมากกว่า **200 บาท** จะได้รับบริการจัดส่งฟรีภายใน 2–5 วันทำการครับ

**Grade notes:** Run 1 is fully correct. Run 2 makes up a 'pay first' condition for same-day delivery. Run 3 inserts a Chinese sentence. Cause: LLM.

### Q14 · EN · policy · ✓ ✓ ✓

**Question:** Can I return a shirt if it doesn't fit?

**Correct answer must:** Yes within 7 days of receipt; unworn, unwashed, tags on; start via chat

**LLM actually answered — run 1** (✓, 3.09s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Certainly! You can return a shirt if it doesn't fit within 7 days of receiving your order. Just make sure the item is unworn, unwashed, and still has its original tags attached. Contact us via chat to start the return process.

**LLM actually answered — run 2** (✓, 3.05s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Certainly! You can return a shirt if it doesn't fit within 7 days of receiving your order. Just make sure the item is unworn, unwashed, and still has its original tags attached. Feel free to contact us via chat to start the return process.

**LLM actually answered — run 3** (✓, 3.0s, intent `store_policy`, cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Yes, you can return a shirt if it doesn't fit within 7 days of receipt. Just ensure the item is unworn and still has its original tags attached. Contact us via chat to start the return process.

**Grade notes:** All runs correct.

### Q15 · TH · policy · ✓ ✓ ◐

**Question:** จ่ายเงินช่องทางไหนได้บ้าง

**Correct answer must:** Credit/debit card (Visa, Mastercard), PromptPay QR, COD

**LLM actually answered — run 1** (✓, 3.22s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> ท่านสามารถชำระเงินผ่านช่องทางเหล่านี้ได้:
>
> - **บัตรเครดิต / บัตรเดบิต** (Visa, Mastercard)
> - **พร้อมเพย์ QR code**
> - **เก็บเงินปลายทาง (COD)**

**LLM actually answered — run 2** (✓, 3.24s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> คุณสามารถชำระเงินผ่านช่องทางเหล่านี้ได้:
>
> - บัตรเครดิต / บัตรเดบิต (Visa, Mastercard)
> - พร้อมเพย์ QR code
> - เก็บเงินปลายทาง (COD)

**LLM actually answered — run 3** (◐, 3.66s, intent `store_policy`, cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> ท่านสามารถชำระเงินผ่านช่องทางเหล่านี้ได้:
>
> - **Visa, Mastercard**: สำหรับการชำระโดยใช้บัตรเครดิต/เดบิต
> - **พร้อมเพย์ QR code**: สำหรับการโอนเงินผ่านแอปพลิเคชันพร้อมเพย์
> - **เก็บเงินปลายทาง (COD)**: สำหรับการชำระเงินเมื่อรับสินค้าที่ร้านتسليمของ

**Grade notes:** Run 3 describes COD as 'receive at the shop' and includes Arabic characters. Cause: LLM.

### Q16 · EN · policy · ✓ ✓ ✓

**Question:** Do you have any discount codes right now?

**Correct answer must:** WELCOME10 (10%, min 500) and SAVE100 (100 THB off, min 1000); must NOT mention expired SUMMER15/TESTUAT15

**LLM actually answered — run 1** (✓, 3.72s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have a couple of discount codes available:
>
> - **SAVE100**: Get 100 THB off when your order is at least 1000 THB. This code expires on December 10, 2026.
> - **WELCOME10**: Enjoy 10% off with a minimum order of 500 THB. This one is valid until June 10, 2027.
>
> Would you like to know more about our products or apply any of these codes?

**LLM actually answered — run 2** (✓, 3.58s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have two active discount codes:
>
> - **SAVE100**: Get 100 THB off when your order is at least 1000 THB. This code expires on December 10, 2026.
> - **WELCOME10**: Enjoy 10% off with a minimum order of 500 THB. This offer ends on June 10, 2027.
>
> Feel free to use either of these codes during checkout!

**LLM actually answered — run 3** (✓, 3.57s, intent `store_policy`, cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have two active discount codes:
>
> - **SAVE100**: Get 100 THB off when your order is at least 1000 THB. This code expires on December 10, 2026.
> - **WELCOME10**: Enjoy 10% off with a minimum order of 500 THB. This offer ends on June 10, 2027.
>
> Feel free to use these codes at checkout!

**Grade notes:** All runs correct.

### Q17 · TH · oos · ◐ ◐ ✓

**Question:** ขายรองเท้าผ้าใบไหม

**Correct answer must:** Store doesn't sell shoes — politely say so, no invented shoes

**LLM actually answered — run 1** (◐, 3.72s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> 申し訳ありませんが、เรามีรองเท้าผ้าไหมไม่ได้ใน catalogue ของเราค่ะ ในราคาและขนาดที่ระบุมาเป็นเสื้อผ้าและกางเกงผ้าไหมเท่านั้นค่ะ หากคุณสนใจเสื้อหรือกางเกงผ้าไหมของเรา เราขอแนะนำให้ลองดูสินค้าที่เราแสดงไว้ค่ะ หรือหากมีคำถามเพิ่มเติมสามารถสอบถามได้เลยนะคะ.

**LLM actually answered — run 2** (◐, 3.97s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ขอโทษค่ะ但我们没有销售帆布丝绸凉鞋的产品。如果您感兴趣，我们有几款丝绸衬衫供您选择：
>
> - **เสื้อเชิ้ตไหมลายเงาใบไม้** ราคา 150 THB, มีขนาด M และสีเขียว
> - **เชิ้ต เทส** ราคา 150 THB, มีขนาด L (เท่าน้ำตาล) และ M (เท่าน้ำเงิน)
>
> คุณสามารถเลือกซื้อเสื้อไหมเหล่านี้เพื่อไปใช้งานหรือใส่ในโอกาสพิเศษนะคะ。

**LLM actually answered — run 3** (✓, 4.28s, intent `product_info`, cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ขออภัยค่ะ ในรายการของเราไม่มีรองเท้าผ้าใบไหมให้เลือกนะคะ แต่เรามีเสื้อเชิ้ตไหมที่คุณอาจจะชอบ
>
> - **เสื้อเชิ้ตไหมลายเงาใบไม้** (Leaf Shadow Silk Shirt) - ราคา 150 บาท
>   - ขนาด: M
>   - สี: เขียว
>   - แขนสั้น
>   - มีลวดลายใบไม้ที่ซ้อนกันอย่างแน่นหนา ให้ความรู้สึกสุขุมและเรียบหรู
>
> ถ้าคุณสนใจเสื้อเชิ้ตไหมชิ้นนี้ สามารถเลือกสีเขียวในขนาด M ได้เลยค่ะ

**Grade notes:** All runs correctly say no shoes. Runs 1 and 2 open in Japanese/Chinese. 'ผ้าใบไหม' still pulls silk products, so replies talk about 'silk shoes'. Cause: Retrieval + LLM.

### Q18 · EN · oos · ✓ ✓ ✓

**Question:** Can you help me write my homework essay?

**Correct answer must:** Polite refusal / out of scope

**LLM actually answered — run 1** (✓, 2.2s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**LLM actually answered — run 2** (✓, 2.2s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**LLM actually answered — run 3** (✓, 2.21s, intent `out_of_scope`, cards: —):

> Sorry, I can only help with questions about products

**Grade notes:** All runs correct.

### Q19 · TH · mixed · ◐ ◐ ✗

**Question:** มี polo สี white size XL ไหม

**Correct answer must:** Yes — e.g. Corn Polo / Ribbed Polo / Solid Polo in White XL (any correct real one); reply in Thai

**LLM actually answered — run 1** (◐, 3.1s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีเสื้อโปโลแขนสั้นสีขาวขนาด XL ในคละต้องการครับ มีอยู่ 48 ชิ้นในคลังสินค้าครับ

**LLM actually answered — run 2** (◐, 3.08s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีเสื้อโปโลแขนสั้นสีขาวไซ즈XLในหมวดหมู่ "Solid Polo" มีอยู่ 48 ตัวในคลังสินค้าครับ

**LLM actually answered — run 3** (✗, 3.61s, intent `stock_check`, cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีเสื้อโปโลสีขาวไซ즈 XL ใน category ริบบ์ดี้ (Ribbed Polo) อยู่ 48 เซ็ทในสต็อกค่ะ ถ้าไม่ใช่categoryนี้คุณยังสามารถเลือกเสื้อโปโลสีขาวไซ즈 XL จาก category ที่เหลือได้ 48 เซ็ทเช่นเดียวกันค่ะ.

**Grade notes:** Stock 48 is correct, and run 2 now names Solid Polo (the prompt fix helps). Runs 1 and 2 still have garbled text or a stray Korean character. Run 3 credits it to Ribbed Polo (no white XL) and makes up 'other categories also have 48'. Cause: LLM.

### Q20 · EN · mixed · ✓ ◐ ✓

**Question:** I want a shirt for the beach, something light, under 300 baht

**Correct answer must:** Suggests real items ≤300 THB (silk shirts 150 THB, maybe Swim Shorts); must not suggest Linen Shirt as under 300

**LLM actually answered — run 1** (✓, 3.79s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> For your beachwear needs, here are some options that might suit you:
>
> - **Fern Line Silk Shirt**: This silk shirt features a delicate fern and palm frond pattern. It's light, perfect for warm weather, and under 300 THB at 150 THB.
>   - Size: M
>   - Color: Red
>
> - **Leaf Shadow Silk Shirt**: Another option is the Leaf Shadow Silk Shirt, which has a soft, shadow-like effect from densely layered leaves. It’s also made of silk and under 300 THB at 150 THB.
>   - Size: M
>   - Color: Green

**LLM actually answered — run 2** (◐, 3.95s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> For your beach day, you might like our **Fern Line Silk Shirt**. It's made from lightweight silk and features fine-lined fern motifs, perfect for a relaxed tropical feel.
>
> - **Price:** 150 THB
> - **Size:** M
> - **Color:** Red
>
> Alternatively, the **Leaf Shadow Silk Shirt** is also a great choice with its subtle botanical pattern that adds a calm look. However, it might be slightly out of your price range at 150 THB.
>
> - **Price:** 150 THB
> - **Size:** M
> - **Color:** Green
>
> Both shirts are lightweight and will keep you cool in warm weather!

**LLM actually answered — run 3** (✓, 4.49s, intent `product_info`, cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> Sure! For a beach outfit, you might like the **Fern Line Silk Shirt** or the **Leaf Shadow Silk Shirt**. Both are made from silk and have short sleeves to keep you cool.
>
> - **Fern Line Silk Shirt**: 
>   - **Price:** 150 THB
>   - **Size:** M
>   - **Color:** Red (แดง)
>   - **Description:** This shirt features fine-lined fern and palm frond motifs. It's lightweight and perfect for a relaxed tropical feel.
>
> - **Leaf Shadow Silk Shirt**: 
>   - **Price:** 150 THB
>   - **Size:** M
>   - **Color:** Green (เขียว)
>   - **Description:** This shirt has densely layered, overlapping leaves creating a soft shadow-like effect. It's calm and refined with an understated design.
>
> Both are under 300 THB and will keep you cool at the beach!

**Grade notes:** Run 2 says 150 THB 'might be out of your price range' for a 300 THB budget. Cause: LLM.
