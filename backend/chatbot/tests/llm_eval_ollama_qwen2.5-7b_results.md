# LLM evaluation — local Ollama `qwen2.5:7b`

Run: 2026-10-10 15:14:57 · Script: `backend/chatbot/tests/llm_model_eval.py` · Raw output: `reports/llm_eval_ollama_qwen2.5-7b.json`

Model: `qwen2.5:7b` via local Ollama (no `OPENROUTER_API_KEY`). Embeddings: `bge-m3`. `RAG_TOP_K=3`. Each question was sent in a new conversation with the matching `lang` (`th`/`en`).

The correct answers come from the live database on 2026-10-10 (`products`/`variants`, `store_policies`, `discount_codes`). This run also includes the size-chart fix: the chatbot prompt now labels chest/waist ranges as **inches**, not cm, and converts cm input. Q11 tests that conversion.

**Grading:** ✓ correct = 1 · ◐ partly correct (right core fact, but a wrong detail or wrong language) = 0.5 · ✗ wrong or misleading = 0.  
**Cause:** *Retrieval* = the RAG step didn't return the right products, so any LLM would fail; *LLM* = the right data was in the prompt but the model got it wrong.

> **Correction (same day, after capturing the real prompts):** Q5, Q7 and Q19 were first labelled *LLM*. The prompt turned out not to give the model a usable form of the fact: product_info gets no per-variant colour↔size rows, and stock and size rows are keyed by product IDs that the Product Data block never shows. Those three are now labelled *Prompt* / *Prompt + LLM*. Details are in `llm_eval_ollama_qwen2.5-7b_after_fixes_results.md`, finding 3. **Cause:** *Prompt* = the needed fact wasn't in the prompt in a usable form.

## Summary

| | Score | % |
|---|---|---|
| **Overall** | **14.5 / 20** | **72.5%** |
| Thai questions | 4.5 / 10 | 45% |
| English questions | 10 / 10 | 100% |

✓ 13 · ◐ 3 · ✗ 4 · Avg latency 4.5s (max 13.8s, first call includes model warm-up) · HTTP errors 0

**Key findings**

1. **English is perfect (10/10), Thai is weak (4.5/10).** Every failure or partial answer is on a Thai question.
2. **Chinese leaks into Thai replies:** 3 of 10 Thai answers (Q7, Q13, Q19) switch to Chinese. This is a known `qwen2.5:7b` weakness and would be unacceptable in a live demo.
3. **3 failures come from retrieval, not the LLM** (Q1 polo, Q3 shorts, Q9 linen). Thai category words (โปโล, กางเกงขาสั้น, เชิ้ตลินิน) didn't pull the right products into the top 3. A better LLM **won't fix these**, so the retrieval step needs its own fix.
4. **Policy, discount and size answers are reliable** (Q11–Q16, apart from the Chinese in Q13). The cm→inch fix works (Q11).
5. **Out-of-stock handling is unreliable:** Q7 claims stock that doesn't exist, and Q9 says 'yes' to a colour that doesn't exist.

## Results

| # | Lang | Type | Question | Grade | Cause |
|---|---|---|---|---|---|
| 1 | TH | product | แนะนำเสื้อโปโลหน่อย | ✗ | Retrieval |
| 2 | EN | product | Do you have linen shirts? | ✓ | — |
| 3 | TH | product | มีกางเกงขาสั้นอะไรบ้าง | ✗ | Retrieval |
| 4 | EN | product | What's the cheapest shirt you sell? | ✓ | — |
| 5 | TH | product | อยากได้เสื้อยืดสีดำ | ◐ | Prompt |
| 6 | EN | product | Compare the Linen Shirt and the Heavyweight T-Shirt | ✓ | — |
| 7 | TH | stock | กางเกงผ้าไหมมีของไหม | ✗ | Prompt + LLM |
| 8 | EN | stock | Is the Linen Shirt available in white size M? | ✓ | — |
| 9 | TH | stock | เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม | ✗ | Retrieval + LLM |
| 10 | EN | stock | What colours do the Swim Shorts come in? | ✓ | — |
| 11 | TH | size | รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร | ✓ | — |
| 12 | EN | size | My chest is 49 inches, which size Heavyweight T-Shirt should I get? | ✓ | — |
| 13 | TH | policy | ค่าส่งเท่าไหร่ ส่งฟรีไหม | ◐ | LLM |
| 14 | EN | policy | Can I return a shirt if it doesn't fit? | ✓ | — |
| 15 | TH | policy | จ่ายเงินช่องทางไหนได้บ้าง | ✓ | — |
| 16 | EN | policy | Do you have any discount codes right now? | ✓ | — |
| 17 | TH | oos | ขายรองเท้าผ้าใบไหม | ✓ | — |
| 18 | EN | oos | Can you help me write my homework essay? | ✓ | — |
| 19 | TH | mixed | มี polo สี white size XL ไหม | ◐ | Prompt |
| 20 | EN | mixed | I want a shirt for the beach, something light, under 300 baht | ✓ | — |

## Question-by-question

### Q1 · TH · product · ✗

**Question:** แนะนำเสื้อโปโลหน่อย

**Correct answer must:** Lists real polos from the catalogue (e.g. Solid Polo, Ribbed Polo, Corn Polo), price ~200–250 THB; no invented products

**LLM actually answered** (13.82s, intent `product_info`, product cards: shirt test, Linen Shirt, Abstract Swirl Silk Shirt):

> ขออภัยค่ะ ในรายการสินค้าของเรากำลังขายเสื้อเชิ้ตเท่านั้น ไม่มีเสื้อโปโลให้เลือกครับ 
>
> แต่เรามีเสื้อเชิ้ตบางแบบที่ใกล้เคียง เช่น
> - **เสื้อเชิ้ตลินิน** มีราคา 390 บาท มีสีขาว ครีม และเบจ ซึ่งเป็นเสื้อลำลองแขนสั้นทำจากผ้าลินินที่สบายและเหมาะกับอากาศอบอุ่น
> - **เชิ้ต เทส** มีราคา 150 บาท มีขนาด M และ L สีชมพู และเทา ซึ่งเป็นเสื้อเชิ้ตแขนยาวลายทาง
>
> หวังว่าจะช่วยให้คุณตัดสินใจได้ครับ

**Grade:** ✗ — cause: Retrieval. Says the shop has no polos. Retrieval returned only shirts (no polo card), so the model answered from the wrong products.

### Q2 · EN · product · ✓

**Question:** Do you have linen shirts?

**Correct answer must:** Yes — Linen Shirt, 390 THB, Beige/Cream/White, M/L/XL

**LLM actually answered** (3.82s, intent `product_info`, product cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> Yes, we do have linen shirts. Here are the details:
>
> - **Linen Shirt**: Made from lightweight, breathable fabric for a soft and comfortable feel. Available in sizes L, M, XL. Colors include Beige, Cream, and White. The price is 390 THB.
> - This shirt is perfect for everyday wear, especially in warm weather due to its relaxed design.

**Grade:** ✓. All facts correct.

### Q3 · TH · product · ✗

**Question:** มีกางเกงขาสั้นอะไรบ้าง

**Correct answer must:** Heavyweight Shorts (150 THB) and Swim Shorts (200 THB)

**LLM actually answered** (4.58s, intent `product_info`, product cards: Silk Pants):

> จากข้อมูลที่มี ไม่มีกางเกงขาสั้นในรายการ เราขอแนะนำ **Silk Pants (กางเกงผ้าไหม)** แทนค่ะ ซึ่งเป็นกางเกงขายาวทรงกระบอก มีให้เลือกหลายสีและขนาดตามที่ได้ระบุไว้:
>
> - **สี**: ขาว, ครีม, ดำ, น้ำเงิน, เขียวมะกอก, เทา
> - **ขนาด**: 30, 32, 34
>
> ถ้าสนใจสามารถเลือกซื้อได้เลยค่ะ หากต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่น ๆ สามารถแจ้งได้เลยนะคะ.

**Grade:** ✗ — cause: Retrieval. Says there are no shorts and recommends Silk Pants (long trousers, and out of stock). Retrieval never returned Heavyweight Shorts / Swim Shorts.

### Q4 · EN · product · ✓

**Question:** What's the cheapest shirt you sell?

**Correct answer must:** Silk shirts at 150 THB (e.g. Monstera / Fern Line / floral silk shirt); must not quote a lower price

**LLM actually answered** (3.31s, intent `product_info`, product cards: Linen Shirt, Zip Collar Polo, Leaf Shadow Silk Shirt):

> The **Leaf Shadow Silk Shirt** is the cheapest option we have at **150 THB**. It features a subtle botanical pattern and comes in a single color, **Green**. Here are its details:
>
> - **Color:** Green (เขียว)
> - **Sleeve Length:** Short
> - **Size:** M

**Grade:** ✓. 150 THB is correct (several silk shirts tie at 150).

### Q5 · TH · product · ◐

**Question:** อยากได้เสื้อยืดสีดำ

**Correct answer must:** Heavyweight T-Shirt, Black (XL), 200 THB

**LLM actually answered** (4.71s, intent `product_info`, product cards: Heavyweight T-Shirt, Heavyweight Shorts):

> เรามี **Heavyweight T-Shirt** สี **ดำ** ราคา 200 บาท มาแนะนำให้ค่ะ
>
> - ขนาด: L, M, XL
> - รายละเอียด: เสื้อยืดแขนสั้นเนื้อผ้าหนา ออกแบบมาเพื่อเพิ่มความอบอุ่นในอากาศเย็น มีลายถักที่สวยงาม และมาพร้อมกับกางเกงขาสั้นหนาให้คุณสวมใส่คู่กันได้
>
> หากไม่มีขนาดที่เหมาะสม คุณยังสามารถเลือกกางเกงขาสั้นหนาสีดำของเรามาเป็นตัวเลือกได้ ราคาอยู่ที่ 150 บาท และมีขนาด 32, 34, 36 ให้เลือกค่ะ

**Grade:** ◐ — cause: Prompt. Right product and price, but says black comes in L/M/XL; black is XL only. Adds an invented 'knit pattern / warm' description.

### Q6 · EN · product · ✓

**Question:** Compare the Linen Shirt and the Heavyweight T-Shirt

**Correct answer must:** Linen 390 THB vs Heavyweight T-Shirt 200 THB; colours/sizes correct

**LLM actually answered** (7.66s, intent `product_info`, product cards: Heavyweight T-Shirt, Heavyweight Shorts, Linen Shirt):

> The **Linen Shirt** and the **Heavyweight T-Shirt** have some key differences:
>
> - The **Linen Shirt** (390 THB) is made from a lightweight, breathable fabric. It comes in sizes L, M, XL with colors Beige, Cream, White. It's perfect for warm weather and everyday wear.
> - The **Heavyweight T-Shirt** (200 THB) is designed for cooler weather with its thicker fabric. Available in sizes L, M, XL in Black, Grey, White. It features a distinctive textured knit pattern and cross-shaped detailing.
>
> Both offer short sleeves but differ greatly in price and suitability for different seasons.

**Grade:** ✓. Prices, colours and sizes correct for both.

### Q7 · TH · stock · ✗

**Question:** กางเกงผ้าไหมมีของไหม

**Correct answer must:** Silk Pants are OUT OF STOCK (stock 0 on every variant) — must not say available

**LLM actually answered** (3.35s, intent `stock_check`, product cards: Silk Pants):

> ขออภัยค่ะ ตามข้อมูลที่มี 目前库存显示所有尺寸的丝绸长裤暂时都没有白色、米色、灰色的颜色可供选择。建议您可以考虑其他颜色，比如蓝色或橄榄绿，这些颜色都有在库存中。如果有需要，我可以帮您检查是否有其他颜色的库存哦！

**Grade:** ✗ — cause: Prompt + LLM. Switches to Chinese mid-reply and claims blue/olive are in stock; every Silk Pants variant is 0.

### Q8 · EN · stock · ✓

**Question:** Is the Linen Shirt available in white size M?

**Correct answer must:** Yes — White/M in stock (45)

**LLM actually answered** (3.03s, intent `stock_check`, product cards: Linen Shirt, Heavyweight T-Shirt, Multi-Stripe Knit Polo):

> Yes, the Linen Shirt (เสื้อเชิ้ตลินิน) is available in **white** size **M**, with 45 pieces left in stock.

**Grade:** ✓. Correct, including stock 45.

### Q9 · TH · stock · ✗

**Question:** เสื้อเชิ้ตลินินสีดำไซส์ M มีไหม

**Correct answer must:** No black Linen Shirt exists (only Beige/Cream/White) — must say not available

**LLM actually answered** (3.31s, intent `stock_check`, product cards: Monstera Silk Shirt, shirt test, Solid Polo):

> มีค่ะ เสื้อเชิ้ต Monstera Silk Shirt สีดำไซส์ M ในราคา 150 บาท ยังมีอยู่ 48 ชิ้นนะคะ.

**Grade:** ✗ — cause: Retrieval + LLM. Answers 'มีค่ะ' with a different product (Monstera Silk Shirt) and a wrong stock count (48, real 67). Never says the Linen Shirt has no black.

### Q10 · EN · stock · ✓

**Question:** What colours do the Swim Shorts come in?

**Correct answer must:** 10 colours: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, Yellow; size 30 only

**LLM actually answered** (2.98s, intent `product_info`, product cards: Swim Shorts, Heavyweight Shorts, Pebble Knit Polo):

> The swim shorts are available in several colors: Black, Cyan, Green, Navy, Olive, Pink, Red, Sky Blue, White, and Yellow.

**Grade:** ✓. All 10 colours correct.

### Q11 · TH · size · ✓

**Question:** รอบอก 114 ซม. ใส่เสื้อเชิ้ตลินินไซส์อะไร

**Correct answer must:** Size L — 114 cm ≈ 44.9 in, chart is in inches (L = chest 44–46)

**LLM actually answered** (3.92s, intent `size_guide`, product cards: shirt test, Monstera Silk Shirt, Leaf Shadow Silk Shirt):

> รอบอกของคุณ 114 ซม. แปลเป็นนิ้วคือ 45.28 นิ้ว แนะนำว่าควรลองขนาด **L** สำหรับเสื้อเชิ้ตในคละสินค้านี้ครับ
>
> - ไซส์ L มีรอบอก 44.0–46.0 นิ้ว
> - ไซส์ M มีรอบอก 42.0–44.0 นิ้ว
>
> ขนาด L จะเหมาะสมกว่าสำหรับคุณครับ

**Grade:** ✓. Converts 114 cm → 45.3 in and picks L (cm→inch fix works). The M range it quotes (42–44) belongs to another product, but the recommendation is right.

### Q12 · EN · size · ✓

**Question:** My chest is 49 inches, which size Heavyweight T-Shirt should I get?

**Correct answer must:** Size XL (chest 48–50)

**LLM actually answered** (3.55s, intent `size_guide`, product cards: Heavyweight T-Shirt, Heavyweight Shorts):

> Based on your chest measurement of 49 inches, you would be best suited for the **XL** size of the Heavyweight T-Shirt. Here’s why:
>
> - **XL**: Chest size ranges from 48.0 to 50.0 inches, which matches your measurement perfectly.
>
> This size will provide a comfortable fit and ensure you look great in this stylish t-shirt!

**Grade:** ✓. XL, 48–50 in. Correct.

### Q13 · TH · policy · ◐

**Question:** ค่าส่งเท่าไหร่ ส่งฟรีไหม

**Correct answer must:** 50 THB flat; free from 200 THB; 2–5 business days

**LLM actually answered** (4.62s, intent `store_policy`, product cards: Linen Shirt, Fern Line Silk Shirt, shirt test):

> การจัดส่งของเรามีดังนี้:
> - สำหรับคำสั่งซื้อที่มูลค่าต่ำกว่า 200 บาท ค่าจัดส่งจะคิดเพิ่มเป็น 50 บาท
> - ถ้าคุณใช้บริการจัดส่งฟรี คำสั่งซื้อของคุณต้องมูลค่า 200 บาทขึ้นไป
>
> เราหวังว่าจะช่วยให้คุณเข้าใจ政策已翻译如下：
>
> 关于运费的信息如下：
> - 如果您的订单金额低于 200 泰铢，我们将额外收取 50 泰铢的运费
> - 您可以选择免费配送服务，但前提是订单金额需要达到 200 泰铢及以上
>
> 希望这些信息能帮助您了解。

**Grade:** ◐ — cause: LLM. 50 THB / free from 200 THB is right, but it then repeats the whole answer in Chinese. Leaves out 2–5 business days.

### Q14 · EN · policy · ✓

**Question:** Can I return a shirt if it doesn't fit?

**Correct answer must:** Yes within 7 days of receipt; unworn, unwashed, tags on; start via chat

**LLM actually answered** (3.17s, intent `store_policy`, product cards: Linen Shirt, floral silk shirt, Crochet Knit Polo Shirt):

> Certainly! You can return a shirt if it doesn't fit within 7 days of receiving your order. Just make sure the item is unworn, unwashed, and still has all its original tags attached. Contact us via chat to start the process.

**Grade:** ✓. All conditions correct.

### Q15 · TH · policy · ✓

**Question:** จ่ายเงินช่องทางไหนได้บ้าง

**Correct answer must:** Credit/debit card (Visa, Mastercard), PromptPay QR, COD

**LLM actually answered** (3.29s, intent `store_policy`, product cards: Zip Collar Polo, Spaced Stripe Knit Polo, Multi-Stripe Knit Polo):

> คุณสามารถชำระเงินผ่านวิธีต่อไปนี้ได้:
>
> - **บัตรเครดิต / บัตรเดบิต** (Visa, Mastercard)
> - **พร้อมเพย์ QR code**
> - **เก็บเงินปลายทาง (COD)**

**Grade:** ✓. All three methods correct.

### Q16 · EN · policy · ✓

**Question:** Do you have any discount codes right now?

**Correct answer must:** WELCOME10 (10%, min 500) and SAVE100 (100 THB off, min 1000); must NOT mention expired SUMMER15/TESTUAT15

**LLM actually answered** (3.61s, intent `store_policy`, product cards: Zip Collar Polo, Silk Pants, Linen Shirt):

> Yes, we currently have two active discount codes:
>
> - **SAVE100**: Get 100 THB off when your order is at least 1000 THB. This code expires on December 10, 2026.
> - **WELCOME10**: Enjoy 10% off with a minimum order of 500 THB. This offer ends on June 10, 2027.
>
> Would you like to know more about any specific products?

**Grade:** ✓. Only the two valid codes, correct conditions and expiry dates; expired codes not mentioned.

### Q17 · TH · oos · ✓

**Question:** ขายรองเท้าผ้าใบไหม

**Correct answer must:** Store doesn't sell shoes — politely say so, no invented shoes

**LLM actually answered** (4.33s, intent `product_info`, product cards: Leaf Shadow Silk Shirt, Spaced Stripe Knit Polo, Linen Shirt):

> ขออภัยค่ะ ในข้อมูลที่ให้มาไม่มีสินค้าประเภทรองเท้าผ้าใบไหม แต่เรามีเสื้อเชิ้ตสำหรับคุณ หากคุณสนใจสามารถดูรายละเอียดได้จากผลิตภัณฑ์เหล่านี้:
>
> - **เสื้อเชิ้ตไหมลายเงาใบไม้ (150 THB)**
>   - ขนาด: M
>   - สี: เขียว
>   - แขนสั้น
>
> - **เสื้อเชิ้ตลินิน (390 THB)**
>   - ขนาด: L, M, XL
>   - สี: ขาว, ครีม, เบจ
>   - แขนสั้น

**Grade:** ✓. Correctly says no shoes and suggests real shirts. Wording is a bit awkward ('รองเท้าผ้าใบไหม').

### Q18 · EN · oos · ✓

**Question:** Can you help me write my homework essay?

**Correct answer must:** Polite refusal / out of scope

**LLM actually answered** (2.23s, intent `out_of_scope`, product cards: —):

> Sorry, I can only help with questions about products

**Grade:** ✓. Canned out-of-scope reply.

### Q19 · TH · mixed · ◐

**Question:** มี polo สี white size XL ไหม

**Correct answer must:** Yes — e.g. Corn Polo / Ribbed Polo / Solid Polo in White XL (any correct real one); reply in Thai

**LLM actually answered** (3.75s, intent `stock_check`, product cards: Zip Collar Polo, Solid Polo, Pinstripe Knit Polo):

> มี Polo สีขาวไซส์XL ในตัวแล้วค่ะ ยังมีจำนวนเหลืออยู่ 48 件呢。
>
> 用户提问：有白色 XL 大小的 polo 衬衫吗？
>
> 当前库存中，白色 XL 大小的 polo 衬衫还有存货。您可以在我们的库存中看到，XL 大小的白色 Polo 衬衫共有 48 件。如果您有兴趣，可以随时选购哦！

**Grade:** ◐ — cause: Prompt. Stock 48 is correct (Solid Polo White XL), but it doesn't name the product and the rest of the reply is in Chinese.

### Q20 · EN · mixed · ✓

**Question:** I want a shirt for the beach, something light, under 300 baht

**Correct answer must:** Suggests real items ≤300 THB (silk shirts 150 THB, maybe Swim Shorts); must not suggest Linen Shirt as under 300

**LLM actually answered** (7.3s, intent `product_info`, product cards: Fern Line Silk Shirt, Linen Shirt, Monstera Silk Shirt):

> For your beach trip, here are two options that fit your criteria:
>
> - **Fern Line Silk Shirt**: 150 THB  
>   Sizes: M  
>   Colors: Red (แดง)  
>   Sleeve: short  
>   A silk shirt featuring fine-lined fern and palm frond motifs. The light and clean botanical pattern creates a relaxed tropical feel, perfect for effortless resort styling.
>
> - **Monstera Silk Shirt**: 150 THB  
>   Sizes: L, M  
>   Colors: Black (ดำ)  
>   Sleeve: short  
>   Featuring large split monstera leaves accented with delicate palm fronds. A classic resort-inspired design with a relaxed, tropical feel.
>
> Both are under 300 THB and offer a light, comfortable option for your beach trip!

**Grade:** ✓. Two real 150 THB silk shirts; Linen Shirt (390) correctly left out.
