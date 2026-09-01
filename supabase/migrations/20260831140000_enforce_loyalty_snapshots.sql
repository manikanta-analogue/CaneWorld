-- Historical transaction rules are snapshots, never a view of mutable products.
ALTER TABLE public.transaction_items
  ADD CONSTRAINT transaction_items_loyalty_snapshot_pair_check
  CHECK (
    (loyalty_target_at_purchase IS NULL AND reward_quantity_at_purchase IS NULL)
    OR (
      loyalty_target_at_purchase > 1
      AND reward_quantity_at_purchase > 0
      AND reward_quantity_at_purchase < loyalty_target_at_purchase
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.prevent_transaction_item_loyalty_snapshot_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.loyalty_target_at_purchase IS DISTINCT FROM NEW.loyalty_target_at_purchase
     OR OLD.reward_quantity_at_purchase IS DISTINCT FROM NEW.reward_quantity_at_purchase THEN
    RAISE EXCEPTION 'Loyalty snapshots on completed transaction items are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_items_loyalty_snapshot_immutable ON public.transaction_items;
CREATE TRIGGER transaction_items_loyalty_snapshot_immutable
BEFORE UPDATE ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_item_loyalty_snapshot_change();
