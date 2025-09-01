-- Phase 1: Add Missing Unique Constraints and Indexes for product_pos_links

-- Add the primary unique constraint that includes integration_id
-- This prevents duplicate POS links for the same integration
ALTER TABLE product_pos_links 
ADD CONSTRAINT unique_integration_pos_link 
UNIQUE (integration_id, source, pos_item_id, pos_variation_id);

-- Add partial unique constraint for when pos_variation_id is NULL
-- This handles Square items without variations
CREATE UNIQUE INDEX unique_integration_pos_item_no_variation 
ON product_pos_links (integration_id, source, pos_item_id) 
WHERE pos_variation_id IS NULL;

-- Add performance indexes for fast matching during imports
CREATE INDEX idx_pos_links_integration_source_variation 
ON product_pos_links (integration_id, source, pos_variation_id);

CREATE INDEX idx_pos_links_integration_source_item 
ON product_pos_links (integration_id, source, pos_item_id);

-- Add index for product_id lookups (used frequently in imports)
CREATE INDEX idx_pos_links_product_id 
ON product_pos_links (product_id);