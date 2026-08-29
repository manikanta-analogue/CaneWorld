CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_branch_id() TO authenticated;

-- BRANCHES
DROP POLICY IF EXISTS "Staff manage branches" ON public.branches;
CREATE POLICY "Read own branch or admin all" ON public.branches FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_branch_id());
CREATE POLICY "Admin insert branches" ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update branches" ON public.branches FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete branches" ON public.branches FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- TRANSACTIONS
DROP POLICY IF EXISTS "Staff manage transactions" ON public.transactions;
CREATE POLICY "Read own branch transactions or admin all" ON public.transactions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR branch_id = public.current_branch_id());
CREATE POLICY "Admin insert transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- TRANSACTION ITEMS
DROP POLICY IF EXISTS "Staff manage transaction items" ON public.transaction_items;
CREATE POLICY "Read own branch items or admin all" ON public.transaction_items FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id AND t.branch_id = public.current_branch_id()
    )
  );
CREATE POLICY "Admin insert items" ON public.transaction_items FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update items" ON public.transaction_items FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete items" ON public.transaction_items FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- CUSTOMERS
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
CREATE POLICY "Read own branch customers or admin all" ON public.customers FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.customer_id = customers.id AND t.branch_id = public.current_branch_id()
    )
  );
CREATE POLICY "Admin insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- LOYALTY
DROP POLICY IF EXISTS "Staff manage loyalty" ON public.loyalty_progress;
CREATE POLICY "Admin manage loyalty" ON public.loyalty_progress FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- CATALOGUE + SETTINGS (readable by any signed-in user, admin-only writes)
DROP POLICY IF EXISTS "Staff manage products" ON public.products;
CREATE POLICY "Read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update products" ON public.products FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete products" ON public.products FOR DELETE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Staff manage categories" ON public.categories;
CREATE POLICY "Read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update categories" ON public.categories FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin delete categories" ON public.categories FOR DELETE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Staff manage settings" ON public.app_settings;
CREATE POLICY "Read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "Admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- SIGNUP HANDLING
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_branch uuid;
  admin_exists boolean;
BEGIN
  BEGIN
    meta_branch := NULLIF(NEW.raw_user_meta_data ->> 'branch_id', '')::uuid;
  EXCEPTION WHEN others THEN
    meta_branch := NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, branch_id)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), meta_branch)
  ON CONFLICT (id) DO UPDATE SET branch_id = EXCLUDED.branch_id;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO admin_exists;

  IF meta_branch IS NULL AND NOT admin_exists THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'branch_user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;