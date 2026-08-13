# Day 1–2 Sanity Check Results

Run: 2026-06-10 19:36  
Intent match: **29/34**

| # | Question | Expected | Actual | Match | Reply Preview | Pass/Fail |
|---|---|---|---|---|---|---|
| 1 | มีเสื้อสีแดงไหม | product_info | stock_check | ✗ | ขออภัยค่ะ ณ วันนี้ทางร้านไม่มีเสื้อเชิ้ตสีแดงให้บริการในหมวดหมู่เสื้อเชิ้ตที่มีอยู่ แต่เราเสนอเสื้อเ | _(fill in)_ |
| 2 | show me jackets under 1000 baht | product_info | product_info | ✓ | I understand you're looking for a jacket within your budget. The only windbreaker jacket available i | _(fill in)_ |
| 3 | แนะนำเสื้อยืดสวยๆ หน่อย | product_info | product_info | ✓ | เราขอแนะนำ **Basic Cotton T-Shirt** (เสื้อยืดผ้าฝ้ายพื้นฐาน) สำหรับคุณ มีราคา **250 บาท** และมีหลายส | _(fill in)_ |
| 4 | what shirts do you have | product_info | product_info | ✓ | Sure, we've got a few great shirt options for you! Here are the details:  - **Slim Fit Cotton Shirt* | _(fill in)_ |
| 5 | เสื้อตัวไหนถูกกว่า | product_info | product_info | ✓ | คุณสามารถเลือกเสื้อยืดผ้าฝ้ายพื้นฐานได้เลยครับ มีราคาเพียง 250 บาทเท่านั้น และยังมีหลากหลาย sizing L | _(fill in)_ |
| 6 | compare the two jackets | product_info | product_info | ✓ | Sure! Let's compare the Lightweight Windbreaker Jacket. Both jackets share some common features but  | _(fill in)_ |
| 7 | อยากได้กางเกงสีดำ ราคาไม่เกิน 500 | product_info | product_info | ✓ | ขออภัยค่ะ ตามข้อมูลที่มีไม่มีกางเกงชิโนทรงสลิมในสีดำที่ตรงตามราคาระดับนี้นะคะ แต่เรามีตัวเลือกอื่นๆ  | _(fill in)_ |
| 8 | do you sell hoodies | product_info | product_info | ✓ | I'm sorry, we don't have any hoodies in our collection. However, we do offer some great options for  | _(fill in)_ |
| 9 | เสื้อไซส์ M เหมาะกับใคร | size_guide | size_guide | ✓ | เสื้อไซส์ M ออกแบบมาเพื่อผู้ที่มีขนาดอกประมาณ 93-98 ซม. ตามแนะนำของตารางความถูกต้อง โดยทั่วไปแล้วไซส | _(fill in)_ |
| 10 | what size fits 80cm chest | size_guide | size_guide | ✓ | Based on the size measurement guide, a chest circumference of 80 cm would best fit an **S** size in  | _(fill in)_ |
| 11 | ฉันรอบอก 90 ซม. ควรใส่ไซส์อะไร | size_guide | size_guide | ✓ | ตามขนาดที่ให้มาของคุณ รอบอก 90 ซม. แนะนำให้ลองサイズ为：90 厘米，建议您试穿以下尺寸：  - **M** เนื่องจากขนาด M มีรอบอก | _(fill in)_ |
| 12 | ไซส์ไหนเหมาะกับผู้หญิงตัวเล็ก | size_guide | size_guide | ✓ | สำหรับผู้หญิงที่มีขนาดตัวเล็ก เรามีเสื้อเชิ้ตทรงสลิม (Slim Fit Cotton Shirt) มีไซส์ S ที่เหมาะสม ซึ่ | _(fill in)_ |
| 13 | which size should I pick for 170cm height | size_guide | size_guide | ✓ | To help you choose the right size, let's consider your height and the typical fit of our shirts:  -  | _(fill in)_ |
| 14 | เสื้อตัวนี้มีสต็อกไหม | stock_check | stock_check | ✓ | มีเสื้อเชิ้ตหลายแบบให้เลือก ตามที่คุณสอบถามมา ดังนี้:  - **เสื้อเชิ้ตผ้าฝ้ายทรงสลิม ( Slim Fit Cotto | _(fill in)_ |
| 15 | is the black jacket size L available | stock_check | stock_check | ✓ | Yes, the **black jacket size L** is currently available. There are 12 pieces left in stock.  If you  | _(fill in)_ |
| 16 | มีเสื้อยืดสีขาวไซส์ XL ไหม | stock_check | stock_check | ✓ | มีเสื้อยืดผ้าฝ้ายพื้นฐาน (Basic Cotton T-Shirt) สีขาวไซส์ XL ในร้านค่ะ ยังมีในคลัง **35** ชิ้นค่ะ. | _(fill in)_ |
| 17 | do you have blue pants in stock | stock_check | stock_check | ✓ | I'm sorry, but we don't have any blue chino pants in stock. The closest options available are in the | _(fill in)_ |
| 18 | เหลือกางเกงสีกรมไหม | stock_check | stock_check | ✓ | กางเกงชิโนทรงสลิมมีเหลืออยู่ในขนาดและสีที่คุณสอบถามมาแล้วครับ  - ขนาด 28: 18 ตัวเหลือ (สีกรมท่า) - ข | _(fill in)_ |
| 19 | ส่งฟรีไหม | store_policy | store_policy | ✓ | ตามนโยบายการจัดส่งของร้านค่ะ สำหรับรายการสินค้าที่มียอดเงินเกิน 1,299 บาท จะได้รับบริการจัดส่งฟรีค่ะ | _(fill in)_ |
| 20 | how long does delivery take | store_policy | store_policy | ✓ | Delivery times can vary depending on your location. Here are the details:  - **Standard shipping** u | _(fill in)_ |
| 21 | can I return items if they don't fit | store_policy | store_policy | ✓ | Certainly! You can return items that don't fit within 7 days of receipt. To ensure a smooth process, | _(fill in)_ |
| 22 | คืนสินค้าได้ไหม | store_policy | store_policy | ✓ | ตามนโยบายการคืนสินค้าของทางร้านค่ะ  - สามารถคืนสินค้าภายใน **7 วัน** นับตั้งแต่วันที่ทำการซื้อ - โปร | _(fill in)_ |
| 23 | มีโค้ดส่วนลดไหม | store_policy | store_policy | ✓ | ใช่ค่ะ มีโค้ดส่วนลดให้เลือกใช้ คุณสามารถใช้ได้ตามเงื่อนไขดังนี้:  - **SAVE100**: ลด 100 บาท (สั่งซื้ | _(fill in)_ |
| 24 | any promo codes available | store_policy | store_policy | ✓ | Yes, we currently have a few promo codes available. Here are the details:  - **SAVE100**: Get 100 TH | _(fill in)_ |
| 25 | รับชำระด้วย promptpay ไหม | store_policy | store_policy | ✓ | ใช่ค่ะ เราสามารถชำระด้วย PromptPay ได้ค่ะ มีวิธีการชำระเงินอื่น ๆ อีกหลายแบบให้เลือกด้วย เช่น Visa,  | _(fill in)_ |
| 26 | what payment methods do you accept | store_policy | store_policy | ✓ | We accept several convenient payment methods! Here’s a quick rundown:  - **Credit / Debit Card:** Vi | _(fill in)_ |
| 27 | ขายโทรศัพท์ไหม | out_of_scope | product_info | ✗ | ขอโทษค่ะ ทางร้านเราไม่มีจำหน่ายโทรศัพท์นะคะ แต่เรามีเสื้อยืดผ้าฝ้ายพื้นฐานสำหรับคุณ ซึ่งมีให้เลือกหล | _(fill in)_ |
| 28 | what's the weather today | out_of_scope | product_info | ✗ | I understand you're curious about the weather, but I want to help you find some great clothing optio | _(fill in)_ |
| 29 | ราคาหุ้น SCB วันนี้เท่าไร | out_of_scope | product_info | ✗ | ขอโทษค่ะ ในข้อมูลที่ให้มาไม่มีการระบุราคาวัสดุสินค้า SCB หรือหุ้น SCB กรุณาสอบถามข้อมูล最新的回应需要切换回泰语， | _(fill in)_ |
| 30 | recommend me a good restaurant | out_of_scope | product_info | ✗ | I'm sorry, but I can only assist with recommendations for our clothing store products. We don't have | _(fill in)_ |
| 31 | สวัสดี | smalltalk | out_of_scope | ✓ | Hi! I can help you find and compare our shirts and pants. What are you looking for today? | _(fill in)_ |
| 32 | hello | smalltalk | out_of_scope | ✓ | Hi! I can help you find and compare our shirts and pants. What are you looking for today? | _(fill in)_ |
| 33 | ขอบคุณมาก | smalltalk | out_of_scope | ✓ | Hi! I can help you find and compare our shirts and pants. What are you looking for today? | _(fill in)_ |
| 34 | thank you | smalltalk | out_of_scope | ✓ | Hi! I can help you find and compare our shirts and pants. What are you looking for today? | _(fill in)_ |

---

**Pass/Fail criteria**  
- Pass: intent correct AND reply is sensible (real products / correct policy)  
- Fail: intent wrong, reply empty, reply invents data, or crashes  
- Smalltalk: Pass if reply is a greeting/acknowledgement, not product mode  
