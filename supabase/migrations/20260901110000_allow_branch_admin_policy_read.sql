-- Policies are global customer information. Branch admins can read them but
-- only super admins can edit them (the existing ALL policy remains restrictive).
CREATE POLICY "Branch admin reads legal policies"
ON public.legal_policies
FOR SELECT TO authenticated
USING (true);
