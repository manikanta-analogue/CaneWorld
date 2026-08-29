-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin', 'branch_user');
CREATE TYPE public.branch_status AS ENUM ('active', 'disabled');

-- BRANCHES
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  status public.branch_status NOT NULL DEFAULT 'active',
  qr_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT SELECT ON public.branches TO anon;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read active branches" ON public.branches FOR SELECT TO anon USING (status = 'active');

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  volume_ml integer NOT NULL DEFAULT 0,
  price numeric(10,2) NOT NULL DEFAULT 0,
  loyalty_target integer NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read products" ON public.products FOR SELECT TO anon USING (true);

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT ON public.customers TO anon;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Branch portal can read customers" ON public.customers FOR SELECT TO anon USING (true);
CREATE POLICY "Branch portal can create customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);

-- LOYALTY PROGRESS
CREATE TABLE public.loyalty_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchased_count integer NOT NULL DEFAULT 0,
  redeemed_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.loyalty_progress TO anon;
GRANT ALL ON public.loyalty_progress TO service_role;
ALTER TABLE public.loyalty_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage loyalty" ON public.loyalty_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Branch portal reads loyalty" ON public.loyalty_progress FOR SELECT TO anon USING (true);
CREATE POLICY "Branch portal creates loyalty" ON public.loyalty_progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Branch portal updates loyalty" ON public.loyalty_progress FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_glasses integer NOT NULL DEFAULT 0,
  free_glasses integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference_no text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT ON public.transactions TO anon;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Branch portal reads transactions" ON public.transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Branch portal creates transactions" ON public.transactions FOR INSERT TO anon WITH CHECK (true);

-- TRANSACTION ITEMS
CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  paid_quantity integer NOT NULL DEFAULT 0,
  free_quantity integer NOT NULL DEFAULT 0,
  line_total numeric(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_items TO authenticated;
GRANT SELECT, INSERT ON public.transaction_items TO anon;
GRANT ALL ON public.transaction_items TO service_role;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage transaction items" ON public.transaction_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Branch portal reads transaction items" ON public.transaction_items FOR SELECT TO anon USING (true);
CREATE POLICY "Branch portal creates transaction items" ON public.transaction_items FOR INSERT TO anon WITH CHECK (true);

-- SETTINGS (singleton)
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'Sugarcane Fresh',
  logo_url text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT '₹',
  razorpay_key text NOT NULL DEFAULT 'rzp_test_dummy_key',
  business_mobile text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public reads settings" ON public.app_settings FOR SELECT TO anon USING (true);

-- STAFF PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'super_admin',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_staff
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();

-- SEED
INSERT INTO public.app_settings (id, company_name, currency, business_mobile)
VALUES (1, 'Sugarcane Fresh', '₹', '9876500000');

INSERT INTO public.products (id, name, volume_ml, price, loyalty_target, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', '300ml', 300, 30, 10, 1),
  ('11111111-1111-1111-1111-111111111102', '500ml', 500, 50, 9, 2),
  ('11111111-1111-1111-1111-111111111103', '1L', 1000, 90, 8, 3),
  ('11111111-1111-1111-1111-111111111104', '2L', 2000, 170, 7, 4);

INSERT INTO public.branches (id, name, owner_name, mobile, address, status, qr_token) VALUES
  ('22222222-2222-2222-2222-222222222201', 'MG Road Branch', 'Ravi Kumar', '9876500011', '12 MG Road, Bengaluru', 'active', 'brmgroad001'),
  ('22222222-2222-2222-2222-222222222202', 'Jayanagar Branch', 'Suresh Patil', '9876500012', '45 4th Block, Jayanagar', 'active', 'brjayanagar002'),
  ('22222222-2222-2222-2222-222222222203', 'Whitefield Branch', 'Anita Rao', '9876500013', '9 ITPL Main Road, Whitefield', 'active', 'brwhitefield003'),
  ('22222222-2222-2222-2222-222222222204', 'Indiranagar Branch', 'Kiran Shetty', '9876500014', '100ft Road, Indiranagar', 'active', 'brindiranagar004'),
  ('22222222-2222-2222-2222-222222222205', 'Hebbal Branch', 'Deepa Nair', '9876500015', 'Outer Ring Road, Hebbal', 'active', 'brhebbal005');

INSERT INTO public.customers (id, name, mobile) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Arjun Mehta', '9000000001'),
  ('33333333-3333-3333-3333-333333333302', 'Priya Sharma', '9000000002'),
  ('33333333-3333-3333-3333-333333333303', 'Rahul Verma', '9000000003'),
  ('33333333-3333-3333-3333-333333333304', 'Sneha Iyer', '9000000004'),
  ('33333333-3333-3333-3333-333333333305', 'Vikram Singh', '9000000005'),
  ('33333333-3333-3333-3333-333333333306', 'Meera Joshi', '9000000006');

INSERT INTO public.loyalty_progress (customer_id, product_id, purchased_count, redeemed_count) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 9, 1),
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102', 2, 0),
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111104', 1, 0),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', 4, 0),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111103', 7, 2),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111102', 8, 0),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111101', 2, 0),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111104', 6, 1),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111103', 3, 0);

INSERT INTO public.transactions (id, branch_id, customer_id, total_amount, paid_glasses, free_glasses, payment_method, reference_no, created_at) VALUES
  ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', 90, 3, 0, 'cash', 'TXN10001', now() - interval '2 hours'),
  ('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333302', 140, 2, 1, 'razorpay', 'TXN10002', now() - interval '5 hours'),
  ('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222203', '33333333-3333-3333-3333-333333333303', 50, 1, 0, 'cash', 'TXN10003', now() - interval '1 day'),
  ('44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333305', 340, 2, 0, 'razorpay', 'TXN10004', now() - interval '2 days'),
  ('44444444-4444-4444-4444-444444444405', '22222222-2222-2222-2222-222222222204', '33333333-3333-3333-3333-333333333306', 180, 2, 0, 'cash', 'TXN10005', now() - interval '4 days');

INSERT INTO public.transaction_items (transaction_id, product_id, product_name, unit_price, paid_quantity, free_quantity, line_total) VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', '300ml', 30, 3, 0, 90),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111103', '1L', 90, 1, 1, 90),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111101', '300ml', 30, 1, 0, 30),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111102', '500ml', 50, 0, 0, 0),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111102', '500ml', 50, 1, 0, 50),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111104', '2L', 170, 2, 0, 340),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111103', '1L', 90, 2, 0, 180);
