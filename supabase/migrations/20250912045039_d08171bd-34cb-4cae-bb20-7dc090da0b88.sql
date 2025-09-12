-- Create station login codes table for code-based authentication
CREATE TABLE IF NOT EXISTS public.station_login_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  role TEXT NOT NULL DEFAULT 'station',
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  allowed_paths TEXT[] NOT NULL DEFAULT ARRAY['/station']::TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS station_login_codes_code_idx ON public.station_login_codes (code);
CREATE INDEX IF NOT EXISTS station_login_codes_active_idx ON public.station_login_codes (is_active);
CREATE INDEX IF NOT EXISTS station_login_codes_expires_idx ON public.station_login_codes (expires_at);

-- Enable RLS
ALTER TABLE public.station_login_codes ENABLE ROW LEVEL SECURITY;

-- Admin can manage all codes
CREATE POLICY "Admins can manage station codes" 
ON public.station_login_codes 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));