-- Phase 1: Staff Clocking System Database Schema

-- Extend existing employees table with time tracking fields
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS hourly_rate_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_code text,
  ADD COLUMN IF NOT EXISTS staff_pin text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Punch events (append-only audit of all actions)
CREATE TABLE IF NOT EXISTS public.punch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
  shift_id uuid,
  kind text NOT NULL CHECK (kind IN ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END','ADJUSTMENT','AUTO_CLOCK_OUT')),
  event_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'WEB',
  ip text,
  user_agent text,
  note text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Shifts (one row per working session)
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
  clock_in_at timestamptz NOT NULL,
  clock_out_at timestamptz,
  break_seconds integer NOT NULL DEFAULT 0,
  break_open_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'ADJUSTED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Detailed break rows
CREATE TABLE IF NOT EXISTS public.shift_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  kind text NOT NULL DEFAULT 'UNPAID' CHECK (kind IN ('UNPAID', 'MEAL', 'PAID')),
  created_at timestamptz DEFAULT now()
);

-- Settings (admin configurable)
CREATE TABLE IF NOT EXISTS public.time_settings (
  id int PRIMARY KEY DEFAULT 1,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  rounding_minutes int NOT NULL DEFAULT 1,
  auto_clock_out_hours int NOT NULL DEFAULT 12,
  default_break_kind text NOT NULL DEFAULT 'UNPAID',
  overtime_daily_hours numeric NOT NULL DEFAULT 8,
  overtime_weekly_hours numeric NOT NULL DEFAULT 40
);

-- Insert default settings
INSERT INTO public.time_settings (id, timezone, rounding_minutes, auto_clock_out_hours, default_break_kind, overtime_daily_hours, overtime_weekly_hours)
VALUES (1, 'America/Chicago', 1, 12, 'UNPAID', 8, 40)
ON CONFLICT (id) DO NOTHING;

-- Helper function: convert timestamptz to CT date
CREATE OR REPLACE FUNCTION public.ct_date(ts timestamptz)
RETURNS date 
LANGUAGE sql 
IMMUTABLE 
AS $$
  SELECT (ts AT TIME ZONE 'America/Chicago')::date;
$$;

-- Daily timesheet view
CREATE OR REPLACE VIEW public.v_timesheet_daily AS
SELECT
  s.employee_id,
  ct_date(s.clock_in_at) as day_ct,
  SUM(EXTRACT(epoch FROM (COALESCE(s.clock_out_at, now()) - s.clock_in_at))::bigint - s.break_seconds) as net_seconds,
  SUM(s.break_seconds) as break_seconds,
  MIN(s.clock_in_at) as first_in,
  MAX(s.clock_out_at) as last_out,
  COUNT(*) as shifts_count
FROM shifts s
GROUP BY s.employee_id, ct_date(s.clock_in_at);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id, clock_in_at);
CREATE INDEX IF NOT EXISTS idx_punch_employee ON punch_events(employee_id, event_at);
CREATE INDEX IF NOT EXISTS idx_breaks_shift ON shift_breaks(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status, employee_id);

-- Enable RLS on new tables
ALTER TABLE public.punch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for punch_events
CREATE POLICY "punch_read_self" ON public.punch_events
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR is_admin(auth.uid()));

-- RLS Policies for shifts
CREATE POLICY "shifts_select_self" ON public.shifts
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "shifts_insert_self" ON public.shifts
FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "shifts_update_self" ON public.shifts
FOR UPDATE TO authenticated
USING (employee_id = auth.uid() OR is_admin(auth.uid()))
WITH CHECK (employee_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "shifts_admin_all" ON public.shifts
FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for shift_breaks
CREATE POLICY "breaks_select_self" ON public.shift_breaks
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM shifts s 
  WHERE s.id = shift_breaks.shift_id 
  AND (s.employee_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "breaks_insert_self" ON public.shift_breaks
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM shifts s 
  WHERE s.id = shift_breaks.shift_id 
  AND s.employee_id = auth.uid()
));

CREATE POLICY "breaks_admin_all" ON public.shift_breaks
FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for time_settings
CREATE POLICY "settings_read_all" ON public.time_settings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "settings_admin_manage" ON public.time_settings
FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger for updating shifts.updated_at
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();