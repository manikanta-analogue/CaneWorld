-- Remove blanket anonymous access; branch portal now uses server-side functions.
DROP POLICY IF EXISTS "Branch portal can read customers" ON public.customers;
DROP POLICY IF EXISTS "Branch portal can create customers" ON public.customers;
DROP POLICY IF EXISTS "Branch portal reads loyalty" ON public.loyalty_progress;
DROP POLICY IF EXISTS "Branch portal creates loyalty" ON public.loyalty_progress;
DROP POLICY IF EXISTS "Branch portal updates loyalty" ON public.loyalty_progress;
DROP POLICY IF EXISTS "Branch portal reads transactions" ON public.transactions;
DROP POLICY IF EXISTS "Branch portal creates transactions" ON public.transactions;
DROP POLICY IF EXISTS "Branch portal reads transaction items" ON public.transaction_items;
DROP POLICY IF EXISTS "Branch portal creates transaction items" ON public.transaction_items;
DROP POLICY IF EXISTS "Public can read active branches" ON public.branches;
DROP POLICY IF EXISTS "Public reads settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read products" ON public.products;

REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.loyalty_progress FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.transaction_items FROM anon;
REVOKE ALL ON public.branches FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.products FROM anon;

-- Staff visibility: own row, or any row for admins.
DROP POLICY IF EXISTS "Staff read profiles" ON public.profiles;
CREATE POLICY "Read own profile or admin reads all"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Staff read roles" ON public.user_roles;
CREATE POLICY "Read own roles or admin reads all"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));