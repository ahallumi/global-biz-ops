-- Step 1: Add approval audit columns to products table
ALTER TABLE products
ADD COLUMN approved_candidate_id UUID REFERENCES product_candidates(id),
ADD COLUMN approved_by UUID,
ADD COLUMN approved_at TIMESTAMPTZ;

-- Step 2: Create v_products_catalog view (secure catalog source)
CREATE OR REPLACE VIEW v_products_catalog AS
SELECT p.*
FROM products p
WHERE p.catalog_status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM product_candidates c
    WHERE c.merged_into_product_id = p.id
      AND c.status = 'PENDING'
  )
  AND NOT EXISTS (
    SELECT 1 FROM product_candidates c
    WHERE c.status = 'PENDING'
      AND c.upc IS NOT NULL
      AND c.upc = p.upc
  );

-- Step 3: Create approval enforcement trigger
CREATE OR REPLACE FUNCTION enforce_product_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting catalog_status to ACTIVE, ensure proper approval audit
  IF NEW.catalog_status = 'ACTIVE' AND OLD.catalog_status != 'ACTIVE' THEN
    -- Allow if user is admin or if approved_candidate_id is set
    IF NOT is_admin(auth.uid()) AND NEW.approved_candidate_id IS NULL THEN
      RAISE EXCEPTION 'Products can only be set to ACTIVE status through candidate approval process';
    END IF;
    
    -- Auto-set approval audit fields if approved_candidate_id is provided
    IF NEW.approved_candidate_id IS NOT NULL AND NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_enforce_product_approval
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION enforce_product_approval();

-- Step 4: Update RLS policies to tighten product creation
-- Drop existing staff insert policy and create more restrictive ones
DROP POLICY IF EXISTS "Staff can insert products" ON products;

-- Allow staff to insert only PLACEHOLDER products
CREATE POLICY "Staff can insert placeholder products"
ON products
FOR INSERT
WITH CHECK (
  catalog_status = 'PLACEHOLDER' 
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() 
    AND role = ANY(ARRAY['admin'::employee_role, 'staff'::employee_role, 'manager'::employee_role])
  )
);

-- Allow admins to insert ACTIVE products (with approval audit)
CREATE POLICY "Admins can insert active products"
ON products
FOR INSERT
WITH CHECK (
  catalog_status = 'ACTIVE' 
  AND is_admin(auth.uid())
  AND (approved_candidate_id IS NOT NULL OR approved_by IS NOT NULL)
);

-- Update existing update policy to respect approval process
DROP POLICY IF EXISTS "products_admin_all" ON products;
CREATE POLICY "products_admin_all"
ON products
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow staff to update their placeholder products
CREATE POLICY "Staff can update placeholder products"
ON products
FOR UPDATE
USING (catalog_status = 'PLACEHOLDER')
WITH CHECK (catalog_status = 'PLACEHOLDER' OR is_admin(auth.uid()));