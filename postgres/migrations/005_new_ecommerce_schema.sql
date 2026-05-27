-- ============================================================
-- Migration 005: Full e-commerce schema upgrade
-- PostgreSQL 15 + pgvector
-- Idempotent — safe to run multiple times.
--
-- What this does:
--   1. Detects old schema (products.name column) and backs up data.
--   2. Renames old tables to _legacy_* so data is never lost.
--   3. Creates all new tables (same DDL as 01_schema.sql).
--   4. Migrates old product rows → new products + variants + product_chunks.
--   5. Adds new columns to existing users table (no data lost).
--
-- Apply manually:
--   psql "$DATABASE_URL" -f postgres/migrations/005_new_ecommerce_schema.sql
-- ============================================================

BEGIN;

-- ────────────────────────────────────────
-- pgvector extension (idempotent)
-- ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────
-- updated_at trigger function
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════
-- STEP 1 — Back up old tables if they exist in old schema
-- Detect old schema by presence of products.name (old column)
-- ════════════════════════════════════════

DO $migrate$
BEGIN
  -- Back up old product_chunks (references old products.id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_chunks' AND column_name = 'product_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'name'
  ) THEN
    -- Old schema detected
    RAISE NOTICE 'Old schema detected — backing up product_chunks to _legacy_product_chunks';
    ALTER TABLE product_chunks RENAME TO _legacy_product_chunks;
  END IF;

  -- Back up old products table (old schema has column "name", new has "product_name")
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'name'
  ) THEN
    RAISE NOTICE 'Renaming old products table to _legacy_products';
    ALTER TABLE products RENAME TO _legacy_products;
  END IF;
END
$migrate$;

-- ════════════════════════════════════════
-- STEP 2 — Create new tables (all idempotent)
-- ════════════════════════════════════════

-- products
CREATE TABLE IF NOT EXISTS products (
  product_id   VARCHAR(20)  PRIMARY KEY,
  product_name VARCHAR(150) NOT NULL,
  category     VARCHAR(50)  NOT NULL,
  sub_category VARCHAR(50)  DEFAULT NULL,
  description  TEXT         DEFAULT NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_name_idx     ON products (product_name);
CREATE INDEX IF NOT EXISTS products_active_idx   ON products (is_active);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at') THEN
    CREATE TRIGGER trg_products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- variants
CREATE TABLE IF NOT EXISTS variants (
  variant_id VARCHAR(30)   PRIMARY KEY,
  product_id VARCHAR(20)   NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  size       VARCHAR(10)   NOT NULL,
  color      VARCHAR(50)   NOT NULL,
  pattern    VARCHAR(50)   DEFAULT NULL,
  chest_min  NUMERIC(5,1)  DEFAULT NULL,
  chest_max  NUMERIC(5,1)  DEFAULT NULL,
  waist_min  NUMERIC(5,1)  DEFAULT NULL,
  waist_max  NUMERIC(5,1)  DEFAULT NULL,
  sleeve     VARCHAR(20)   DEFAULT NULL,
  collar     VARCHAR(30)   DEFAULT NULL,
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(10,2) DEFAULT NULL,
  stock      INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active  BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS variants_product_id_idx ON variants (product_id);
CREATE INDEX IF NOT EXISTS variants_active_idx     ON variants (is_active);

-- product_images
CREATE TABLE IF NOT EXISTS product_images (
  image_id   SERIAL       PRIMARY KEY,
  product_id VARCHAR(20)  NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  variant_id VARCHAR(30)  DEFAULT NULL REFERENCES variants(variant_id) ON DELETE SET NULL,
  image_url  VARCHAR(500) NOT NULL,
  alt_text   VARCHAR(200) DEFAULT NULL,
  is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order SMALLINT     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id);
CREATE INDEX IF NOT EXISTS product_images_primary_idx ON product_images (product_id, is_primary);

-- users — add new columns to existing table (backward compat: id, password, address kept)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login  TIMESTAMPTZ DEFAULT NULL;

-- Ensure role constraint exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'chk_users_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_role
      CHECK (role IN ('customer','admin','staff'));
  END IF;
END $$;

-- addresses
CREATE TABLE IF NOT EXISTS addresses (
  address_id     SERIAL       PRIMARY KEY,
  user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label          VARCHAR(50)  DEFAULT NULL,
  recipient_name VARCHAR(160) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  address_line1  VARCHAR(200) NOT NULL,
  address_line2  VARCHAR(200) DEFAULT NULL,
  city           VARCHAR(80)  NOT NULL,
  province       VARCHAR(80)  NOT NULL,
  postal_code    VARCHAR(10)  NOT NULL,
  country        CHAR(2)      NOT NULL DEFAULT 'TH',
  is_default     BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);

-- carts
CREATE TABLE IF NOT EXISTS carts (
  cart_id    SERIAL      PRIMARY KEY,
  user_id    INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at') THEN
    CREATE TRIGGER trg_carts_updated_at
      BEFORE UPDATE ON carts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id SERIAL      PRIMARY KEY,
  cart_id      INTEGER     NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  variant_id   VARCHAR(30) NOT NULL REFERENCES variants(variant_id) ON DELETE CASCADE,
  quantity     SMALLINT    NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, variant_id)
);
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items (cart_id);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  order_id          SERIAL        PRIMARY KEY,
  user_id           INTEGER       NOT NULL REFERENCES users(id),
  address_id        INTEGER       NOT NULL REFERENCES addresses(address_id),
  shipping_snapshot JSONB         NOT NULL DEFAULT '{}',
  subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee      NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (shipping_fee >= 0),
  total_price       NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
  payment_status    VARCHAR(20)   NOT NULL DEFAULT 'unpaid',
  tracking_number   VARCHAR(100)  DEFAULT NULL,
  notes             TEXT          DEFAULT NULL,
  ordered_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_orders_status         CHECK (status         IN ('pending','confirmed','shipped','delivered','cancelled','refunded')),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('unpaid','paid','refunded'))
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx        ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders (status);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_ordered_at_idx     ON orders (ordered_at DESC);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at') THEN
    CREATE TRIGGER trg_orders_updated_at
      BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL        PRIMARY KEY,
  order_id      INTEGER       NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  variant_id    VARCHAR(30)   NOT NULL REFERENCES variants(variant_id),
  product_name  VARCHAR(150)  NOT NULL,
  variant_desc  VARCHAR(100)  NOT NULL,
  quantity      SMALLINT      NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal      NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  payment_id  SERIAL        PRIMARY KEY,
  order_id    INTEGER       NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  method      VARCHAR(20)   NOT NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3)       NOT NULL DEFAULT 'THB',
  status      VARCHAR(20)   NOT NULL DEFAULT 'pending',
  gateway_ref VARCHAR(200)  DEFAULT NULL,
  paid_at     TIMESTAMPTZ   DEFAULT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payments_method CHECK (method IN ('card','promptpay','bank','cod','wallet')),
  CONSTRAINT chk_payments_status CHECK (status IN ('pending','success','failed','refunded'))
);
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);

-- reviews
CREATE TABLE IF NOT EXISTS reviews (
  review_id   SERIAL       PRIMARY KEY,
  product_id  VARCHAR(20)  NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  user_id     INTEGER      NOT NULL REFERENCES users(id),
  order_id    INTEGER      DEFAULT NULL REFERENCES orders(order_id) ON DELETE SET NULL,
  rating      SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(200) DEFAULT NULL,
  body        TEXT         DEFAULT NULL,
  is_approved BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id, order_id)
);
CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON reviews (product_id);
CREATE INDEX IF NOT EXISTS reviews_approved_idx   ON reviews (is_approved);

-- discount_codes
CREATE TABLE IF NOT EXISTS discount_codes (
  code_id        SERIAL        PRIMARY KEY,
  code           VARCHAR(50)   UNIQUE NOT NULL,
  discount_type  VARCHAR(10)   NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  max_uses       INTEGER       DEFAULT NULL,
  used_count     INTEGER       NOT NULL DEFAULT 0,
  starts_at      TIMESTAMPTZ   DEFAULT NULL,
  expires_at     TIMESTAMPTZ   DEFAULT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE
);

-- product_chunks (RAG — bge-m3, vector 1024)
CREATE TABLE IF NOT EXISTS product_chunks (
  id           BIGSERIAL   PRIMARY KEY,
  product_id   VARCHAR(20) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  chunk_index  INTEGER     NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
  content      TEXT        NOT NULL,
  content_hash TEXT        NOT NULL DEFAULT '',
  embed_model  TEXT        NOT NULL DEFAULT '',
  embedded_at  TIMESTAMPTZ DEFAULT NULL,
  embedding    vector(1024),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS product_chunks_product_id_idx ON product_chunks (product_id);

-- product_image_embeddings (CLIP visual search — vector 512)
CREATE TABLE IF NOT EXISTS product_image_embeddings (
  id          BIGSERIAL   PRIMARY KEY,
  image_id    INTEGER     NOT NULL UNIQUE REFERENCES product_images(image_id) ON DELETE CASCADE,
  product_id  VARCHAR(20) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  embed_model TEXT        NOT NULL DEFAULT 'clip',
  embedded_at TIMESTAMPTZ DEFAULT NULL,
  embedding   vector(512),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_image_embeddings_product_id_idx ON product_image_embeddings (product_id);

-- ════════════════════════════════════════
-- STEP 3 — Migrate legacy product data
-- ════════════════════════════════════════

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = '_legacy_products'
  ) THEN
    RAISE NOTICE 'Migrating _legacy_products → products + variants + product_chunks';

    -- Migrate product rows
    INSERT INTO products (product_id, product_name, category, description, created_at, updated_at)
    SELECT
      id                          AS product_id,
      COALESCE(name, '')          AS product_name,
      COALESCE(category, 'other') AS category,
      description,
      created_at,
      updated_at
    FROM _legacy_products
    ON CONFLICT (product_id) DO NOTHING;

    -- Create one default variant per migrated product (uses old price)
    INSERT INTO variants (variant_id, product_id, size, color, price, stock)
    SELECT
      lp.id || '-DEFAULT'            AS variant_id,
      lp.id                          AS product_id,
      COALESCE((lp.sizes)[1], 'M')   AS size,
      COALESCE((lp.colors)[1], 'Default') AS color,
      COALESCE(lp.price, 0)          AS price,
      0                              AS stock
    FROM _legacy_products lp
    WHERE NOT EXISTS (
      SELECT 1 FROM variants v WHERE v.product_id = lp.id
    );

    -- Migrate product_chunks content (but not embeddings — those must be rebuilt)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = '_legacy_product_chunks'
    ) THEN
      INSERT INTO product_chunks (product_id, chunk_index, content, content_hash, embed_model, created_at)
      SELECT
        lc.product_id,
        lc.chunk_index,
        lc.content,
        lc.content_hash,
        lc.embed_model,
        lc.created_at
      FROM _legacy_product_chunks lc
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.product_id = lc.product_id)
      ON CONFLICT (product_id, chunk_index) DO NOTHING;

      RAISE NOTICE 'Migrated product_chunks content (embeddings must be regenerated — run backfill_chunk_embeddings.js)';
    END IF;

    RAISE NOTICE 'Migration complete. Old tables kept as _legacy_products / _legacy_product_chunks for safety.';
    RAISE NOTICE 'Run: node backend/scripts/import_products.js   to re-seed from products.json';
    RAISE NOTICE 'Run: node backend/scripts/backfill_chunk_embeddings.js   to rebuild embeddings';
  ELSE
    RAISE NOTICE 'No legacy products table found — nothing to migrate.';
  END IF;
END
$migrate$;

COMMIT;
