-- Fix existing employees who have online_access_enabled set to false
-- This is critical to restore access for existing users including admins
UPDATE public.employees 
SET online_access_enabled = true 
WHERE online_access_enabled = false;

-- Also ensure any new employees created through the trigger have online access enabled by default
-- Update the handle_new_user function to set online_access_enabled to true by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
    INSERT INTO public.employees (user_id, full_name, role, online_access_enabled)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'staff',
        true  -- Enable online access by default for new users
    );
    RETURN NEW;
END;
$$;