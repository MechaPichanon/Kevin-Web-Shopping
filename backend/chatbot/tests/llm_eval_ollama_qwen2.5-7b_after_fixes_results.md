# LLM evaluation after RAG/intent fixes — local Ollama `qwen2.5:7b`

Run: 2026-10-10 15:39:34 · Script: `llm_model_eval.py` · Raw output: `reports/llm_eval_ollama_qwen2.5-7b_after_fixes.json` · Before-fix report: `llm_eval_ollama_qwen2.5-7b_results.md`

Same 20 questions, model and grading as the before-fix run. What changed in between: HIGH-1 (full product text, incl. Thai, embedded for every product), HIGH-2 (raw Thai query embedded), type-filter/Thai-dictionary fix, HIGH-4 (Thai follow-up detection), and CRITICAL-1 (intent classifier on the same LLM backend, temperature 0). Details are in `retrieval_eval_th_results.md`.

**Grading:** ✓ = 1 · ◐ = 0.5 · ✗ = 0. **Cause:** *Retrieval* = wrong products were retrieved; *Prompt* = the needed fact wasn't in the prompt in a usable form (checked by capturing the real prompt for Q5/Q7/Q9/Q11); *LLM* = the fact was there and the model got it wrong.

## Summary

| | Before fixes | After fixes |
|---|---|---|
| **Overall** | **14.5 / 20** | **14.5 / 20** |
| Thai | 4.5 / 10 | 4.5 / 10 |
| English | 10 / 10 | 10 / 10 |
| Errors caused by retrieval | 3 (Q1, Q3, Q9) | **0** full, 1 partial (Q17) |
| Errors involving the prompt-building bug | (not checked) | 5 (Q5, Q7, Q9, Q11, Q19) |
| Thai replies with Chinese text | 3 (Q7, Q13, Q19) | 3 (Q3, Q13, Q17) |
| Avg latency | 4.5s | 3.7s |

**Findings**

1. **Retrieval is fixed. All 3 retrieval failures are gone:** Q1 now gets polos, Q3 gets both shorts, and Q9 correctly says there's no black Linen Shirt.
2. **The total didn't move (14.5 → 14.5).** The errors left now have two causes. One is the model: Chinese text in Thai replies. The other, found by capturing the real prompts, is **a prompt-building bug in `main.py`**.
3. **The prompt-building bug.** The 'Current stock' and 'Size measurement guide' rows are labelled with product IDs (`P1790427699513 | M | White: 45 left`), but the 'Product Data' block above them shows names only, never IDs. The model has no reliable way to know which stock or size rows belong to which product. This explains Q7, Q9, Q11 and Q19 (stock is correct, but the product is never named). Separately, `product_info` questions get no per-variant rows at all, so Q5 couldn't know black is XL only. **A stronger OpenRouter model would be handicapped by this too.**
4. **Run-to-run variance is large.** The same 20 questions were run 3 times with no code change (`reports/…_after_fixes_run2/3.json`, not fully graded):
   - Thai replies with Chinese text: 3, then 4, then 1
   - Q11: M ✗, then 'M or L, try L', then XL ✗
   - Q7: wrong, then right, then right
   The chat call has no fixed temperature, so a single run of a 7B model can swing by a few questions. Compare models over **≥3 runs**.
5. **Q17 got worse because of a retrieval change, not chance.** Embedding the raw Thai makes 'รองเท้าผ้าใบไหม' match silk products: 'ไหม' is the question word, but it also means silk.
6. **Recommendation:** fix the prompt bug (put the product name, or the ID, on both sides) *before* running the OpenRouter comparison. Then re-run qwen as the new baseline, 3 times, and run each OpenRouter candidate 3 times.

## Results

| # | Lang | Type | Question | Before | After | Cause (after) |
|---|---|---|---|---|---|---|
| 1 | TH | product | แนะนำเสื้อโปโลหน่อย | ✗ | ◐ | LLM |
| 2 | EN | product | Do you have linen shirts? | ✓ | ✓ | — |
| 3 | TH | product | มีกางเกงขาสั้นอะไรบ้าง | ✗ | ◐ | LLM |
| 4 | EN | product | What's the cheapest shirt you sell? | ✓ | ✓ | — |
| 5 | TH | product | อยากได้เสื้อยืดสีดำ | ◐ | ◐ | Prompt |
| 6 | EN | product | Compare the Linen Shirt and the Heavyweight T-Shirt | ✓ | ✓ | — |
| 7 | TH | stock | กางเกงผ้าไหมมีของไหม | ✗ | ✗ | Prompt + LLM |
| 8 | EN | stock | Is the Linen Shirt available in white size M? | ✓ | ✓ | — |
| 9 | TH | stock | เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม | ✗ | ◐ | Prompt + LLM |
| 10 | EN | stock | What colours do the Swim Shorts come in? | ✓ | ✓ | — |
| 11 | TH | size | รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร | ✓ | ✗ | Prompt + LLM |
| 12 | EN | size | My chest is 49 inches, which size Heavyweight T-Shirt should I get? | ✓ | ✓ | — |
| 13 | TH | policy | ค่าส่งเท่าไหร่ ส่งฟรีไหม | ◐ | ◐ | LLM |
| 14 | EN | policy | Can I return a shirt if it doesn't fit? | ✓ | ✓ | — |
| 15 | TH | policy | จ่ายเงินช่องทางไหนได้บ้าง | ✓ | ✓ | — |
| 16 | EN | policy | Do you have any discount codes right now? | ✓ | ✓ | — |
| 17 | TH | oos | ขายรองเท้าผ้าใบไหม | ✓ | ◐ | Retrieval + LLM |
| 18 | EN | oos | Can you help me write my homework essay? | ✓ | ✓ | — |
| 19 | TH | mixed | มี polo สี white size XL ไหม | ◐ | ◐ | Prompt |
| 20 | EN | mixed | I want a shirt for the beach, something light, under 300 baht | ✓ | ✓ | — |

## Question-by-question (after fixes)

### Q1 · TH · product · ✗ → ◐

**Question:** แนะนำเสื้อโปโลหน่อย

**Correct answer must:** Lists real polos from the catalogue (e.g. Solid Polo, Ribbed Polo, Corn Polo), price ~200–250 THB; no invented products

**LLM actually answered** (6.14s, intent `product_info`, product cards: Ribbed Polo, Crochet Knit Polo Shirt, Solid Polo):

> แน่นอนค่ะ มีหลายแบบให้เลือกสรร ตามที่คุณสนใจ
>
> - **Ribbed Polo (โปโลริ้ว)** - ราคา 200 บาท, มีไซส์ L, M, XL ลายสีขาว, ครีม, ดำ, น้ำเงิน, ฟ้า, เขียวขี้ม้า, แดง
>   - **รายละเอียด:** เสื้อแขนสั้นทรงคลาสสิกที่มาพร้อมริบบิ้นเรียบๆ และเนื้อผ้าสัมผัสสบาย
>
> - **Crochet Knit Polo Shirt (โปโลลายถัก)** - ราคา 200 บาท, มีไซส์ L, M, XL ลายสีขาว, ครีม, ดำ, น้ำเงิน
>   - **รายละเอียด:** เสื้อแขนสั้นทรงกระชับที่มาพร้อมลวดลายถักโครเชต์ทำให้ลุคเรียบๆ แต่มีความพิเศษ
>
> - **Solid Polo (โปโลพื้น)** - ราคา 200 บาท, มีไซส์ L, M, XL ลายสีขาว, ครีม, ดำ, น้ำตาล, เขียวมะกอก, เขียวใบสน, เทา
>   - **รายละเอียด:** เสื้อแขนสั้นทรงคลาสสิกที่มาพร้อมการ์ดเนียนและหลากหลายลายสี ทำให้สามารถแมตช์ได้หลายสไตล์

**Grade:** ◐ — cause: LLM. Now lists 3 real polos (retrieval fixed). One wrong detail: Crochet Knit Polo is listed in white (ขาว), but its colours are cream/black/blue/green (no white).

### Q2 · EN · product · ✓ → ✓

**Question:** Do you have linen shirts?

**Correct answer must:** Yes — Linen Shirt, 390 THB, Beige/Cream/White, M/L/XL

**LLM actually answered** (3.5s, intent `product_info`, product cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do have linen shirts! Here are the details:
>
> - **Linen Shirt**: 
>   - Price: 390 THB
>   - Sizes: L, M, XL
>   - Colors: Beige, Cream, White
>   - Sleeve: Short
>   - Description: A short-sleeve linen shirt made from lightweight, breathable fabric for a soft and comfortable feel. Its simple and relaxed design makes it easy to wear for everyday occasions, especially in warm weather.

**Grade:** ✓. All facts correct.

### Q3 · TH · product · ✗ → ◐

**Question:** มีกางเกงขาสั้นอะไรบ้าง

**Correct answer must:** Heavyweight Shorts (150 THB) and Swim Shorts (200 THB)

**LLM actually answered** (5.65s, intent `product_info`, product cards: Heavyweight Shorts, Swim Shorts, Silk Pants):

> มีกางเกงขาสั้นให้เลือก 3 แบบค่ะ
>
> - **Heavyweight Shorts** (กางเกงขาสั้นหนา)
>   - ราคา: 150 THB
>   - ขนาด: 32, 34, 36
>   - สี: 黑色, 灰色, 白色 (ขาว, ดำ, เทา)
>
> - **Swim Shorts** (กางเกงขาสั้นว่ายน้ำ)
>   - ราคา: 200 THB
>   - ขนาด: 30
>   - สี: 黑色, 青色, 绿色, 蓝色, 墨绿色, 粉红色, 红色, 天蓝色, 白色, 黄色 (ดำ, ชมพู, แดง, คราม, เขียวมะกอก, ขาว, ฟ้า, เงิน, เทา)
>
> - **Silk Pants** (กางเกงผ้าไหม)
>   - ราคา: 250 THB
>   - ขนาด: 30, 32, 34
>   - สี: 黑色, 蓝色, 奶白色, 灰色, 墨绿色, 白色 (ดำ, น้ำเงิน, ครีม, เทา, ขาว)

**Grade:** ◐ — cause: LLM. Now finds both shorts (retrieval fixed), but writes the colour names in Chinese, and lists Silk Pants (long trousers) as shorts.

### Q4 · EN · product · ✓ → ✓

**Question:** What's the cheapest shirt you sell?

**Correct answer must:** Silk shirts at 150 THB (e.g. Monstera / Fern Line / floral silk shirt); must not quote a lower price

**LLM actually answered** (3.3s, intent `product_info`, product cards: Leaf Shadow Silk Shirt, Heavyweight T-Shirt, Linen Shirt):

> The **Leaf Shadow Silk Shirt** is the cheapest option at **150 THB**. Here are its details:
> - Size: M
> - Color: Green (เขียว)
> - Sleeve: Short
> - Description: A silk shirt featuring a soft shadow-like effect from densely layered, overlapping leaves, giving it a calm and refined look suitable for various outfits.

**Grade:** ✓. 150 THB is correct.

### Q5 · TH · product · ◐ → ◐

**Question:** อยากได้เสื้อยืดสีดำ

**Correct answer must:** Heavyweight T-Shirt, Black (XL), 200 THB

**LLM actually answered** (3.83s, intent `product_info`, product cards: Heavyweight T-Shirt, Heavyweight Shorts):

> ขอแนะนำเสื้อยืดหนาสีดำให้ค่ะ **Heavyweight T-Shirt** มีขายในขนาด M และ XL ราคา **200 THB** ครับ
>
> - **ขนาด:** M, XL
> - **สี:** Black (ดำ)
> - **ลักษณะ:** เสื้อยืดแขนสั้นเนื้อผ้าหนา ออกแบบมาเพื่อความอบอุ่นในอากาศเย็น มีลายถักที่สวยงาม
>
> หากต้องการขนาด L หรือมีคำถามเพิ่มเติมสามารถแจ้งได้เลยนะคะ

**Grade:** ◐ — cause: Prompt. Says black comes in M and XL; black is XL only. **But the prompt only lists `Sizes: L, M, XL` and `Colors: Black, Grey, White` separately** (product_info gets no per-variant stock rows), so the model couldn't know.

### Q6 · EN · product · ✓ → ✓

**Question:** Compare the Linen Shirt and the Heavyweight T-Shirt

**Correct answer must:** Linen 390 THB vs Heavyweight T-Shirt 200 THB; colours/sizes correct

**LLM actually answered** (4.16s, intent `product_info`, product cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> Sure, let's compare the **Linen Shirt** and the **Heavyweight T-Shirt**:
>
> - The **Linen Shirt** is a bit more expensive at 390 THB compared to the **Heavyweight T-Shirt** at 200 THB.
> - In terms of material, the Linen Shirt uses lightweight fabric that's breathable and perfect for warm weather. On the other hand, the Heavyweight T-Shirt has a thicker fabric designed for cooler temperatures.
> - The Linen Shirt offers colors like beige, cream, and white, while the Heavyweight T-Shirt comes in black, grey, and white.
> - Both are short-sleeved but differ slightly in design with the Linen Shirt being more relaxed and casual.
>
> Would you prefer something lighter or heavier based on your needs?

**Grade:** ✓. All facts correct.

### Q7 · TH · stock · ✗ → ✗

**Question:** กางเกงผ้าไหมมีของไหม

**Correct answer must:** Silk Pants are OUT OF STOCK (stock 0 on every variant) — must not say available

**LLM actually answered** (3.72s, intent `stock_check`, product cards: Silk Pants, Heavyweight Shorts, Swim Shorts):

> ขออภัยค่ะ มีกางเกงผ้าไหมในขนาดและสีที่เหลืออยู่ดังนี้:
>
> - **Size:** 30, 32, 34
> - **Color:** White (ขาว), Cream (ครีม), Black (ดำ), Blue (น้ำเงิน), Grey (เทา), Olive (เขียวมะกอก)
>
> ยังเหลืออยู่ในสต็อก หากคุณสนใจสามารถเลือกซื้อได้ค่ะ

**Grade:** ✗ — cause: Prompt + LLM. Says the pants are in stock. The prompt does list every Silk Pants variant as 'out of stock', but those rows are keyed by product ID (`P1785413921520 | 30 | White`), and the Product Data block never shows IDs. In runs 2 and 3 the model answered 'not available', which is correct.

### Q8 · EN · stock · ✓ → ✓

**Question:** Is the Linen Shirt available in white size M?

**Correct answer must:** Yes — White/M in stock (45)

**LLM actually answered** (2.84s, intent `stock_check`, product cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> Yes, the Linen Shirt is available in White, Size M. There are currently 45 pieces left in that combination.

**Grade:** ✓. Correct, including stock 45.

### Q9 · TH · stock · ✗ → ◐

**Question:** เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม

**Correct answer must:** No black Linen Shirt exists (only Beige/Cream/White) — must say not available

**LLM actually answered** (3.36s, intent `stock_check`, product cards: Linen Shirt, Leaf Shadow Silk Shirt, shirt test):

> เสื้อเชิ้ตลินินของเรายังไม่มีจำหน่ายในขนาด M สีดำครับ แต่เรามีให้เลือกในขนาด L และ XL ในสีขาว ครีม และน้ำเบจ ถ้าคุณสนใจเราสามารถช่วยให้คำแนะนำเพิ่มเติมได้นะครับ

**Grade:** ◐ — cause: Prompt + LLM. Correctly says there's no black Linen Shirt (retrieval fixed), but says it only comes in L/XL. `M | White: 45 left` is in the prompt, keyed by product ID only.

### Q10 · EN · stock · ✓ → ✓

**Question:** What colours do the Swim Shorts come in?

**Correct answer must:** 10 colours: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, Yellow; size 30 only

**LLM actually answered** (3.2s, intent `product_info`, product cards: Swim Shorts, Heavyweight Shorts):

> The Swim Shorts are available in several colors:
> - Black (ดำ)
> - Cyan (กรมท่า)
> - Green (เขียว)
> - Navy (น้ำเงิน)
> - Olive (เขียวมะกอก)
> - Pink (ชมพู)
> - Red (แดง)
> - Sky Blue (ฟ้าอมเขียว)
> - White (ขาว)
> - Yellow (เหลือง)

**Grade:** ✓. All 10 colours correct in English (some of the Thai colour glosses are off).

### Q11 · TH · size · ✓ → ✗

**Question:** รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร

**Correct answer must:** Size L — 114 cm ≈ 44.9 in, chart is in inches (L = chest 44–46)

**LLM actually answered** (3.68s, intent `size_guide`, product cards: Linen Shirt, Leaf Shadow Silk Shirt, Fern Line Silk Shirt):

> ตามขนาดรอบอกของคุณ 114 ซม. (ประมาณ 45.28 นิ้ว) ผมจะแนะนำให้เลือกเสื้อเชิ้ตลินินไซส์ M ครับ
>
> - เลือก **ไซส์ M** สำหรับรอบอก 40.0–42.0 นิ้ว
> - สีที่มี: เบจ, ครีม, และขาว

**Grade:** ✗ — cause: Prompt + LLM. Converts 114 cm → 45.28 in correctly, then picks M (40–42). The size-guide rows are keyed by product ID (`P1790427699513 | L | chest 44–46`), with the Linen and silk-shirt rows mixed together. Runs 2 and 3 gave 'M or L, try L' and 'XL'.

### Q12 · EN · size · ✓ → ✓

**Question:** My chest is 49 inches, which size Heavyweight T-Shirt should I get?

**Correct answer must:** Size XL (chest 48–50)

**LLM actually answered** (3.21s, intent `size_guide`, product cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of 49 inches, you would be best suited for the **XL** size of the Heavyweight T-Shirt. This size has a chest range of 48.0–50.0 inches, which fits your measurement perfectly.
>
> Would you like to proceed with ordering the XL size?

**Grade:** ✓. XL, 48–50 in. Correct.

### Q13 · TH · policy · ◐ → ◐

**Question:** ค่าส่งเท่าไหร่ ส่งฟรีไหม

**Correct answer must:** 50 THB flat; free from 200 THB; 2–5 business days

**LLM actually answered** (3.7s, intent `store_policy`, product cards: floral silk shirt, shirt test, Linen Shirt):

> การจัดส่งมาตรฐานของเรามีค่าใช้จ่ายอยู่ที่ 50 บาท สำหรับคำสั่งซื้อที่มูลค่าต่ำกว่า 200 บาท THB
>
> แต่ถ้าคุณสั่งซื้อสินค้าที่มีมูลค่า 200 บาทขึ้นไป คุณจะได้รับบริการจัดส่งฟรี哦，这句不符合规则，请重新用泰语回答。

**Grade:** ◐ — cause: LLM. 50 THB / free from 200 THB is right, but it ends with a Chinese sentence. Leaves out 2–5 days.

### Q14 · EN · policy · ✓ → ✓

**Question:** Can I return a shirt if it doesn't fit?

**Correct answer must:** Yes within 7 days of receipt; unworn, unwashed, tags on; start via chat

**LLM actually answered** (3.18s, intent `store_policy`, product cards: Linen Shirt, floral silk shirt, Leaf Shadow Silk Shirt):

> Yes, you can return a shirt if it doesn't fit within 7 days of receipt. The item must be unworn, unwashed, and with the original tags still attached. To start the process, please contact us via chat to initiate a return.

**Grade:** ✓. All conditions correct.

### Q15 · TH · policy · ✓ → ✓

**Question:** จ่ายเงินช่องทางไหนได้บ้าง

**Correct answer must:** Credit/debit card (Visa, Mastercard), PromptPay QR, COD

**LLM actually answered** (3.26s, intent `store_policy`, product cards: Zip Collar Polo, Spaced Stripe Knit Polo, Solid Polo):

> คุณสามารถชำระเงินผ่านช่องทางเหล่านี้ได้:
>
> - **บัตรเครดิต / บัตรเดบิต** (Visa, Mastercard)
> - **พร้อมเพย์ QR code**
> - **เก็บเงินปลายทาง (COD)**

**Grade:** ✓. All three methods correct.

### Q16 · EN · policy · ✓ → ✓

**Question:** Do you have any discount codes right now?

**Correct answer must:** WELCOME10 (10%, min 500) and SAVE100 (100 THB off, min 1000); must NOT mention expired SUMMER15/TESTUAT15

**LLM actually answered** (3.6s, intent `store_policy`, product cards: Silk Pants, Zip Collar Polo, Leaf Shadow Silk Shirt):

> Yes, we currently have a few discount codes available. Here are the details:
>
> - **SAVE100**: Get 100 THB off when your order is at least 1000 THB. This code expires on December 10, 2026.
> - **WELCOME10**: Enjoy 10% off with a minimum order of 500 THB. This promotion ends on June 10, 2027.

**Grade:** ✓. Only the two valid codes, correct conditions and expiry dates.

### Q17 · TH · oos · ✓ → ◐

**Question:** ขายรองเท้าผ้าใบไหม

**Correct answer must:** Store doesn't sell shoes — politely say so, no invented shoes

**LLM actually answered** (4.91s, intent `product_info`, product cards: Silk Pants, Leaf Shadow Silk Shirt, shirt test):

> ไม่มีสินค้าในรายการของเราที่เป็นรองเท้าผ้าใบไหม哦，您的问题似乎与提供的商品信息不符。我们目前只销售丝质裤装和衬衫，并没有售卖丝质帆布鞋。
>
> 如果您对我们的丝质裤装或衬衫感兴趣，我可以为您介绍：
>
> - **กางเกงผ้าไหม**: ราคา 250 บาท มีให้เลือกสีขาว, ครีม, ดำ, น้ำเงิน, เขียวมะกอก และเทา มีไซส์ 30, 32, 34
> - **เสื้อเชิ้ตไหมลายเงาใบไม้**: ราคา 150 บาท มีให้เลือกสีเขียว มีไซส์ M
>
> ทั้งสองชิ้นงานทำจากผ้าไหมและมีลวดลายสวยงาม สุขุม เรียบหรู คุณสามารถเลือกสวมใส่ได้ตามโอกาสต่างๆ หากต้องการข้อมูลเพิ่มเติม กรุณาบอกนะครับ

**Grade:** ◐ — cause: Retrieval + LLM. Correctly says no shoes, but most of the reply is in Chinese. Side effect of embedding the raw Thai: 'รองเท้าผ้าใบไหม' (ไหม = question word, but also 'silk') now pulls Silk Pants first, and the model talks about silk.

### Q18 · EN · oos · ✓ → ✓

**Question:** Can you help me write my homework essay?

**Correct answer must:** Polite refusal / out of scope

**LLM actually answered** (2.22s, intent `out_of_scope`, product cards: —):

> Sorry, I can only help with questions about products

**Grade:** ✓. Canned out-of-scope reply.

### Q19 · TH · mixed · ◐ → ◐

**Question:** มี polo สี white size XL ไหม

**Correct answer must:** Yes — e.g. Corn Polo / Ribbed Polo / Solid Polo in White XL (any correct real one); reply in Thai

**LLM actually answered** (3.21s, intent `stock_check`, product cards: Solid Polo, Zip Collar Polo, Ribbed Polo):

> มีเสื้อโปโลสีขาวขนาด XL ในสต็อกอยู่ค่ะ ยังมีให้เลือก 48 ชิ้นนะคะ.

**Grade:** ◐ — cause: Prompt. All in Thai and stock 48 is correct (Solid Polo White XL), but it doesn't name the product. That stock row only carries the product ID, which is why the product is never named.

### Q20 · EN · mixed · ✓ → ✓

**Question:** I want a shirt for the beach, something light, under 300 baht

**Correct answer must:** Suggests real items ≤300 THB (silk shirts 150 THB, maybe Swim Shorts); must not suggest Linen Shirt as under 300

**LLM actually answered** (4.07s, intent `product_info`, product cards: Linen Shirt, Fern Line Silk Shirt, Leaf Shadow Silk Shirt):

> For your beach trip, here are two options that fit your criteria:
>
> - **Fern Line Silk Shirt**: At 150 THB, this is one of our most affordable silk shirts. It features a delicate fern and palm frond pattern in red and has short sleeves for a light feel. The airy botanical design makes it perfect for the beach.
>
> - **Leaf Shadow Silk Shirt**: Also priced at 150 THB, this shirt has a green, leaf-inspired design that creates a soft shadow-like effect. With its lightweight silk material and simple design, it's ideal for a relaxed and comfortable wear by the beach.
>
> Both shirts are made from light materials suitable for warm weather and offer a casual yet stylish look perfect for your beachwear needs!

**Grade:** ✓. Two real 150 THB silk shirts; Linen Shirt (390) correctly left out of the reply.
