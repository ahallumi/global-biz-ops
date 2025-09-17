-- Fix security issues from previous migration

-- 1. Fix view security definer issues by recreating views without security definer
DROP VIEW IF EXISTS v_time_entries;

-- Recreate view as regular view (not security definer)
CREATE VIEW v_time_entries AS
SELECT 
  s.id,
  s.employee_id,
  e.display_name as employee_name,
  e.hourly_rate_cents / 100.0 as hourly_rate, -- Convert cents to dollars
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

-- 2. Fix function search path issues by adding SET search_path
DROP FUNCTION IF EXISTS verify_employee_pin(text, text, text);
CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin text, p_salt text, p_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  computed_hash text;
BEGIN
  -- Simple SHA-256 hash with salt (actual hashing will be done in edge function)
  computed_hash := encode(digest(p_salt || ':' || p_pin, 'sha256'), 'base64');
  RETURN computed_hash = p_hash;
END;
$$;

DROP FUNCTION IF EXISTS calculate_employee_hours(uuid, date, date, integer);
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
SET search_path = public
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

-- 3. Fix the payroll settings trigger function search path
DROP FUNCTION IF EXISTS update_payroll_settings_updated_at();
CREATE OR REPLACE FUNCTION update_payroll_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;