-- Enhance suppliers table with terms, address, and contact information
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS terms text NOT NULL DEFAULT 'NET_30',
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Enhance products table with UPC, size, category, and default cost
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS upc text UNIQUE,
ADD COLUMN IF NOT EXISTS sku text,
ADD COLUMN IF NOT EXISTS size text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS default_cost_cents bigint,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update products table: rename barcode to upc if barcode exists and upc doesn't
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'barcode') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'upc') THEN
            ALTER TABLE public.products RENAME COLUMN barcode TO upc;
        END IF;
    END IF;
END $$;

-- Enhance product_intakes table with missing fields
ALTER TABLE public.product_intakes 
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS date_received date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS location_id text;

-- Enhance product_intake_items table with costing and tracking fields
ALTER TABLE public.product_intake_items 
ADD COLUMN IF NOT EXISTS upc text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS quantity numeric(12,3) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_cost_cents bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS lot_number text,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS line_total_cents bigint GENERATED ALWAYS AS ((quantity * unit_cost_cents)) STORED,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create intake_files table for managing invoice PDFs and pallet photos
CREATE TABLE IF NOT EXISTS public.intake_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.product_intakes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('INVOICE', 'PALLET', 'OTHER')),
  url text NOT NULL,
  mime_type text,
  byte_size bigint,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on intake_files table
ALTER TABLE public.intake_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for intake_files
CREATE POLICY "Users can view files from their intakes"
ON public.intake_files
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.product_intakes 
  WHERE product_intakes.id = intake_files.intake_id 
  AND product_intakes.submitted_by = auth.uid()
));

CREATE POLICY "Users can manage files from their intakes"
ON public.intake_files
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.product_intakes 
  WHERE product_intakes.id = intake_files.intake_id 
  AND product_intakes.submitted_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.product_intakes 
  WHERE product_intakes.id = intake_files.intake_id 
  AND product_intakes.submitted_by = auth.uid()
));

CREATE POLICY "Admin can view all intake files"
ON public.intake_files
FOR SELECT
USING (is_admin(auth.uid()));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_upc ON public.products(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intakes_supplier_date ON public.product_intakes(supplier_id, date_received);
CREATE INDEX IF NOT EXISTS idx_intakes_status ON public.product_intakes(status);
CREATE INDEX IF NOT EXISTS idx_intake_items_intake ON public.product_intake_items(intake_id);
CREATE INDEX IF NOT EXISTS idx_intake_items_product ON public.product_intake_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_items_upc ON public.product_intake_items(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_files_intake ON public.intake_files(intake_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_intake_items_updated_at
    BEFORE UPDATE ON public.product_intake_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();