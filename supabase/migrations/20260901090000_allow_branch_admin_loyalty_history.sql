-- Branch staff may read the loyalty progress of customers who have purchased
-- at their own branch. They still cannot create or modify loyalty progress.
CREATE POLICY "Branch admin reads loyalty for own customers"
ON public.loyalty_progress
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.transactions AS transaction
    WHERE transaction.customer_id = loyalty_progress.customer_id
      AND transaction.branch_id = public.current_branch_id()
  )
);
