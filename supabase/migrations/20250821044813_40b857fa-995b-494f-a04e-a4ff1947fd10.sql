-- Phase 1: Create security definer functions to break RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM employees e
    WHERE e.user_id = p_uid
      AND e.role = 'admin'::employee_role
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

-- Generic role helper for future use
CREATE OR REPLACE FUNCTION public.has_role(p_uid uuid, p_roles employee_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM employees e
    WHERE e.user_id = p_uid
      AND e.role = ANY(p_roles)
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, employee_role[]) TO anon, authenticated, service_role;

-- Phase 2: Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admin users can manage employees" ON public.employees;

-- Phase 3: Create new non-recursive policies
CREATE POLICY "employees_read_self"
ON public.employees
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "employees_update_self"
ON public.employees
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "employees_admin_all"
ON public.employees
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Phase 4: Update other table policies to use the helper functions
-- Update product_intakes policies
DROP POLICY IF EXISTS "Admin can view all intakes" ON public.product_intakes;
DROP POLICY IF EXISTS "Admin can update all intakes" ON public.product_intakes;

CREATE POLICY "product_intakes_admin_select"
ON public.product_intakes
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "product_intakes_admin_update"
ON public.product_intakes
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Update product_intake_items policies
DROP POLICY IF EXISTS "Admin can view all intake items" ON public.product_intake_items;

CREATE POLICY "product_intake_items_admin_select"
ON public.product_intake_items
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update products policies
DROP POLICY IF EXISTS "Admin users can manage products" ON public.products;

CREATE POLICY "products_admin_all"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Update suppliers policies
DROP POLICY IF EXISTS "Admin users can manage suppliers" ON public.suppliers;

CREATE POLICY "suppliers_admin_all"
ON public.suppliers
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));