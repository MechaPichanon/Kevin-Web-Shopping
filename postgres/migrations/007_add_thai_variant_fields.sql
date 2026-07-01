-- Migration 007: Add Thai language columns for category, sub_category, pattern, sleeve, collar
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS)

-- products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_th     VARCHAR(50) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category_th VARCHAR(50) DEFAULT NULL;

-- variants table
ALTER TABLE variants ADD COLUMN IF NOT EXISTS pattern_th VARCHAR(50) DEFAULT NULL;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS sleeve_th  VARCHAR(20) DEFAULT NULL;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS collar_th  VARCHAR(30) DEFAULT NULL;
