-- 015_wishlish.sql

-- Stores products that users have added to their wishlist.
-- A user can add many products to their wishlist.
-- A product can belong to many users.

CREATE TABLE IF NOT EXISTS wishlist (
  user_id    INTEGER NOT NULL
             REFERENCES users(id)
             ON DELETE CASCADE,

  product_id VARCHAR NOT NULL
             REFERENCES products(product_id)
             ON DELETE CASCADE,

  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, product_id)
);

-- Helps when finding users who saved a particular product.
CREATE INDEX IF NOT EXISTS wishlists_product_id_idx
  ON wishlists (product_id);