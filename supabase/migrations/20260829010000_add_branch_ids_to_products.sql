ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
