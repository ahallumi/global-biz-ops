-- Add unique constraints on product_pos_links to enforce one product per POS ID
ALTER TABLE product_pos_links 
ADD CONSTRAINT unique_pos_link_with_variation 
UNIQUE (integration_id, source, pos_item_id, pos_variation_id);

-- Add partial unique constraint for items without variations  
CREATE UNIQUE INDEX unique_pos_link_no_variation 
ON product_pos_links (integration_id, source, pos_item_id) 
WHERE pos_variation_id IS NULL;

-- Add indexes for fast POS ID lookups
CREATE INDEX idx_pos_links_variation_lookup 
ON product_pos_links (integration_id, source, pos_variation_id) 
WHERE pos_variation_id IS NOT NULL;

CREATE INDEX idx_pos_links_item_lookup 
ON product_pos_links (integration_id, source, pos_item_id);

-- Create view that exposes pos_product_id for easy access
CREATE VIEW v_product_pos_identity AS
SELECT 
  p.id as product_id,
  p.name,
  p.sku,
  p.upc,
  p.barcode,
  p.catalog_status,
  p.sync_state,
  p.origin,
  ppl.integration_id,
  ppl.source,
  ppl.pos_item_id,
  ppl.pos_variation_id,
  COALESCE(ppl.pos_variation_id, ppl.pos_item_id) as pos_product_id,
  ppl.created_at as pos_link_created_at
FROM products p
LEFT JOIN product_pos_links ppl ON p.id = ppl.product_id
WHERE p.catalog_status = 'ACTIVE';

-- Add RLS policy for the view
ALTER VIEW v_product_pos_identity OWNER TO postgres;
GRANT SELECT ON v_product_pos_identity TO authenticated;
GRANT SELECT ON v_product_pos_identity TO anon;