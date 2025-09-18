-- Remove the automatic user-to-employee trigger that creates conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Ensure RLS policies work correctly with nullable user_id
-- Update existing RLS policies to handle null user_id properly
DROP POLICY IF EXISTS "Users can view their own employee record" ON public.employees;
DROP POLICY IF EXISTS "employees_read_self" ON public.employees;
DROP POLICY IF EXISTS "employees_update_self" ON public.employees;

-- Recreate policies to handle null user_id
CREATE POLICY "Users can view their own employee record" 
ON public.employees 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "employees_read_self" 
ON public.employees 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "employees_update_self" 
ON public.employees 
FOR UPDATE 
USING (user_id = auth.uid() AND user_id IS NOT NULL)
WITH CHECK (user_id = auth.uid() AND user_id IS NOT NULL);