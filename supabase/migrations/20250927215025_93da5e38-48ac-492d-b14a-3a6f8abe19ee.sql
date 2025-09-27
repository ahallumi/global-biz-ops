-- Create label_templates table for storing custom label designs
CREATE TABLE IF NOT EXISTS public.label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL, -- References profile ID in system_settings
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  layout JSONB NOT NULL, -- Template JSON schema with elements and styling
  preview_png BYTEA, -- Optional cached preview image
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_label_templates_profile ON public.label_templates (profile_id);
CREATE INDEX IF NOT EXISTS idx_label_templates_active ON public.label_templates (profile_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all label templates" 
ON public.label_templates 
FOR ALL 
USING (is_admin(auth.uid())) 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view label templates" 
ON public.label_templates 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['admin'::employee_role, 'staff'::employee_role, 'manager'::employee_role])
));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_label_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_label_templates_updated_at
BEFORE UPDATE ON public.label_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_label_templates_updated_at();

-- Insert default templates for existing profiles
DO $$
DECLARE
  config_data JSONB;
  profile_data JSONB;
  profile_record RECORD;
BEGIN
  -- Get current label print config
  SELECT value INTO config_data 
  FROM system_settings 
  WHERE key = 'label_print.config';
  
  -- Loop through profiles and create default templates
  FOR profile_record IN 
    SELECT value AS profile 
    FROM jsonb_array_elements(config_data->'profiles') AS value
  LOOP
    -- Create default template for 62x29mm labels (Brother DK-1209)
    IF (profile_record.profile->>'width_mm')::numeric = 62 AND (profile_record.profile->>'height_mm')::numeric = 29 THEN
      INSERT INTO label_templates (profile_id, name, layout, is_active, created_by)
      VALUES (
        profile_record.profile->>'id',
        'Standard Product Label',
        '{
          "meta": {
            "width_mm": 62,
            "height_mm": 29,
            "dpi": 300,
            "margin_mm": 2,
            "bg": "#FFFFFF"
          },
          "elements": [
            {
              "id": "product_name",
              "type": "text",
              "bind": "product.name",
              "x_mm": 3,
              "y_mm": 3,
              "w_mm": 35,
              "h_mm": 8,
              "style": {
                "font_family": "Inter",
                "font_size_pt": 9,
                "font_weight": 700,
                "align": "left",
                "transform": "none",
                "line_height": 1.05
              },
              "overflow": {
                "mode": "shrink_to_fit",
                "min_font_size_pt": 6,
                "max_lines": 2
              }
            },
            {
              "id": "price",
              "type": "text",
              "bind": "product.price | currency(''$'')",
              "x_mm": 40,
              "y_mm": 3,
              "w_mm": 19,
              "h_mm": 8,
              "style": {
                "font_family": "Inter",
                "font_size_pt": 11,
                "font_weight": 800,
                "align": "right"
              }
            },
            {
              "id": "barcode",
              "type": "barcode",
              "bind": "product.barcode",
              "symbology": "auto",
              "x_mm": 2,
              "y_mm": 12,
              "w_mm": 58,
              "h_mm": 12,
              "human_text": true,
              "module_width_mm": 0.25,
              "quiet_zone_mm": 1
            }
          ]
        }'::jsonb,
        true,
        (SELECT id FROM auth.users LIMIT 1) -- Use first admin user if available
      ) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Create default template for 29x90mm labels (vertical)
    IF (profile_record.profile->>'width_mm')::numeric = 29 AND (profile_record.profile->>'height_mm')::numeric = 90 THEN
      INSERT INTO label_templates (profile_id, name, layout, is_active, created_by)
      VALUES (
        profile_record.profile->>'id',
        'Vertical Address Label',
        '{
          "meta": {
            "width_mm": 29,
            "height_mm": 90,
            "dpi": 300,
            "margin_mm": 2,
            "bg": "#FFFFFF"
          },
          "elements": [
            {
              "id": "product_name",
              "type": "text",
              "bind": "product.name",
              "x_mm": 3,
              "y_mm": 5,
              "w_mm": 23,
              "h_mm": 20,
              "style": {
                "font_family": "Inter",
                "font_size_pt": 8,
                "font_weight": 700,
                "align": "center",
                "transform": "none",
                "line_height": 1.1
              },
              "overflow": {
                "mode": "wrap_lines",
                "min_font_size_pt": 6,
                "max_lines": 4
              }
            },
            {
              "id": "price",
              "type": "text",
              "bind": "product.price | currency(''$'')",
              "x_mm": 3,
              "y_mm": 28,
              "w_mm": 23,
              "h_mm": 8,
              "style": {
                "font_family": "Inter",
                "font_size_pt": 10,
                "font_weight": 800,
                "align": "center"
              }
            },
            {
              "id": "barcode",
              "type": "barcode",
              "bind": "product.barcode",
              "symbology": "auto",
              "x_mm": 2,
              "y_mm": 40,
              "w_mm": 25,
              "h_mm": 35,
              "human_text": true,
              "module_width_mm": 0.25,
              "quiet_zone_mm": 1
            },
            {
              "id": "sku",
              "type": "text",
              "bind": "product.sku",
              "x_mm": 3,
              "y_mm": 78,
              "w_mm": 23,
              "h_mm": 6,
              "style": {
                "font_family": "Inter",
                "font_size_pt": 6,
                "align": "center",
                "opacity": 0.8
              },
              "visibility": {
                "hide_if_empty": true
              }
            }
          ]
        }'::jsonb,
        true,
        (SELECT id FROM auth.users LIMIT 1)
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;