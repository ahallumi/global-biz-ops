-- Step 7: Cleanup leaked products
-- First identify products that are ACTIVE without approval audit
-- These are products that bypassed the candidate approval process

-- Preview leaked products (for logging/verification)
DO $$
DECLARE
    leaked_count integer;
BEGIN
    SELECT COUNT(*)
    INTO leaked_count
    FROM products p
    WHERE p.catalog_status = 'ACTIVE'
      AND p.approved_candidate_id IS NULL
      -- Exclude Square imports (they have origin = 'SQUARE')
      AND (p.origin IS NULL OR p.origin != 'SQUARE')
      -- Exclude products that might be legitimately created by admins
      AND p.created_at > '2024-01-01'::timestamptz;
    
    RAISE NOTICE 'Found % potentially leaked products to quarantine', leaked_count;
END $$;

-- Quarantine leaked products by setting them to PLACEHOLDER status
-- This preserves the data but removes them from catalog until re-approved
UPDATE products
SET 
    catalog_status = 'PLACEHOLDER',
    updated_at = now()
WHERE catalog_status = 'ACTIVE'
  AND approved_candidate_id IS NULL
  -- Exclude Square imports (they have proper origin)
  AND (origin IS NULL OR origin != 'SQUARE')
  -- Only target recent products to avoid disrupting long-standing data
  AND created_at > '2024-01-01'::timestamptz;

-- Log the number of quarantined products
DO $$
DECLARE
    quarantine_count integer;
BEGIN
    GET DIAGNOSTICS quarantine_count = ROW_COUNT;
    RAISE NOTICE 'Quarantined % leaked products to PLACEHOLDER status', quarantine_count;
END $$;