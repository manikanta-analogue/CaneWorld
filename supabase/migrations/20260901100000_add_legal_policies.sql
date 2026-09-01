CREATE TABLE public.legal_policies (
  policy_type text PRIMARY KEY CHECK (policy_type IN ('terms', 'privacy', 'cancellation', 'refund')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.legal_policies (policy_type, title, content)
VALUES
  ('terms', 'Terms & Conditions', ''),
  ('privacy', 'Privacy Policy', ''),
  ('cancellation', 'Cancellation Policy', ''),
  ('refund', 'Refund Policy', '')
ON CONFLICT (policy_type) DO NOTHING;

ALTER TABLE public.legal_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_policies TO authenticated;
GRANT ALL ON public.legal_policies TO service_role;

CREATE POLICY "Super admin manages legal policies"
ON public.legal_policies FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
