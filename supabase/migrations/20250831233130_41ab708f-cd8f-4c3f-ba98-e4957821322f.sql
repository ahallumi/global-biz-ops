-- Add failed_count column to product_import_runs if it doesn't exist
ALTER TABLE public.product_import_runs 
ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0;

-- Add index on integration_id and status for better query performance
CREATE INDEX IF NOT EXISTS idx_product_import_runs_integration_status 
ON public.product_import_runs(integration_id, status);

-- Add index on product_pos_links for better deduplication performance
CREATE INDEX IF NOT EXISTS idx_product_pos_links_pos_item_id 
ON public.product_pos_links(pos_item_id);

-- Add index on products UPC for deduplication
CREATE INDEX IF NOT EXISTS idx_products_upc 
ON public.products(upc) WHERE upc IS NOT NULL;

-- Add index on products SKU for deduplication
CREATE INDEX IF NOT EXISTS idx_products_sku 
ON public.products(sku) WHERE sku IS NOT NULL;