-- ============================================================
-- seed_database.sql — Sample data for all e-commerce tables
-- ============================================================
-- Run AFTER import_products.js (which seeds products + variants + product_chunks).
--
-- Usage:
--   psql "$DATABASE_URL" -f backend/scripts/seed_database.sql
--
-- What this seeds:
--   · users         — 1 admin + 3 customers (passwords: "password123")
--   · product_images — placeholder image URLs for each product
--   · addresses     — saved addresses for customers
--   · carts + cart_items — one active cart per customer
--   · orders + order_items + payments — 3 completed orders
--   · reviews       — approved reviews
--   · discount_codes — 3 active promo codes
-- ============================================================

BEGIN;

-- ════════════════════════════════════════
-- USERS  (bcrypt hash of "password123", cost=10)
-- Hash: $2b$10$X9g6YXtJxmGqOh6SIBxlWuVnPyL8KlD5mA3QCVZoeBbJaFXpSgEuS
-- ════════════════════════════════════════

INSERT INTO users (username, email, password, first_name, last_name, phone, role)
VALUES
  ('admin',      'admin@kevinfashion.th',    '$2b$10$X9g6YXtJxmGqOh6SIBxlWuVnPyL8KlD5mA3QCVZoeBbJaFXpSgEuS', 'Admin',  'Kevin',  '+6681000001', 'admin'),
  ('somchai99',  'somchai@example.th',        '$2b$10$X9g6YXtJxmGqOh6SIBxlWuVnPyL8KlD5mA3QCVZoeBbJaFXpSgEuS', 'สมชาย', 'ใจดี',   '+6681000002', 'customer'),
  ('nattamon',   'nattamon@example.th',       '$2b$10$X9g6YXtJxmGqOh6SIBxlWuVnPyL8KlD5mA3QCVZoeBbJaFXpSgEuS', 'ณัฐมน', 'สวยงาม', '+6681000003', 'customer'),
  ('wanchai_bkk','wanchai@example.th',        '$2b$10$X9g6YXtJxmGqOh6SIBxlWuVnPyL8KlD5mA3QCVZoeBbJaFXpSgEuS', 'วันชัย','กรุงเทพ','+6681000004', 'customer')
ON CONFLICT (email) DO NOTHING;

-- ════════════════════════════════════════
-- PRODUCT IMAGES  (placeholder /images/<id>.jpg URLs)
-- ════════════════════════════════════════

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order)
VALUES
  -- SS01 Slim Fit Cotton Shirt
  ('SS01', '/images/SS01-white-front.jpg',   'Slim Fit Shirt White - Front', TRUE,  0),
  ('SS01', '/images/SS01-white-back.jpg',    'Slim Fit Shirt White - Back',  FALSE, 1),
  ('SS01', '/images/SS01-blue-front.jpg',    'Slim Fit Shirt Blue - Front',  FALSE, 2),
  ('SS01', '/images/SS01-black-front.jpg',   'Slim Fit Shirt Black - Front', FALSE, 3),

  -- CS01 Casual Cotton Shirt
  ('CS01', '/images/CS01-white-short.jpg',   'Casual Shirt White Short Sleeve - Front', TRUE,  0),
  ('CS01', '/images/CS01-black-long.jpg',    'Casual Shirt Black Long Sleeve - Front',  FALSE, 1),

  -- TS01 Basic Cotton T-Shirt
  ('TS01', '/images/TS01-black-front.jpg',   'T-Shirt Black - Front',  TRUE,  0),
  ('TS01', '/images/TS01-white-front.jpg',   'T-Shirt White - Front',  FALSE, 1),
  ('TS01', '/images/TS01-gray-front.jpg',    'T-Shirt Gray  - Front',  FALSE, 2),

  -- PT01 Slim Fit Chino Pants
  ('PT01', '/images/PT01-black-front.jpg',   'Chino Pants Black - Front',  TRUE,  0),
  ('PT01', '/images/PT01-khaki-front.jpg',   'Chino Pants Khaki - Front',  FALSE, 1),

  -- JK01 Windbreaker Jacket
  ('JK01', '/images/JK01-black-front.jpg',   'Windbreaker Black - Front',       TRUE,  0),
  ('JK01', '/images/JK01-green-front.jpg',   'Windbreaker Olive Green - Front', FALSE, 1),
  ('JK01', '/images/JK01-navy-front.jpg',    'Windbreaker Navy Blue - Front',   FALSE, 2)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════
-- ADDRESSES
-- ════════════════════════════════════════

INSERT INTO addresses (user_id, label, recipient_name, phone, address_line1, address_line2, city, province, postal_code, is_default)
SELECT
  u.id, 'Home', 'สมชาย ใจดี', '+6681000002',
  '123/4 ซอยลาดพร้าว 5', 'แขวงลาดพร้าว', 'กรุงเทพมหานคร', 'กรุงเทพมหานคร', '10230', TRUE
FROM users u WHERE u.username = 'somchai99'
ON CONFLICT DO NOTHING;

INSERT INTO addresses (user_id, label, recipient_name, phone, address_line1, city, province, postal_code, is_default)
SELECT
  u.id, 'Home', 'ณัฐมน สวยงาม', '+6681000003',
  '56 ถนนนิมมานเหมินท์ ซอย 7', 'เชียงใหม่', 'เชียงใหม่', '50200', TRUE
FROM users u WHERE u.username = 'nattamon'
ON CONFLICT DO NOTHING;

INSERT INTO addresses (user_id, label, recipient_name, phone, address_line1, address_line2, city, province, postal_code, is_default)
SELECT
  u.id, 'Home', 'วันชัย กรุงเทพ', '+6681000004',
  '789 ถนนสุขุมวิท', 'แขวงคลองเตย', 'กรุงเทพมหานคร', 'กรุงเทพมหานคร', '10110', TRUE
FROM users u WHERE u.username = 'wanchai_bkk'
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════
-- CARTS
-- ════════════════════════════════════════

-- Create a cart for nattamon and wanchai_bkk (somchai99 has already checked out)
INSERT INTO carts (user_id)
SELECT id FROM users WHERE username = 'nattamon'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO carts (user_id)
SELECT id FROM users WHERE username = 'wanchai_bkk'
ON CONFLICT (user_id) DO NOTHING;

-- Cart items for nattamon: 1× TS01-BLACK-M + 1× PT01-KHAKI-30
INSERT INTO cart_items (cart_id, variant_id, quantity)
SELECT c.cart_id, 'TS01-BLACK-M', 2
FROM carts c JOIN users u ON c.user_id = u.id
WHERE u.username = 'nattamon'
ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO cart_items (cart_id, variant_id, quantity)
SELECT c.cart_id, 'PT01-KHAKI-30', 1
FROM carts c JOIN users u ON c.user_id = u.id
WHERE u.username = 'nattamon'
ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Cart items for wanchai_bkk: 1× JK01-BLACK-L
INSERT INTO cart_items (cart_id, variant_id, quantity)
SELECT c.cart_id, 'JK01-BLACK-L', 1
FROM carts c JOIN users u ON c.user_id = u.id
WHERE u.username = 'wanchai_bkk'
ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ════════════════════════════════════════
-- ORDERS
-- ════════════════════════════════════════

-- Helper: create a completed order for somchai99
--   Order 1: SS01-BLUE-M (x1) + CS01-BLACK-M-LONG (x2) = 599 + 898 = 1497 + 50 shipping = 1547
DO $$
DECLARE
  v_user_id   INTEGER;
  v_addr_id   INTEGER;
  v_order_id  INTEGER;
  v_snapshot  JSONB;
BEGIN
  SELECT u.id INTO v_user_id FROM users u WHERE u.username = 'somchai99';
  SELECT a.address_id INTO v_addr_id
    FROM addresses a WHERE a.user_id = v_user_id LIMIT 1;

  IF v_user_id IS NULL OR v_addr_id IS NULL THEN
    RAISE NOTICE 'somchai99 or their address not found — skipping order 1';
    RETURN;
  END IF;

  SELECT row_to_json(a)::JSONB INTO v_snapshot
    FROM addresses a WHERE a.address_id = v_addr_id;

  INSERT INTO orders (
    user_id, address_id, shipping_snapshot,
    subtotal, shipping_fee, total_price,
    status, payment_status, tracking_number, ordered_at
  ) VALUES (
    v_user_id, v_addr_id, v_snapshot,
    1497.00, 50.00, 1547.00,
    'delivered', 'paid', 'TH123456789TH',
    NOW() - INTERVAL '10 days'
  ) RETURNING order_id INTO v_order_id;

  INSERT INTO order_items (order_id, variant_id, product_name, variant_desc, quantity, unit_price, subtotal)
  VALUES
    (v_order_id, 'SS01-BLUE-M',     'Slim Fit Cotton Shirt',  'Blue / M / Long sleeve', 1, 599.00,  599.00),
    (v_order_id, 'CS01-BLACK-M-LONG','Casual Cotton Shirt',   'Black / M / Long sleeve', 2, 449.00, 898.00);

  INSERT INTO payments (order_id, method, amount, status, gateway_ref, paid_at)
  VALUES (v_order_id, 'promptpay', 1547.00, 'success', 'QR-20240501-001', NOW() - INTERVAL '10 days' + INTERVAL '5 minutes');
END
$$;

-- Order 2: TS01-WHITE-L (x3) = 750 + 0 shipping (free) = 750
DO $$
DECLARE
  v_user_id   INTEGER;
  v_addr_id   INTEGER;
  v_order_id  INTEGER;
  v_snapshot  JSONB;
BEGIN
  SELECT u.id INTO v_user_id FROM users u WHERE u.username = 'somchai99';
  SELECT a.address_id INTO v_addr_id
    FROM addresses a WHERE a.user_id = v_user_id LIMIT 1;

  IF v_user_id IS NULL OR v_addr_id IS NULL THEN RETURN; END IF;

  SELECT row_to_json(a)::JSONB INTO v_snapshot
    FROM addresses a WHERE a.address_id = v_addr_id;

  INSERT INTO orders (
    user_id, address_id, shipping_snapshot,
    subtotal, shipping_fee, total_price,
    status, payment_status, ordered_at
  ) VALUES (
    v_user_id, v_addr_id, v_snapshot,
    750.00, 0.00, 750.00,
    'shipped', 'paid',
    NOW() - INTERVAL '3 days'
  ) RETURNING order_id INTO v_order_id;

  INSERT INTO order_items (order_id, variant_id, product_name, variant_desc, quantity, unit_price, subtotal)
  VALUES (v_order_id, 'TS01-WHITE-L', 'Basic Cotton T-Shirt', 'White / L', 3, 250.00, 750.00);

  INSERT INTO payments (order_id, method, amount, status, gateway_ref, paid_at)
  VALUES (v_order_id, 'card', 750.00, 'success', 'CARD-20240508-002', NOW() - INTERVAL '3 days' + INTERVAL '2 minutes');
END
$$;

-- Order 3: PT01-BLACK-30 (x1) + JK01-NAVY-L (x1) = 699 + 1299 + 100 shipping = 2098
DO $$
DECLARE
  v_user_id   INTEGER;
  v_addr_id   INTEGER;
  v_order_id  INTEGER;
  v_snapshot  JSONB;
BEGIN
  SELECT u.id INTO v_user_id FROM users u WHERE u.username = 'wanchai_bkk';
  SELECT a.address_id INTO v_addr_id
    FROM addresses a WHERE a.user_id = v_user_id LIMIT 1;

  IF v_user_id IS NULL OR v_addr_id IS NULL THEN RETURN; END IF;

  SELECT row_to_json(a)::JSONB INTO v_snapshot
    FROM addresses a WHERE a.address_id = v_addr_id;

  INSERT INTO orders (
    user_id, address_id, shipping_snapshot,
    subtotal, shipping_fee, total_price,
    status, payment_status, ordered_at
  ) VALUES (
    v_user_id, v_addr_id, v_snapshot,
    1998.00, 100.00, 2098.00,
    'confirmed', 'paid',
    NOW() - INTERVAL '1 day'
  ) RETURNING order_id INTO v_order_id;

  INSERT INTO order_items (order_id, variant_id, product_name, variant_desc, quantity, unit_price, subtotal)
  VALUES
    (v_order_id, 'PT01-BLACK-30', 'Slim Fit Chino Pants',      'Black / 30',    1, 699.00,  699.00),
    (v_order_id, 'JK01-NAVY-L',   'Lightweight Windbreaker Jacket','Navy Blue / L', 1, 1299.00, 1299.00);

  INSERT INTO payments (order_id, method, amount, status, gateway_ref, paid_at)
  VALUES (v_order_id, 'promptpay', 2098.00, 'success', 'QR-20240510-003', NOW() - INTERVAL '1 day' + INTERVAL '3 minutes');
END
$$;

-- ════════════════════════════════════════
-- REVIEWS  (linked to verified orders)
-- ════════════════════════════════════════

-- somchai reviews SS01 (from order 1)
INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_approved)
SELECT
  'SS01',
  u.id,
  o.order_id,
  5,
  'เสื้อสวยมาก คุณภาพดีเกินราคา',
  'ผ้าดี ตัดเย็บเรียบร้อย ใส่แล้วดูเป็นมืออาชีพมาก สีฟ้ายิ่งสวย แนะนำเลย',
  TRUE
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.order_id AND oi.variant_id = 'SS01-BLUE-M'
WHERE u.username = 'somchai99'
LIMIT 1
ON CONFLICT DO NOTHING;

-- somchai reviews TS01 (from order 2)
INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_approved)
SELECT
  'TS01',
  u.id,
  o.order_id,
  4,
  'เสื้อยืดคุณภาพดี ผ้านุ่ม',
  'ผ้าดี นุ่ม ใส่สบาย ทนต่อการซัก ซื้อมาสามตัวแล้ว คุ้มมากครับ',
  TRUE
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.order_id AND oi.variant_id = 'TS01-WHITE-L'
WHERE u.username = 'somchai99'
LIMIT 1
ON CONFLICT DO NOTHING;

-- nattamon reviews CS01 (guest review, no order link)
INSERT INTO reviews (product_id, user_id, rating, title, body, is_approved)
SELECT
  'CS01',
  u.id,
  5,
  'Casual shirt ใส่ได้ทุกโอกาส',
  'ซื้อแบบแขนสั้นมา ผ้าดี ระบายอากาศได้ดีมากสำหรับอากาศเมืองไทย แนะนำสีขาวค่ะ',
  TRUE
FROM users u
WHERE u.username = 'nattamon'
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════
-- STORE POLICIES
-- ════════════════════════════════════════

INSERT INTO store_policies (policy_type, content_en, content_th) VALUES
(
  'SHIPPING',
  E'Shipping:\n- Standard shipping: 2–5 business days, flat rate 50 THB\n- Free shipping on orders over 999 THB\n- Bangkok same-day delivery available for orders placed before 12:00 PM',
  E'การจัดส่ง:\n- จัดส่งมาตรฐาน: 2–5 วันทำการ ค่าจัดส่งคงที่ 50 บาท\n- จัดส่งฟรีสำหรับคำสั่งซื้อที่มีมูลค่าตั้งแต่ 999 บาทขึ้นไป\n- บริการส่งด่วนภายในวันเดียวสำหรับกรุงเทพฯ (สำหรับคำสั่งซื้อก่อน 12:00 น.)'
),
(
  'RETURN',
  E'Returns & Exchanges:\n- Return or exchange within 7 days of receipt\n- Item must be unworn, unwashed, with original tags\n- Contact us via chat to initiate a return',
  E'การคืนและแลกเปลี่ยนสินค้า:\n- สามารถคืนหรือแลกเปลี่ยนสินค้าได้ภายใน 7 วันหลังจากได้รับสินค้า\n- สินค้าต้องอยู่ในสภาพที่ยังไม่ได้สวมใส่ ยังไม่ได้ซัก และมีป้ายครบ\n- ติดต่อเราผ่านแชทเพื่อเริ่มกระบวนการคืนสินค้า'
),
(
  'PAYMENT',
  E'Payment Methods:\n- Credit / debit card (Visa, Mastercard)\n- PromptPay QR code\n- Cash on delivery (COD)',
  E'วิธีการชำระเงิน:\n- บัตรเครดิต / บัตรเดบิต (Visa, Mastercard)\n- พร้อมเพย์ QR code\n- เก็บเงินปลายทาง (COD)'
)
ON CONFLICT (policy_type) DO UPDATE SET
  content_en = EXCLUDED.content_en,
  content_th = EXCLUDED.content_th,
  updated_at = NOW();

-- ════════════════════════════════════════
-- DISCOUNT CODES
-- ════════════════════════════════════════

INSERT INTO discount_codes (code, discount_type, discount_value, min_order, max_uses, starts_at, expires_at, is_active)
VALUES
  -- 10% off on orders ≥ 500 THB  (unlimited, active now)
  ('WELCOME10',  'percent', 10.00,  500.00, NULL,   NOW(),
   NOW() + INTERVAL '1 year',  TRUE),

  -- 100 THB flat off on orders ≥ 1000 THB  (first 50 uses only)
  ('SAVE100',    'fixed',   100.00, 1000.00, 50,    NOW(),
   NOW() + INTERVAL '6 months', TRUE),

  -- 15% summer sale (limited time, 200 uses)
  ('SUMMER15',   'percent', 15.00,  300.00,  200,  NOW(),
   NOW() + INTERVAL '1 month',  TRUE)
ON CONFLICT (code) DO UPDATE SET
  discount_value = EXCLUDED.discount_value,
  is_active      = EXCLUDED.is_active;

COMMIT;

-- ════════════════════════════════════════
-- Quick sanity check
-- ════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM users)           AS users,
  (SELECT COUNT(*) FROM products)        AS products,
  (SELECT COUNT(*) FROM variants)        AS variants,
  (SELECT COUNT(*) FROM product_images)  AS images,
  (SELECT COUNT(*) FROM addresses)       AS addresses,
  (SELECT COUNT(*) FROM orders)          AS orders,
  (SELECT COUNT(*) FROM order_items)     AS order_items,
  (SELECT COUNT(*) FROM payments)        AS payments,
  (SELECT COUNT(*) FROM reviews)         AS reviews,
  (SELECT COUNT(*) FROM discount_codes)  AS discount_codes,
  (SELECT COUNT(*) FROM store_policies)  AS store_policies,
  (SELECT COUNT(*) FROM product_chunks)  AS product_chunks;
