-- Fix security definer view by making it a regular view
DROP VIEW v_product_pos_identity;

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

-- Enable RLS on the view
ALTER VIEW v_product_pos_identity SET (security_invoker = true);

-- Grant permissions
GRANT SELECT ON v_product_pos_identity TO authenticated;
GRANT SELECT ON v_product_pos_identity TO anon;