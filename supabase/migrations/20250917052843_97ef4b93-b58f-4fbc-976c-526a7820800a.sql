-- Phase 1: Database Enhancements for Employee Management + Payroll

-- 1.1 Enhance employees table with missing payroll fields
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS pay_type text DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'salary')),
ADD COLUMN IF NOT EXISTS salary_annual numeric(12,2),
ADD COLUMN IF NOT EXISTS pin_salt text,
ADD COLUMN IF NOT EXISTS pin_hash text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Update existing employees to have first_name/last_name from full_name
UPDATE employees 
SET 
  first_name = CASE 
    WHEN position(' ' in full_name) > 0 THEN split_part(full_name, ' ', 1)
    ELSE full_name
  END,
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Add computed display_name column
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS display_name text 
GENERATED ALWAYS AS (
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN trim(first_name || ' ' || last_name)
    ELSE full_name
  END
) STORED;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);
CREATE INDEX IF NOT EXISTS employees_pay_type_idx ON employees(pay_type);
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees(department);

-- 1.2 Create payroll_settings table (extend time_settings or create new)
CREATE TABLE IF NOT EXISTS payroll_settings (
  id integer PRIMARY KEY DEFAULT 1,
  pay_period text NOT NULL DEFAULT 'weekly' CHECK (pay_period IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  payroll_day integer DEFAULT 5 CHECK (payroll_day >= 0 AND payroll_day <= 6), -- 0=Sun..6=Sat
  overtime_daily numeric DEFAULT 8,
  overtime_weekly numeric DEFAULT 40,
  rounding_minutes integer DEFAULT 1 CHECK (rounding_minutes > 0),
  timezone text DEFAULT 'America/Chicago',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT single_payroll_settings CHECK (id = 1)
);

-- Insert default payroll settings
INSERT INTO payroll_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_payroll_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_settings_updated_at
  BEFORE UPDATE ON payroll_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_settings_updated_at();

-- 1.3 Create time_entries view for easier payroll calculations
CREATE OR REPLACE VIEW v_time_entries AS
SELECT 
  s.id,
  s.employee_id,
  e.display_name as employee_name,
  e.hourly_rate,
  e.pay_type,
  e.department,
  s.clock_in_at,
  s.clock_out_at,
  s.break_seconds / 60.0 as break_minutes,
  s.status,
  -- Calculate work duration in hours
  CASE 
    WHEN s.clock_out_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (s.clock_out_at - s.clock_in_at)) / 3600.0 - (s.break_seconds / 3600.0)
    ELSE NULL
  END as work_hours,
  -- Get the date in Chicago timezone
  (s.clock_in_at AT TIME ZONE 'America/Chicago')::date as work_date,
  s.created_at
FROM shifts s
JOIN employees e ON s.employee_id = e.id
WHERE e.status = 'active';

-- 1.4 Create storage bucket for employee files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-files',
  'employee-files',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for employee-files bucket (admin only)
CREATE POLICY "Admin can manage employee files" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'employee-files' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'employee-files' AND is_admin(auth.uid()));

-- 1.5 Add RLS policies for new tables
ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll settings"
ON payroll_settings
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Staff can view payroll settings"
ON payroll_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'staff', 'manager')
  )
);

-- 1.6 Create function for PIN verification
CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin text, p_salt text, p_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  computed_hash text;
BEGIN
  -- Simple SHA-256 hash with salt (we'll implement proper hashing in edge function)
  -- This is a placeholder - actual hashing will be done in the edge function
  computed_hash := encode(digest(p_salt || ':' || p_pin, 'sha256'), 'base64');
  RETURN computed_hash = p_hash;
END;
$$;

-- 1.7 Create helper function for payroll calculations
CREATE OR REPLACE FUNCTION calculate_employee_hours(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_rounding_minutes integer DEFAULT NULL
)
RETURNS TABLE (
  work_date date,
  regular_hours numeric,
  overtime_hours numeric,
  total_hours numeric,
  entries_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rounding_minutes integer;
  v_overtime_daily numeric;
BEGIN
  -- Get settings if not provided
  SELECT 
    COALESCE(p_rounding_minutes, ps.rounding_minutes),
    ps.overtime_daily
  INTO v_rounding_minutes, v_overtime_daily
  FROM payroll_settings ps
  WHERE ps.id = 1;

  RETURN QUERY
  WITH daily_totals AS (
    SELECT 
      (clock_in_at AT TIME ZONE 'America/Chicago')::date as work_date,
      COUNT(*) as entries_count,
      -- Round total hours based on rounding_minutes setting
      ROUND(
        SUM(
          CASE 
            WHEN clock_out_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (clock_out_at - clock_in_at)) / 3600.0 - (break_seconds / 3600.0)
            ELSE 0
          END
        ) * (60.0 / v_rounding_minutes)
      ) / (60.0 / v_rounding_minutes) as total_hours
    FROM shifts
    WHERE employee_id = p_employee_id
      AND (clock_in_at AT TIME ZONE 'America/Chicago')::date BETWEEN p_start_date AND p_end_date
      AND clock_out_at IS NOT NULL
    GROUP BY (clock_in_at AT TIME ZONE 'America/Chicago')::date
  )
  SELECT 
    dt.work_date,
    CASE 
      WHEN dt.total_hours > v_overtime_daily THEN v_overtime_daily
      ELSE dt.total_hours
    END as regular_hours,
    CASE 
      WHEN dt.total_hours > v_overtime_daily THEN dt.total_hours - v_overtime_daily
      ELSE 0
    END as overtime_hours,
    dt.total_hours,
    dt.entries_count
  FROM daily_totals dt
  ORDER BY dt.work_date;
END;
$$;