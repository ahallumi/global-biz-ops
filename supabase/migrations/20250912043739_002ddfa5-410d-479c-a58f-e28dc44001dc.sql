-- Phase 1: Database Cleanup & Hardening

-- 1.1 Clean up duplicate POS links (keep oldest, delete extras)
WITH duplicates_with_variation AS (
  SELECT 
    integration_id, 
    source, 
    pos_item_id, 
    pos_variation_id,
    MIN(created_at) as oldest_created_at
  FROM product_pos_links 
  WHERE pos_variation_id IS NOT NULL
  GROUP BY integration_id, source, pos_item_id, pos_variation_id
  HAVING COUNT(*) > 1
),
delete_newer_with_variation AS (
  DELETE FROM product_pos_links
  WHERE (integration_id, source, pos_item_id, pos_variation_id, created_at) IN (
    SELECT ppl.integration_id, ppl.source, ppl.pos_item_id, ppl.pos_variation_id, ppl.created_at
    FROM product_pos_links ppl
    JOIN duplicates_with_variation d ON 
      ppl.integration_id = d.integration_id AND
      ppl.source = d.source AND
      ppl.pos_item_id = d.pos_item_id AND
      ppl.pos_variation_id = d.pos_variation_id AND
      ppl.created_at > d.oldest_created_at
  )
  RETURNING integration_id, source, pos_item_id, pos_variation_id
),
duplicates_null_variation AS (
  SELECT 
    integration_id, 
    source, 
    pos_item_id,
    MIN(created_at) as oldest_created_at
  FROM product_pos_links 
  WHERE pos_variation_id IS NULL
  GROUP BY integration_id, source, pos_item_id
  HAVING COUNT(*) > 1
),
delete_newer_null_variation AS (
  DELETE FROM product_pos_links
  WHERE (integration_id, source, pos_item_id, created_at) IN (
    SELECT ppl.integration_id, ppl.source, ppl.pos_item_id, ppl.created_at
    FROM product_pos_links ppl
    JOIN duplicates_null_variation d ON 
      ppl.integration_id = d.integration_id AND
      ppl.source = d.source AND
      ppl.pos_item_id = d.pos_item_id AND
      ppl.pos_variation_id IS NULL AND
      ppl.created_at > d.oldest_created_at
  )
  RETURNING integration_id, source, pos_item_id
)
SELECT 'Cleaned up duplicate POS links' as result;

-- 1.2 Drop all existing indexes and constraints on product_pos_links
DROP INDEX IF EXISTS idx_product_pos_links_integration_id;
DROP INDEX IF EXISTS idx_product_pos_links_pos_item_id;
DROP INDEX IF EXISTS idx_product_pos_links_pos_variation_id;
DROP INDEX IF EXISTS idx_product_pos_links_product_id;
DROP INDEX IF EXISTS idx_product_pos_links_source;
DROP INDEX IF EXISTS product_pos_links_integration_id_idx;
DROP INDEX IF EXISTS product_pos_links_pos_item_id_idx;
DROP INDEX IF EXISTS product_pos_links_pos_variation_id_idx;
DROP INDEX IF EXISTS product_pos_links_product_id_idx;
DROP INDEX IF EXISTS product_pos_links_source_idx;

-- Drop any unique constraints
ALTER TABLE product_pos_links DROP CONSTRAINT IF EXISTS product_pos_links_integration_pos_unique;
ALTER TABLE product_pos_links DROP CONSTRAINT IF EXISTS product_pos_links_unique_link;
ALTER TABLE product_pos_links DROP CONSTRAINT IF EXISTS unique_pos_link;

-- 1.3 Create the two correct unique constraints
-- For links with variations
CREATE UNIQUE INDEX product_pos_links_full_unique 
ON product_pos_links (integration_id, source, pos_item_id, pos_variation_id);

-- For links without variations (partial unique index)
CREATE UNIQUE INDEX product_pos_links_null_variation_unique 
ON product_pos_links (integration_id, source, pos_item_id) 
WHERE pos_variation_id IS NULL;

-- 1.4 Create optimized lookup indexes
CREATE INDEX idx_product_pos_links_integration_source_pos_item 
ON product_pos_links (integration_id, source, pos_item_id);

CREATE INDEX idx_product_pos_links_integration_source_pos_variation 
ON product_pos_links (integration_id, source, pos_variation_id) 
WHERE pos_variation_id IS NOT NULL;

-- Performance indexes on products table
CREATE INDEX IF NOT EXISTS idx_products_upc ON products (upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku) WHERE sku IS NOT NULL;

-- 1.5 Add skipped_count to product_import_runs
ALTER TABLE product_import_runs 
ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;