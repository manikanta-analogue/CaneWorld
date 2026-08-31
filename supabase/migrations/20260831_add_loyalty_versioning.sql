-- Add loyalty rule tracking columns to loyalty_progress
-- This ensures existing customers keep their original rule when rules change

ALTER TABLE public.loyalty_progress
ADD COLUMN IF NOT EXISTS loyalty_target_at_creation integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS reward_quantity_at_creation integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_loyalty_progress_customer_created ON public.loyalty_progress(customer_id, created_at);
