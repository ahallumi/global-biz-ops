-- Make user_id nullable for employees who don't have online access initially
ALTER TABLE public.employees ALTER COLUMN user_id DROP NOT NULL;

-- Ensure we have proper constraints and defaults
ALTER TABLE public.employees ALTER COLUMN online_access_enabled SET DEFAULT false;
ALTER TABLE public.employees ALTER COLUMN account_setup_completed SET DEFAULT false;

-- Add constraint to ensure user_id is set when online_access_enabled is true
ALTER TABLE public.employees ADD CONSTRAINT check_user_id_when_online_access 
CHECK (
  (online_access_enabled = false AND user_id IS NULL) OR 
  (online_access_enabled = true AND user_id IS NOT NULL) OR
  (online_access_enabled = false AND user_id IS NOT NULL)
);

-- Create index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);