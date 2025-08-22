-- Phase 1: Database Foundation for Square POS Integration (Fixed)

-- Create enums
CREATE TYPE unit_of_sale AS ENUM ('EACH', 'WEIGHT');
CREATE TYPE pos_source AS ENUM ('SQUARE');
CREATE TYPE import_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE intake_resolve AS ENUM ('OK', 'QTY_MISMATCH', 'PRICE_MISMATCH', 'NEW_PRODUCT', 'MISSING');

-- Update existing products table with new columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS plu text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_sale unit_of_sale NOT NULL DEFAULT 'EACH';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'LB';
ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_price_cents bigint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;

-- POS bindings (Square mapping)
CREATE TABLE product_pos_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source pos_source NOT NULL DEFAULT 'SQUARE',
  pos_item_id text NOT NULL,
  pos_variation_id text,
  location_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index for product_pos_links to handle nulls properly
CREATE UNIQUE INDEX idx_pos_links_unique_full ON product_pos_links(source, pos_item_id, pos_variation_id, location_id)
  WHERE pos_variation_id IS NOT NULL AND location_id IS NOT NULL;
CREATE UNIQUE INDEX idx_pos_links_unique_no_variation ON product_pos_links(source, pos_item_id, location_id)
  WHERE pos_variation_id IS NULL AND location_id IS NOT NULL;
CREATE UNIQUE INDEX idx_pos_links_unique_no_location ON product_pos_links(source, pos_item_id, pos_variation_id)
  WHERE pos_variation_id IS NOT NULL AND location_id IS NULL;
CREATE UNIQUE INDEX idx_pos_links_unique_minimal ON product_pos_links(source, pos_item_id)
  WHERE pos_variation_id IS NULL AND location_id IS NULL;

-- Supplier defaults (used in Intake & cost autofill)
CREATE TABLE supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  units_per_case integer DEFAULT 0,
  last_cost_cents bigint,
  last_received_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (supplier_id, product_id)
);

-- Inventory integrations (admin-configurable)
CREATE TABLE inventory_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider pos_source NOT NULL DEFAULT 'SQUARE',
  environment text NOT NULL DEFAULT 'PRODUCTION',
  display_name text DEFAULT 'Square',
  auto_import_enabled boolean NOT NULL DEFAULT false,
  auto_import_interval_minutes integer NOT NULL DEFAULT 180,
  last_success_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Encrypted credentials (token is stored encrypted)
CREATE TABLE integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES inventory_integrations(id) ON DELETE CASCADE,
  secret_ciphertext bytea NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (integration_id)
);

-- Import runs logging
CREATE TABLE product_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES inventory_integrations(id) ON DELETE CASCADE,
  status import_status NOT NULL DEFAULT 'PENDING',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  processed_count int DEFAULT 0,
  created_count int DEFAULT 0,
  updated_count int DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  cursor text,
  created_by uuid
);

-- Link invoice lines to intake lines for reconciliation
CREATE TABLE intake_reconcile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES product_intakes(id) ON DELETE CASCADE,
  invoice_line_id uuid,
  intake_item_id uuid REFERENCES product_intake_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id),
  expected_qty numeric(12,3),
  received_qty numeric(12,3),
  expected_cost_cents bigint,
  received_cost_cents bigint,
  status intake_resolve NOT NULL DEFAULT 'OK',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies

-- Product POS Links - Admin only
ALTER TABLE product_pos_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_links_admin_all" ON product_pos_links FOR ALL USING (is_admin(auth.uid()));

-- Supplier Products - Read for staff, manage for admin
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_products_read_staff" ON supplier_products FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'staff', 'manager')
  )
);
CREATE POLICY "supplier_products_admin_manage" ON supplier_products FOR ALL USING (is_admin(auth.uid()));

-- Inventory Integrations - Admin only
ALTER TABLE inventory_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_admin_all" ON inventory_integrations FOR ALL USING (is_admin(auth.uid()));

-- Integration Credentials - Admin only, never expose in select
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials_admin_all" ON integration_credentials FOR ALL USING (is_admin(auth.uid()));

-- Import Runs - Admin only
ALTER TABLE product_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_runs_admin_all" ON product_import_runs FOR ALL USING (is_admin(auth.uid()));

-- Intake Reconcile - Staff for their intakes, admin for all
ALTER TABLE intake_reconcile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reconcile_staff_own" ON intake_reconcile FOR ALL USING (
  EXISTS (
    SELECT 1 FROM product_intakes 
    WHERE id = intake_reconcile.intake_id 
    AND submitted_by = auth.uid()
  )
);
CREATE POLICY "reconcile_admin_all" ON intake_reconcile FOR ALL USING (is_admin(auth.uid()));

-- Additional Indexes for performance
CREATE INDEX idx_pos_links_product ON product_pos_links(product_id);
CREATE INDEX idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_product ON supplier_products(product_id);
CREATE INDEX idx_import_runs_integration ON product_import_runs(integration_id);
CREATE INDEX idx_reconcile_intake ON intake_reconcile(intake_id);
CREATE INDEX idx_products_unit_sale ON products(unit_of_sale);
CREATE INDEX idx_products_plu ON products(plu) WHERE plu IS NOT NULL;