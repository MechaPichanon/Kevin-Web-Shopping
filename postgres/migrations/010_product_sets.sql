-- 010_product_sets.sql
-- Product "sets" (bundles): a set is a normal products/variants row
-- (products.category = 'set') whose variant is built from 2+ real,
-- standalone-sellable component variants. set_components records that
-- mapping. Stock on a set-variant is derived (never independently
-- tracked) from its components via the triggers below, so selling a set
-- and selling its components standalone always draws from one shared
-- inventory count.

-- A "set" variant's size holds a synthesized label (e.g. "Shirt (M) + Shorts
-- (32)") instead of a plain size code, which doesn't fit the original
-- 10-character limit. Widening is backward compatible — existing values are
-- all well under the new limit.
ALTER TABLE variants ALTER COLUMN size TYPE VARCHAR(100);

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

-- Whenever a set's component list changes (new set option created), give the
-- new set-variant its initial derived stock immediately.
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
