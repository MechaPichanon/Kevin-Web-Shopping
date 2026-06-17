-- 006_add_thai_fields.sql
-- Adds Thai language fields to products and variants, and creates the store_policies table.
-- All statements are idempotent.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_name_th VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description_th  TEXT;

ALTER TABLE variants
  ADD COLUMN IF NOT EXISTS color_th VARCHAR(50);

CREATE TABLE IF NOT EXISTS store_policies (
  policy_id   SERIAL       PRIMARY KEY,
  policy_type VARCHAR(50)  NOT NULL UNIQUE,  -- 'SHIPPING' | 'RETURN' | 'PAYMENT'
  content_en  TEXT         NOT NULL,
  content_th  TEXT         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
