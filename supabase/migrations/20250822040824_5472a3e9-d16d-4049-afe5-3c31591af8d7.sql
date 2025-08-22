-- Phase 1: Product Candidates (staging) table
CREATE TABLE IF NOT EXISTS public.product_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'INTAKE', -- INTAKE | OCR | MANUAL
  intake_id UUID REFERENCES public.product_intakes(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  upc TEXT,
  plu TEXT,
  name TEXT,
  size TEXT,
  unit_of_sale unit_of_sale DEFAULT 'EACH',
  weight_unit TEXT DEFAULT 'LB',
  suggested_units_per_case INTEGER,
  suggested_cost_cents BIGINT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | MERGED
  merged_into_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for product_candidates
CREATE INDEX IF NOT EXISTS idx_pc_by_intake ON public.product_candidates(intake_id);
CREATE INDEX IF NOT EXISTS idx_pc_by_supplier ON public.product_candidates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pc_by_upc ON public.product_candidates(upc);
CREATE INDEX IF NOT EXISTS idx_pc_by_status ON public.product_candidates(status);

-- Add origin and sync_state to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'LOCAL', -- LOCAL | SQUARE | MERGED
  ADD COLUMN IF NOT EXISTS sync_state TEXT NOT NULL DEFAULT 'LOCAL_ONLY'; -- LOCAL_ONLY | SYNCED | DIVERGED | REMOTE_ONLY | DELETED_REMOTE

-- Add candidate_id to product_intake_items
ALTER TABLE public.product_intake_items
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES public.product_candidates(id) ON DELETE SET NULL;

-- Product sync runs table for tracking push operations
CREATE TABLE IF NOT EXISTS public.product_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status import_status NOT NULL DEFAULT 'PENDING',
  direction TEXT NOT NULL DEFAULT 'OUT', -- OUT = push to Square, IN = pull from Square
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  processed_count INTEGER DEFAULT 0,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  created_by UUID
);

-- Enable RLS on new tables
ALTER TABLE public.product_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sync_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_candidates
CREATE POLICY "Staff can view candidates from their intakes" 
ON public.product_candidates 
FOR SELECT 
USING (
  intake_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM public.product_intakes 
    WHERE product_intakes.id = product_candidates.intake_id 
    AND product_intakes.submitted_by = auth.uid()
  ) OR 
  is_admin(auth.uid())
);

CREATE POLICY "Staff can create candidates for their intakes" 
ON public.product_candidates 
FOR INSERT 
WITH CHECK (
  (created_by = auth.uid() OR created_by IS NULL) AND
  (intake_id IS NULL OR 
   EXISTS (
     SELECT 1 FROM public.product_intakes 
     WHERE product_intakes.id = product_candidates.intake_id 
     AND product_intakes.submitted_by = auth.uid()
   )) AND
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.user_id = auth.uid() 
    AND employees.role = ANY(ARRAY['admin'::employee_role, 'staff'::employee_role, 'manager'::employee_role])
  )
);

CREATE POLICY "Admins can manage all candidates" 
ON public.product_candidates 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS policies for product_sync_runs
CREATE POLICY "Admins can manage sync runs" 
ON public.product_sync_runs 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Update trigger for product_candidates
CREATE TRIGGER update_product_candidates_updated_at
  BEFORE UPDATE ON public.product_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();