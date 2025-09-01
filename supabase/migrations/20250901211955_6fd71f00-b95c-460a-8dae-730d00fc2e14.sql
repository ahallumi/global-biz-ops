-- Phase 1: Add critical unique constraints and performance indexes to product_pos_links

-- Add unique constraint for complete POS identity (handles both variations and non-variations)
ALTER TABLE product_pos_links 
ADD CONSTRAINT product_pos_links_pos_identity_unique 
UNIQUE (integration_id, source, pos_item_id, pos_variation_id);

-- Add partial unique constraint for items without variations
CREATE UNIQUE INDEX product_pos_links_no_variation_unique 
ON product_pos_links (integration_id, source, pos_item_id) 
WHERE pos_variation_id IS NULL;

-- Add performance indexes for fast POS ID matching
CREATE INDEX idx_product_pos_links_variation_lookup 
ON product_pos_links (integration_id, source, pos_variation_id) 
WHERE pos_variation_id IS NOT NULL;

CREATE INDEX idx_product_pos_links_item_lookup 
ON product_pos_links (integration_id, source, pos_item_id);

-- Add index for reverse lookups (product to POS ID)
CREATE INDEX idx_product_pos_links_product_lookup 
ON product_pos_links (product_id, integration_id, source);