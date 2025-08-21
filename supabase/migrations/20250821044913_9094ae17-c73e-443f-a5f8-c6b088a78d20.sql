-- Bootstrap admin user - promote the existing user to admin role
UPDATE public.employees 
SET role = 'admin'::employee_role 
WHERE user_id = 'f0ec69dc-72a5-49eb-95a7-318c7582ddc3';