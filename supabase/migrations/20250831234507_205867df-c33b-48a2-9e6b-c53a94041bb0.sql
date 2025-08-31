-- Fix NULL-safe unique constraints and backfill integration_id
-- First, drop the existing constraint that doesn't handle NULLs properly
ALTER TABLE product_pos_links DROP CONSTRAINT IF EXISTS product_pos_links_integration_id_pos_item_id_pos_variatio_key;

-- Backfill integration_id for existing rows (use the first available integration)
UPDATE product_pos_links 
SET integration_id = (
  SELECT id FROM inventory_integrations 
  WHERE provider = 'SQUARE' 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE integration_id IS NULL;

-- Create NULL-safe unique constraints
-- For rows without pos_variation_id (item-level links)
CREATE UNIQUE INDEX idx_product_pos_links_item_only 
ON product_pos_links (integration_id, pos_item_id) 
WHERE pos_variation_id IS NULL;

-- For rows with pos_variation_id (variation-level links)
CREATE UNIQUE INDEX idx_product_pos_links_item_variation 
ON product_pos_links (integration_id, pos_item_id, pos_variation_id) 
WHERE pos_variation_id IS NOT NULL;

-- Add currency column to products for future currency safety
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD';

-- Create index for better query performance on integration lookups
CREATE INDEX IF NOT EXISTS idx_product_pos_links_integration_lookup 
ON product_pos_links (integration_id, product_id);