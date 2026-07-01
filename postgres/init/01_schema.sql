  -- ============================================================
  -- Fashion E-Commerce Database Schema
  -- PostgreSQL 15 + pgvector
  -- Auto-runs via /docker-entrypoint-initdb.d on fresh volume.
  -- ============================================================

  CREATE EXTENSION IF NOT EXISTS vector;

  -- ────────────────────────────────────────
  -- Shared trigger function: keep updated_at current
  -- ────────────────────────────────────────
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- ════════════════════════════════════════
  -- CORE CATALOGUE
  -- ════════════════════════════════════════

  -- products — top-level product catalogue
  CREATE TABLE IF NOT EXISTS products (
    product_id      VARCHAR(20)  PRIMARY KEY,
    product_name    VARCHAR(150) NOT NULL,
    product_name_th VARCHAR(150) DEFAULT NULL,
    category        VARCHAR(50)  NOT NULL,
    category_th     VARCHAR(50)  DEFAULT NULL,
    sub_category    VARCHAR(50)  DEFAULT NULL,
    sub_category_th VARCHAR(50)  DEFAULT NULL,
    description     TEXT         DEFAULT NULL,
    description_th  TEXT         DEFAULT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
  CREATE INDEX IF NOT EXISTS products_name_idx     ON products (product_name);
  CREATE INDEX IF NOT EXISTS products_active_idx   ON products (is_active);

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at'
    ) THEN
      CREATE TRIGGER trg_products_updated_at
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$;

  -- variants — SKU / size / colour / stock / price
  CREATE TABLE IF NOT EXISTS variants (
    variant_id VARCHAR(30)   PRIMARY KEY,
    product_id VARCHAR(20)   NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    size       VARCHAR(10)   NOT NULL,
    color      VARCHAR(50)   NOT NULL,
    color_th   VARCHAR(50)   DEFAULT NULL,
    pattern    VARCHAR(50)   DEFAULT NULL,
    pattern_th VARCHAR(50)   DEFAULT NULL,
    chest_min  NUMERIC(5,1)  DEFAULT NULL,
    chest_max  NUMERIC(5,1)  DEFAULT NULL,
    waist_min  NUMERIC(5,1)  DEFAULT NULL,
    waist_max  NUMERIC(5,1)  DEFAULT NULL,
    sleeve     VARCHAR(20)   DEFAULT NULL,  -- 'short' | 'long'
    sleeve_th  VARCHAR(20)   DEFAULT NULL,
    collar     VARCHAR(30)   DEFAULT NULL,  -- 'band' | 'spread' | 'button-down' …
    collar_th  VARCHAR(30)   DEFAULT NULL,
    price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    cost_price NUMERIC(10,2) DEFAULT NULL,
    stock      INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE
  );

  CREATE INDEX IF NOT EXISTS variants_product_id_idx ON variants (product_id);
  CREATE INDEX IF NOT EXISTS variants_active_idx     ON variants (is_active);

  -- product_images — gallery / thumbnails
  -- color: matches variants.color; NULL = applies to all colors / generic photo
  -- is_primary: strictly one per product (enforced by partial unique index below)
  CREATE TABLE IF NOT EXISTS product_images (
    image_id   SERIAL       PRIMARY KEY,
    product_id VARCHAR(20)  NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    variant_id VARCHAR(30)  DEFAULT NULL   REFERENCES variants(variant_id) ON DELETE SET NULL,
    image_url  VARCHAR(500) NOT NULL,
    alt_text   VARCHAR(200) DEFAULT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order SMALLINT     NOT NULL DEFAULT 0,
    color      TEXT         DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id);
  CREATE INDEX IF NOT EXISTS product_images_primary_idx ON product_images (product_id, is_primary);
  CREATE INDEX IF NOT EXISTS product_images_color_idx   ON product_images (product_id, color);
  CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_idx
    ON product_images (product_id) WHERE is_primary = TRUE;

  -- ════════════════════════════════════════
  -- USERS & ADDRESSES
  -- ════════════════════════════════════════

  -- users — customer & admin accounts
  -- Column names kept backward-compatible with the existing Express auth backend:
  --   · 'id'       (not user_id)    — JWT payload uses id
  --   · 'password' (not password_hash) — stores bcrypt hash; never plain text
  --   · 'address'  (legacy single-line) — kept; structured addresses are in addresses table
  CREATE TABLE IF NOT EXISTS users (
    id          SERIAL       PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(254) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(80)  NOT NULL DEFAULT '',
    last_name   VARCHAR(80)  NOT NULL DEFAULT '',
    phone       VARCHAR(20)  DEFAULT NULL,
    address     TEXT         DEFAULT NULL,   -- legacy; use addresses table for new features
    role        VARCHAR(20)  NOT NULL DEFAULT 'customer',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login  TIMESTAMPTZ  DEFAULT NULL,
    CONSTRAINT chk_users_role CHECK (role IN ('customer','admin','staff'))
  );

  CREATE INDEX IF NOT EXISTS users_email_idx    ON users (email);
  CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);

  -- addresses — saved shipping/billing addresses (multi-address per user)
  CREATE TABLE IF NOT EXISTS addresses (
    address_id     SERIAL       PRIMARY KEY,
    user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label          VARCHAR(50)  DEFAULT NULL,        -- e.g. 'Home', 'Office'
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

  -- ════════════════════════════════════════
  -- CART
  -- ════════════════════════════════════════

  -- carts — one active cart per user (1-to-1)
  CREATE TABLE IF NOT EXISTS carts (
    cart_id    SERIAL      PRIMARY KEY,
    user_id    INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at'
    ) THEN
      CREATE TRIGGER trg_carts_updated_at
        BEFORE UPDATE ON carts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$;

  -- cart_items — line items inside a cart
  CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id SERIAL      PRIMARY KEY,
    cart_id      INTEGER     NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
    variant_id   VARCHAR(30) NOT NULL REFERENCES variants(variant_id) ON DELETE CASCADE,
    quantity     SMALLINT    NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, variant_id)   -- update qty instead of inserting duplicate
  );

  CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items (cart_id);

  -- ════════════════════════════════════════
  -- ORDERS & PAYMENTS
  -- ════════════════════════════════════════

  -- orders — order header
  CREATE TABLE IF NOT EXISTS orders (
    order_id          SERIAL        PRIMARY KEY,
    user_id           INTEGER       NOT NULL REFERENCES users(id),
    address_id        INTEGER       NOT NULL REFERENCES addresses(address_id),
    shipping_snapshot JSONB         NOT NULL DEFAULT '{}',  -- frozen address copy at order time
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

  CREATE INDEX IF NOT EXISTS orders_user_id_idx         ON orders (user_id);
  CREATE INDEX IF NOT EXISTS orders_status_idx          ON orders (status);
  CREATE INDEX IF NOT EXISTS orders_payment_status_idx  ON orders (payment_status);
  CREATE INDEX IF NOT EXISTS orders_ordered_at_idx      ON orders (ordered_at DESC);

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at'
    ) THEN
      CREATE TRIGGER trg_orders_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$;

  -- order_items — line items per order (snapshot prices at purchase time)
  CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL        PRIMARY KEY,
    order_id      INTEGER       NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    variant_id    VARCHAR(30)   NOT NULL REFERENCES variants(variant_id),
    product_name  VARCHAR(150)  NOT NULL,   -- snapshot of name at purchase time
    variant_desc  VARCHAR(100)  NOT NULL,   -- e.g. "White / M / Long sleeve"
    quantity      SMALLINT      NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal      NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)   -- quantity × unit_price
  );

  CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

  -- payments — payment records (multiple attempts per order allowed)
  CREATE TABLE IF NOT EXISTS payments (
    payment_id  SERIAL        PRIMARY KEY,
    order_id    INTEGER       NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    method      VARCHAR(20)   NOT NULL,
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency    CHAR(3)       NOT NULL DEFAULT 'THB',
    status      VARCHAR(20)   NOT NULL DEFAULT 'pending',
    gateway_ref VARCHAR(200)  DEFAULT NULL,   -- transaction ID from payment gateway
    paid_at     TIMESTAMPTZ   DEFAULT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payments_method CHECK (method IN ('card','promptpay','bank','cod','wallet')),
    CONSTRAINT chk_payments_status CHECK (status IN ('pending','success','failed','refunded'))
  );

  CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);

  -- ════════════════════════════════════════
  -- REVIEWS & PROMOTIONS
  -- ════════════════════════════════════════

  -- reviews — product reviews (verified purchase optional)
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

  -- discount_codes — coupons / promotions
  CREATE TABLE IF NOT EXISTS discount_codes (
    code_id        SERIAL        PRIMARY KEY,
    code           VARCHAR(50)   UNIQUE NOT NULL,
    discount_type  VARCHAR(10)   NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    max_uses       INTEGER       DEFAULT NULL,   -- NULL = unlimited
    used_count     INTEGER       NOT NULL DEFAULT 0,
    starts_at      TIMESTAMPTZ   DEFAULT NULL,
    expires_at     TIMESTAMPTZ   DEFAULT NULL,   -- NULL = no expiry
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE
  );

  -- ════════════════════════════════════════
  -- VECTOR / AI TABLES
  -- ════════════════════════════════════════

  -- product_chunks — text chunks for RAG (chatbot)
  -- Embedding model: bge-m3  →  vector(1024)
  -- Populated by: node backend/scripts/import_products.js
  --               node backend/scripts/backfill_chunk_embeddings.js
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
  -- IVFFlat index for cosine similarity search (enable after data is loaded):
  -- CREATE INDEX product_chunks_embedding_idx
  --   ON product_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

  -- store_policies — shipping, return, and payment policies in Thai and English
  CREATE TABLE IF NOT EXISTS store_policies (
    policy_id   SERIAL       PRIMARY KEY,
    policy_type VARCHAR(50)  NOT NULL UNIQUE,  -- 'SHIPPING' | 'RETURN' | 'PAYMENT'
    content_en  TEXT         NOT NULL,
    content_th  TEXT         NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- product_image_embeddings — CLIP visual embeddings for image search
  -- Embedding model: CLIP  →  vector(512)
  -- Populated by: FastAPI image-search ingest endpoint (to be implemented)
  -- Query operator: embedding <=> $query_vec   (cosine distance, lower = more similar)
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
  -- IVFFlat index for CLIP search (enable after data is loaded):
  -- CREATE INDEX product_image_embeddings_embedding_idx
  --   ON product_image_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
