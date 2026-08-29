CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

INSERT INTO public.categories (id, name, sort_order) VALUES
 ('22222222-2222-2222-2222-222222222201','Sugarcane Juice',1),
 ('22222222-2222-2222-2222-222222222202','Vegetable Juices',2),
 ('22222222-2222-2222-2222-222222222203','Fruit Mix with Sugarcane Juice',3),
 ('22222222-2222-2222-2222-222222222204','Fruit Juices',4),
 ('22222222-2222-2222-2222-222222222205','Sipper Bottle',5);

UPDATE public.products SET category_id = '22222222-2222-2222-2222-222222222201';

UPDATE public.products SET price = 25 WHERE volume_ml = 300 AND category_id = '22222222-2222-2222-2222-222222222201';
UPDATE public.products SET price = 50 WHERE volume_ml = 500 AND category_id = '22222222-2222-2222-2222-222222222201';
UPDATE public.products SET price = 80 WHERE volume_ml = 1000 AND category_id = '22222222-2222-2222-2222-222222222201';
UPDATE public.products SET price = 150 WHERE volume_ml = 2000 AND category_id = '22222222-2222-2222-2222-222222222201';

INSERT INTO public.products (name, volume_ml, price, loyalty_target, sort_order, is_active, category_id) VALUES
 ('5L', 5000, 450, 6, 5, true, '22222222-2222-2222-2222-222222222201'),
 ('300ml', 300, 50, 11, 11, true, '22222222-2222-2222-2222-222222222202'),
 ('500ml', 500, 80, 9, 12, true, '22222222-2222-2222-2222-222222222202'),
 ('1L', 1000, 150, 8, 13, true, '22222222-2222-2222-2222-222222222202'),
 ('2L', 2000, 300, 7, 14, true, '22222222-2222-2222-2222-222222222202'),
 ('5L', 5000, 600, 6, 15, true, '22222222-2222-2222-2222-222222222202'),
 ('300ml', 300, 40, 11, 21, true, '22222222-2222-2222-2222-222222222203'),
 ('500ml', 500, 70, 9, 22, true, '22222222-2222-2222-2222-222222222203'),
 ('1L', 1000, 130, 8, 23, true, '22222222-2222-2222-2222-222222222203'),
 ('2L', 2000, 250, 7, 24, true, '22222222-2222-2222-2222-222222222203'),
 ('5L', 5000, 500, 6, 25, true, '22222222-2222-2222-2222-222222222203'),
 ('300ml', 300, 50, 11, 31, true, '22222222-2222-2222-2222-222222222204'),
 ('500ml', 500, 80, 9, 32, true, '22222222-2222-2222-2222-222222222204'),
 ('1L', 1000, 150, 8, 33, true, '22222222-2222-2222-2222-222222222204'),
 ('2L', 2000, 300, 7, 34, true, '22222222-2222-2222-2222-222222222204'),
 ('5L', 5000, 700, 6, 35, true, '22222222-2222-2222-2222-222222222204'),
 ('Sipper Bottle 500ml', 500, 100, 10, 41, true, '22222222-2222-2222-2222-222222222205'),
 ('Fruit Mix Sipper Bottle 500ml', 500, 140, 10, 42, true, '22222222-2222-2222-2222-222222222205');