-- Allow intake items to reference either an existing product or a product candidate
-- 1) Make product_id nullable to support candidate-only rows
ALTER TABLE public.product_intake_items
  ALTER COLUMN product_id DROP NOT NULL;

-- 2) Add a safety check to ensure at least one of product_id or candidate_id is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_intake_items_product_or_candidate_present'
  ) THEN
    ALTER TABLE public.product_intake_items
      ADD CONSTRAINT product_intake_items_product_or_candidate_present
      CHECK (product_id IS NOT NULL OR candidate_id IS NOT NULL);
  END IF;
END
$$;