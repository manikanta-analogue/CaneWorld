ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS banner_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
