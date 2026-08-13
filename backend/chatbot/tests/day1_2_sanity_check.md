# Day 1–2 Manual Sanity Check
**Target:** All 7 intents respond correctly in Thai and English  
**Method:** Copy each question into the chatbot, record Pass / Fail / Notes  
**Pass criteria:** Response addresses the correct topic and language matches the question

> ⚠️ = known gap question (expected to misfire — document the actual result, don't skip)

---

## PRODUCT_INFO (8 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1 | EN | Tell me about the slim fit cotton shirt | SS01 name, colors (White/Black/Blue), price ~890 THB, slim fit description | | |
| 2 | EN | What jackets do you have? | JK01 Lightweight Windbreaker, colors, price 1299 THB | | |
| 3 | EN | How much does the windbreaker cost? | 1299 THB | | |
| 4 | EN | Show me your t-shirts | TS01 Basic Cotton T-Shirt details | | |
| 5 | TH | มีเสื้ออะไรบ้าง | รายชื่อสินค้าเสื้อ (SS01, CS01, TS01) ตอบเป็นภาษาไทย | | |
| 6 | TH | เสื้อยืดมีสีอะไรบ้าง | สีของ TS01 ตอบเป็นภาษาไทย | | |
| 7 | TH | แจ็กเก็ตมีราคาเท่าไหร่ | 1299 บาท ตอบเป็นภาษาไทย | | |
| 8 | TH | บอกรายละเอียดกางเกงชิโนหน่อย | PT01 description, ราคา, ไซส์ ตอบเป็นภาษาไทย | | |

---

## PRODUCT_COMPARE (6 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 9  | EN | Compare the slim fit shirt and the casual shirt | SS01 vs CS01 — fit, price, sleeve difference | | |
| 10 | EN | What's the difference between the jacket and the pants? | JK01 vs PT01 — category, price, use case | | |
| 11 | EN | Slim fit shirt vs t-shirt, which is better? | SS01 vs TS01 — collar, formality, price | | |
| 12 | TH | compare เสื้อเชิ้ตกับเสื้อยืดให้หน่อย | เปรียบเทียบ SS01/CS01 vs TS01 | | |
| 13 | TH | เสื้อเชิ้ตสลิม vs เสื้อลำลอง อันไหนดีกว่า | SS01 vs CS01 เปรียบเทียบ | | |
| 14 | TH ⚠️ | เสื้อเชิ้ตกับเสื้อยืดต่างกันยังไง | **Gap:** no Thai compare keyword — likely falls to PRODUCT_INFO. Document actual intent. | | |

---

## SIZE_GUIDE (6 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 15 | EN | My chest is 95cm, what size should I get? | Recommend size M or L based on variant measurements | | |
| 16 | EN | What size fits me if my chest measurement is 88cm? | Recommend size S | | |
| 17 | EN | Can you show me the size guide for shirts? | chest_min/max table for S/M/L/XL | | |
| 18 | TH | รอบอกฉัน 92 ซม. ควรใส่ไซส์อะไร | แนะนำ M ตอบเป็นภาษาไทย | | |
| 19 | TH | ไซส์ไหนที่เหมาะ ถ้ารอบอก 96 ซม. | แนะนำ L ตอบเป็นภาษาไทย | | |
| 20 | TH | วัดตัวได้ 90 ซม. ควรสั่งไซส์อะไร | แนะนำ S หรือ M ตอบเป็นภาษาไทย | | |

---

## STOCK_CHECK (6 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 21 | EN | Is the slim fit shirt in stock in black size M? | Confirm SS01 Black M stock level (should have stock) | | |
| 22 | EN | How many olive green jackets are left? | JK01 Olive Green stock count | | |
| 23 | EN | Is the basic t-shirt out of stock? | TS01 stock status | | |
| 24 | TH | jacket สีดำไซส์ M มีของไหม | JK01 Black M มีสินค้า ตอบเป็นภาษาไทย | | |
| 25 | TH | shirt ไซส์ S มีเหลือไหม | SS01 หรือ CS01 ไซส์ S ตอบเป็นภาษาไทย | | |
| 26 | TH ⚠️ | เสื้อเชิ้ตสีขาวไซส์ L มีไหม | **Gap:** มีไหม ไม่มี English product token — likely falls to PRODUCT_INFO. Document actual intent. | | |

---

## STORE_POLICY (6 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 27 | EN | How long does shipping take? | 2–5 business days, 50 THB flat, free over 999 THB | | |
| 28 | EN | What's your return policy? | 7 days, unworn/unwashed, contact via chat | | |
| 29 | EN | Do you accept PromptPay? | PromptPay QR, card, COD listed | | |
| 30 | TH | ส่งสินค้ากี่วัน | 2–5 วันทำการ ค่าส่ง 50 บาท ตอบเป็นภาษาไทย | | |
| 31 | TH | คืนสินค้าได้ไหม ถ้าไม่ชอบ | คืนได้ภายใน 7 วัน เงื่อนไข ตอบเป็นภาษาไทย | | |
| 32 | TH | รับชำระเงินช่องทางไหนบ้าง | บัตรเครดิต พร้อมเพย์ COD ตอบเป็นภาษาไทย | | |

---

## DISCOUNT_QUERY (4 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 33 | EN | Do you have any discount codes? | Mention WELCOME10 (10%), SAVE100 (100 THB off), SUMMER15 (15%) | | |
| 34 | EN | Any current promotions or deals? | List active codes | | |
| 35 | TH | มีโค้ดส่วนลดไหม | รายการโค้ด ตอบเป็นภาษาไทย | | |
| 36 | TH | มีของลดราคาบ้างไหม | ส่วนลดที่มีอยู่ ตอบเป็นภาษาไทย | | |

---

## OUT_OF_SCOPE (4 questions)

| # | Lang | Question | Expected response should cover | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 37 | EN | What's the weather like today? | Polite refusal — only handles clothing/store questions | | |
| 38 | EN | Can you recommend a good restaurant nearby? | Polite refusal | | |
| 39 | TH | ช่วยทำการบ้านให้หน่อยได้ไหม | ปฏิเสธสุภาพ บอกขอบเขตของ chatbot | | |
| 40 | TH | วันนี้หุ้นราคาเท่าไหร่ | ปฏิเสธสุภาพ ตอบเป็นภาษาไทย | | |

---

## Summary Scorecard

| Intent | Total | Pass | Fail | Pass Rate |
|---|---|---|---|---|
| PRODUCT_INFO | 8 | | | |
| PRODUCT_COMPARE | 6 | | | |
| SIZE_GUIDE | 6 | | | |
| STOCK_CHECK | 6 | | | |
| STORE_POLICY | 6 | | | |
| DISCOUNT_QUERY | 4 | | | |
| OUT_OF_SCOPE | 4 | | | |
| **TOTAL** | **40** | | | |

---

## Known Gaps to Watch (⚠️ questions)

| # | Question | Gap | Impact |
|---|---|---|---|
| 14 | เสื้อเชิ้ตกับเสื้อยืดต่างกันยังไง | Thai compare words (ต่างกัน, เปรียบเทียบ) not in compare_keywords | Misclassifies to PRODUCT_INFO |
| 26 | เสื้อเชิ้ตสีขาวไซส์ L มีไหม | STOCK_CHECK requires English product token — Thai-only stock questions fall to PRODUCT_INFO | Misclassifies stock check as product info |
