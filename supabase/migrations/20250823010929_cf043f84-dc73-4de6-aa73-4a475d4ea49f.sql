-- Fix security issue: Set search_path for the approval enforcement function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';