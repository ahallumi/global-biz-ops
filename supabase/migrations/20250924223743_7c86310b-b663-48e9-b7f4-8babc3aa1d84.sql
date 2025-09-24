-- Create system_settings table for JSON configuration storage
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create label_print_overrides table for station-specific settings
CREATE TABLE public.label_print_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text,
  profile_id text NOT NULL,
  default_printer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_print_overrides ENABLE ROW LEVEL SECURITY;

-- Create policies for system_settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view system settings" 
ON public.system_settings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['admin'::employee_role, 'staff'::employee_role, 'manager'::employee_role])
));

-- Create policies for label_print_overrides
CREATE POLICY "Admins can manage label print overrides" 
ON public.label_print_overrides 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view label print overrides"
ON public.label_print_overrides 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM employees 
  WHERE user_id = auth.uid() 
  AND role = ANY(ARRAY['admin'::employee_role, 'staff'::employee_role, 'manager'::employee_role])
));

-- Create trigger for updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on label_print_overrides  
CREATE TRIGGER update_label_print_overrides_updated_at
  BEFORE UPDATE ON public.label_print_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default label printing configuration
INSERT INTO public.system_settings (key, value) VALUES 
('label_print.config', jsonb_build_object(
  'active_profile_id', 'brother-29x90',
  'profiles', jsonb_build_array(
    jsonb_build_object(
      'id', 'brother-29x90',
      'label_name', 'Brother DK-1201 (29×90mm)',
      'template_id', 'brother-29x90-product',
      'width_mm', 29, 
      'height_mm', 90,
      'dpi', 300, 
      'margin_mm', 0
    ),
    jsonb_build_object(
      'id', 'brother-62x100',
      'label_name', 'Brother 62mm Continuous (62×100mm)', 
      'template_id', 'brother-62x100-shelf',
      'width_mm', 62, 
      'height_mm', 100,
      'dpi', 300, 
      'margin_mm', 0
    )
  ),
  'print_on_enter', true,
  'beep_on_success', true,
  'preview_before_print', false,
  'default_printer_id', null
));