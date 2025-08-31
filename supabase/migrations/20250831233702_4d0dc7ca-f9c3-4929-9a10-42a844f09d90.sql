-- Phase 1: Add integration_id to product_pos_links and create unique constraint

-- Add integration_id column to product_pos_links
ALTER TABLE public.product_pos_links 
ADD COLUMN IF NOT EXISTS integration_id uuid;

-- Update existing links to populate integration_id from the first Square integration
UPDATE public.product_pos_links 
SET integration_id = (
  SELECT id FROM public.inventory_integrations 
  WHERE provider = 'SQUARE' 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE integration_id IS NULL AND source = 'SQUARE';

-- Make integration_id required for future inserts
ALTER TABLE public.product_pos_links 
ALTER COLUMN integration_id SET NOT NULL;

-- Create unique constraint on (integration_id, pos_item_id, pos_variation_id)
-- First drop the old constraint if it exists
ALTER TABLE public.product_pos_links 
DROP CONSTRAINT IF EXISTS product_pos_links_unique_item_variation;

-- Create new unique constraint that includes integration_id
ALTER TABLE public.product_pos_links 
ADD CONSTRAINT product_pos_links_unique_integration_item_variation 
UNIQUE (integration_id, pos_item_id, pos_variation_id);

-- Add foreign key constraint to ensure integration_id is valid
ALTER TABLE public.product_pos_links 
ADD CONSTRAINT product_pos_links_integration_id_fkey 
FOREIGN KEY (integration_id) REFERENCES public.inventory_integrations(id) ON DELETE CASCADE;