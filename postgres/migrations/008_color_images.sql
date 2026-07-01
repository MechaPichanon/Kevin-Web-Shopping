-- Migration 008: add color grouping to product_images
-- Images are keyed to a color name (matching variants.color).
-- NULL color = applies to all colors (legacy / generic product photo).
-- is_primary stays strictly one-per-product for backward compat with getProducts join.

ALTER TABLE product_images ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- Fast lookup when the storefront requests images for a specific color
CREATE INDEX IF NOT EXISTS product_images_color_idx
  ON product_images (product_id, color);

-- Enforce one-primary-per-product to keep getProducts join stable
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'product_images_one_primary_idx'
  ) THEN
    CREATE UNIQUE INDEX product_images_one_primary_idx
      ON product_images (product_id) WHERE is_primary = TRUE;
  END IF;
END $$;
