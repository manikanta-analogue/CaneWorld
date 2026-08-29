import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Branch } from "@/lib/loyalty";
import { BranchQr } from "@/components/BranchQr";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/qr")({
  component: QrPage,
});

async function fetchBranches() {
  const { data, error } = await supabase.from("branches").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Branch[];
}

function QrPage() {
  const { data: branches = [] } = useQuery({ queryKey: ["branches", "qr"], queryFn: fetchBranches });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">QR management</h1>
        <p className="text-sm text-muted-foreground">
          One QR per branch. Customers scan it to open the branch portal.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => (
          <Card key={branch.id} className="rounded-2xl shadow-card">
            <CardContent className="space-y-3 p-5 text-center">
              <p className="truncate font-bold">{branch.name}</p>
              <BranchQr token={branch.qr_token} branchName={branch.name} size={180} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
