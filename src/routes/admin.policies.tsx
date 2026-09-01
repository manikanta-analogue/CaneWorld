import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/policies")({ component: PoliciesPage });

type Policy = { policy_type: "terms" | "privacy" | "cancellation" | "refund"; title: string; content: string };

const policyOrder: Policy["policy_type"][] = ["terms", "privacy", "cancellation", "refund"];

async function loadPolicies() {
  const { data, error } = await supabase
    .from("legal_policies")
    .select("policy_type, title, content")
    .order("policy_type");
  if (error) throw error;
  return (data ?? []) as Policy[];
}

function PoliciesPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["legal-policies"], queryFn: loadPolicies });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(data.map((policy) => [policy.policy_type, policy.content])));
  }, [data]);

  const save = useMutation({
    mutationFn: async (policy: Policy) => {
      const { error } = await supabase
        .from("legal_policies")
        .update({ content: drafts[policy.policy_type] ?? "", updated_at: new Date().toISOString() })
        .eq("policy_type", policy.policy_type);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Policy saved");
      queryClient.invalidateQueries({ queryKey: ["legal-policies"] });
      queryClient.invalidateQueries({ queryKey: ["public-policies"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const policies = policyOrder.map(
    (type) => data.find((policy) => policy.policy_type === type) ?? { policy_type: type, title: `${type} policy`, content: "" },
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Policies</h1>
        <p className="text-sm text-muted-foreground">Manage the legal information shown in every customer account.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading policies…</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {policies.map((policy) => (
          <Card key={policy.policy_type} className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-base">{policy.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor={`policy-${policy.policy_type}`}>Content</Label>
              <Textarea
                id={`policy-${policy.policy_type}`}
                value={drafts[policy.policy_type] ?? ""}
                onChange={(event) => setDrafts((current) => ({ ...current, [policy.policy_type]: event.target.value }))}
                placeholder={`Write the ${policy.title.toLowerCase()} here…`}
                className="min-h-48 resize-y"
              />
              <Button onClick={() => save.mutate(policy)} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save policy"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
