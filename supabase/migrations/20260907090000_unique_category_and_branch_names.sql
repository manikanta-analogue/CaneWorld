-- Names are unique after trimming and ignoring letter case. The UI performs
-- the same check, while these indexes protect against concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_normalized_unique
  ON public.categories (lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS branches_name_normalized_unique
  ON public.branches (lower(btrim(name)));
