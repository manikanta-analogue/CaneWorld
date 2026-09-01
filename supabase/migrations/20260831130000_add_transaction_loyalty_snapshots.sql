ALTER TABLE public.transaction_items
ADD COLUMN IF NOT EXISTS loyalty_target_at_purchase integer,
ADD COLUMN IF NOT EXISTS reward_quantity_at_purchase integer;