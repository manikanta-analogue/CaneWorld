ALTER TABLE public.loyalty_progress
ADD COLUMN IF NOT EXISTS loyalty_rule_locked boolean NOT NULL DEFAULT true;