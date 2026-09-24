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
    size       VARCHAR(100)  NOT NULL,  -- widened for "set" rows, which store a synthesized combo label
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

  -- set_components — maps a "set" product's variant (products.category='set')
  -- to the real, standalone-sellable variants it bundles. A set's stock is
  -- never tracked independently; it's derived from its components via the
  -- triggers below, so one physical item is counted once whether it sells
  -- standalone or inside a set.
  CREATE TABLE IF NOT EXISTS set_components (
    set_variant_id       VARCHAR(30) NOT NULL REFERENCES variants(variant_id) ON DELETE CASCADE,
    component_variant_id VARCHAR(30) NOT NULL REFERENCES variants(variant_id) ON DELETE RESTRICT,
    quantity              INTEGER    NOT NULL DEFAULT 1 CHECK (quantity > 0),
    PRIMARY KEY (set_variant_id, component_variant_id)
  );

  CREATE INDEX IF NOT EXISTS set_components_component_idx
    ON set_components (component_variant_id);

  -- Recompute one set-variant's stock as the floor of the scarcest component.
  CREATE OR REPLACE FUNCTION recompute_set_variant_stock(p_set_variant_id VARCHAR)
  RETURNS void AS $$
    UPDATE variants v
    SET stock = COALESCE((
      SELECT MIN(c.stock / sc.quantity)
      FROM set_components sc
      JOIN variants c ON c.variant_id = sc.component_variant_id
      WHERE sc.set_variant_id = p_set_variant_id
    ), 0)
    WHERE v.variant_id = p_set_variant_id;
  $$ LANGUAGE sql;

  -- Whenever a component's real stock changes, recompute every set built on it.
  CREATE OR REPLACE FUNCTION trg_recompute_dependent_set_stock() RETURNS trigger AS $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN SELECT DISTINCT set_variant_id FROM set_components
             WHERE component_variant_id = NEW.variant_id LOOP
      PERFORM recompute_set_variant_stock(r.set_variant_id);
    END LOOP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_variants_stock_cascade ON variants;
  CREATE TRIGGER trg_variants_stock_cascade
  AFTER UPDATE OF stock ON variants
  FOR EACH ROW WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION trg_recompute_dependent_set_stock();

  -- Whenever a set's component list changes (new set option created), give
  -- the new set-variant its initial derived stock immediately.
  CREATE OR REPLACE FUNCTION trg_init_set_variant_stock() RETURNS trigger AS $$
  BEGIN
    PERFORM recompute_set_variant_stock(NEW.set_variant_id);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_set_components_init_stock ON set_components;
  CREATE TRIGGER trg_set_components_init_stock
  AFTER INSERT ON set_components
  FOR EACH ROW
  EXECUTE FUNCTION trg_init_set_variant_stock();

  -- ════════════════════════════════════════
  -- USERS & ADDRESSES
  -- ════════════════════════════════════════

  -- users — customer & admin accounts
  -- Column names kept backward-compatible with the existing Express auth backend:
  --   · 'id'       (not user_id)    — JWT payload uses id
  --   · 'password' (not password_hash) — stores bcrypt hash; never plain text
  CREATE TABLE IF NOT EXISTS users (
    id          SERIAL       PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(254) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(80)  NOT NULL DEFAULT '',
    last_name   VARCHAR(80)  NOT NULL DEFAULT '',
    phone       VARCHAR(20)  DEFAULT NULL,
    address     TEXT         NOT NULL DEFAULT '', -- legacy flat-text mirror of the default addresses row, auto-synced by PUT /profile — see CLAUDE.md "Address sync"
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
    recipient_name VARCHAR(160) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    address_line1  VARCHAR(200) NOT NULL,
    address_line2  VARCHAR(200) DEFAULT NULL,
    province       VARCHAR(80)  NOT NULL,
    postal_code    VARCHAR(10)  NOT NULL,
    country        CHAR(2)      NOT NULL DEFAULT 'TH'
  );

  CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);

  -- user_addresses — many-to-many sharing: lets more than one account use the
  -- same saved address (e.g. family members at one house). addresses.user_id
  -- stays as the original creator (informational); this table is the real
  -- access/sharing source of truth.
  CREATE TABLE IF NOT EXISTS user_addresses (
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_id INTEGER     NOT NULL REFERENCES addresses(address_id) ON DELETE CASCADE,
    is_default BOOLEAN     NOT NULL DEFAULT FALSE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, address_id)
  );

  CREATE INDEX IF NOT EXISTS user_addresses_address_id_idx ON user_addresses (address_id);

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
    payment_slip_url  TEXT          DEFAULT NULL,  -- customer-uploaded transfer slip image
    tracking_number   VARCHAR(100)  DEFAULT NULL,
    courier_name      VARCHAR(100)  DEFAULT NULL,
    shipped_at        TIMESTAMPTZ   DEFAULT NULL,  -- stamped once, first time status becomes 'shipped' (drives the auto-confirm sweep)
    notes             TEXT          DEFAULT NULL,
    discount_code     TEXT          DEFAULT NULL,
    discount_amount   NUMERIC       NOT NULL DEFAULT 0,
    ordered_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_orders_status         CHECK (status         IN ('pending','confirmed','shipped','cancelled')),
    CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('unpaid','pending_verification','paid','rejected'))
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
    CONSTRAINT chk_payments_status CHECK (status IN ('pending','success','failed'))
  );

  CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);

  -- payment_slips — history of customer-uploaded transfer slips (one row per
  -- upload, never deleted). Each row carries its own admin verdict + reason.
  -- orders.payment_slip_url mirrors the newest slip_url here for the order views.
  CREATE TABLE IF NOT EXISTS payment_slips (
    slip_id       SERIAL       PRIMARY KEY,
    order_id      INTEGER      NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    slip_url      TEXT         NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending_verification',
    reject_reason TEXT         DEFAULT NULL,
    reviewed_by   INTEGER      DEFAULT NULL REFERENCES users(id),
    reviewed_at   TIMESTAMPTZ  DEFAULT NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_slips_status
      CHECK (status IN ('pending_verification','approved','rejected'))
  );

  CREATE INDEX IF NOT EXISTS payment_slips_order_id_idx       ON payment_slips (order_id);
  CREATE INDEX IF NOT EXISTS payment_slips_order_uploaded_idx ON payment_slips (order_id, uploaded_at DESC);

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

  -- wishlist — products a user has saved (many-to-many users <-> products)
  CREATE TABLE IF NOT EXISTS wishlist (
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(20) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
  );

  CREATE INDEX IF NOT EXISTS wishlist_product_id_idx ON wishlist (product_id);

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

  -- ════════════════════════════════════════
  -- LIVE CHAT HANDOFF  (migration 018)
  -- ════════════════════════════════════════

  -- chat_sessions — one row per chatbot conversation (created lazily on first
  -- turn). status: 'bot' | 'waiting' (in the human queue) | 'live' (admin claimed)
  -- | 'closed' (admin ended it — bot answers again, same conversation_id).
  CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id            SERIAL       PRIMARY KEY,
    conversation_id       TEXT         NOT NULL UNIQUE,
    user_id               INTEGER      DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    guest_label           VARCHAR(50)  DEFAULT NULL,
    customer_lang         VARCHAR(5)   NOT NULL DEFAULT 'th',
    status                VARCHAR(20)  NOT NULL DEFAULT 'bot',
    assigned_admin_id     INTEGER      DEFAULT NULL REFERENCES users(id),
    escalated_at          TIMESTAMPTZ  DEFAULT NULL,
    claimed_at            TIMESTAMPTZ  DEFAULT NULL,
    ended_at              TIMESTAMPTZ  DEFAULT NULL,
    last_customer_seen_at TIMESTAMPTZ  DEFAULT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_chat_sessions_status
      CHECK (status IN ('bot','waiting','live','closed')),
    CONSTRAINT chk_chat_sessions_customer_lang
      CHECK (customer_lang IN ('th','en'))
  );

  CREATE INDEX IF NOT EXISTS chat_sessions_status_escalated_idx
    ON chat_sessions (status, escalated_at DESC);
  CREATE INDEX IF NOT EXISTS chat_sessions_conversation_id_idx
    ON chat_sessions (conversation_id);

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at'
    ) THEN
      CREATE TRIGGER trg_chat_sessions_updated_at
        BEFORE UPDATE ON chat_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$;

  -- chat_messages — every turn, bot turns included, from message #1.
  -- message_id doubles as the poll cursor (after_id) — must stay monotonic.
  CREATE TABLE IF NOT EXISTS chat_messages (
    message_id      BIGSERIAL    PRIMARY KEY,
    session_id      INTEGER      NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    sender_type     VARCHAR(20)  NOT NULL,
    sender_admin_id INTEGER      DEFAULT NULL REFERENCES users(id),
    body            TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_chat_messages_sender_type
      CHECK (sender_type IN ('customer','bot','admin','system'))
  );

  CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx
    ON chat_messages (session_id, message_id);

  -- admin_presence — heartbeat row per admin/staff, upserted by the admin chat
  -- page's queue poll. "admin online" = any row newer than 60s.
  CREATE TABLE IF NOT EXISTS admin_presence (
    user_id      INTEGER      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

