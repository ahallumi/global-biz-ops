-- Add catalog_mode column to inventory_integrations table
ALTER TABLE public.inventory_integrations 
ADD COLUMN catalog_mode TEXT NOT NULL DEFAULT 'SEARCH';

-- Add check constraint to ensure valid catalog modes
ALTER TABLE public.inventory_integrations 
ADD CONSTRAINT catalog_mode_valid 
CHECK (catalog_mode IN ('SEARCH', 'LIST'));

-- Update the existing integration to use LIST mode for compatibility
-- This will be the integration that needs list catalog access
UPDATE public.inventory_integrations 
SET catalog_mode = 'LIST' 
WHERE id = (
  SELECT id FROM public.inventory_integrations 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Create index for efficient mode lookups
CREATE INDEX idx_inventory_integrations_mode 
ON public.inventory_integrations(id, catalog_mode);