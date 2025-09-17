-- Add online access control and invite system fields to employees table
ALTER TABLE public.employees 
ADD COLUMN online_access_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN account_setup_completed boolean NOT NULL DEFAULT false,
ADD COLUMN invited_at timestamp with time zone,
ADD COLUMN setup_token text,
ADD COLUMN setup_token_expires timestamp with time zone;

-- Create index on setup_token for faster lookups
CREATE INDEX idx_employees_setup_token ON public.employees(setup_token) WHERE setup_token IS NOT NULL;