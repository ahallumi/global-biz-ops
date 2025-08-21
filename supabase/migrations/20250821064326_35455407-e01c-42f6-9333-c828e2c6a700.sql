-- Fix security issues from previous migration

-- Fix function search path for ct_date function
CREATE OR REPLACE FUNCTION public.ct_date(ts timestamptz)
RETURNS date 
LANGUAGE sql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (ts AT TIME ZONE 'America/Chicago')::date;
$$;

-- Recreate the view with proper security settings
DROP VIEW IF EXISTS public.v_timesheet_daily;

CREATE OR REPLACE VIEW public.v_timesheet_daily 
SECURITY DEFINER
AS
SELECT
  s.employee_id,
  public.ct_date(s.clock_in_at) as day_ct,
  SUM(EXTRACT(epoch FROM (COALESCE(s.clock_out_at, now()) - s.clock_in_at))::bigint - s.break_seconds) as net_seconds,
  SUM(s.break_seconds) as break_seconds,
  MIN(s.clock_in_at) as first_in,
  MAX(s.clock_out_at) as last_out,
  COUNT(*) as shifts_count
FROM public.shifts s
GROUP BY s.employee_id, public.ct_date(s.clock_in_at);

-- Grant necessary permissions
GRANT SELECT ON public.v_timesheet_daily TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_date(timestamptz) TO authenticated;