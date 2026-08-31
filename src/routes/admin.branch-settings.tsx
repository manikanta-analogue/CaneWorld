import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Branch } from "@/lib/loyalty";
import { signProductImage } from "@/lib/product-images";
import { BranchQr } from "@/components/BranchQr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/branch-settings")({
  component: BranchSettingsPage,
});

async function fetchBranchById(branchId: string) {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .single();
  if (error) throw error;
  return data as unknown as Branch;
}

async function fetchBranchUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, branch_id")
    .not("branch_id", "is", null)
    .order("email", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    branchId: row.branch_id as string,
  }));
}

function BranchSettingsPage() {
  const { access } = useStaffAccess();
  const isBranchUser = !access.isSuperAdmin && Boolean(access.branchId);

  const { data: branch } = useQuery({
    queryKey: ["branch-settings", access.branchId],
    queryFn: () => {
      if (!access.branchId) throw new Error("Branch ID not found");
      return fetchBranchById(access.branchId);
    },
    enabled: Boolean(access.branchId),
  });

  const { data: branchUsers = [] } = useQuery({
    queryKey: ["branch-users"],
    queryFn: fetchBranchUsers,
  });

  const { data: branchImage } = useQuery({
    queryKey: ["branch-settings-image", branch?.image_url],
    queryFn: async () => {
      if (!branch?.image_url) return null;
      return await signProductImage(branch.image_url);
    },
    enabled: Boolean(branch?.image_url),
  });

  if (!branch) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading branch details…
      </div>
    );
  }

  const branchLogin = branchUsers.find((u) => u.branchId === branch.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Branch settings</h1>
        <p className="text-sm text-muted-foreground">
          View your branch details, QR code, and login information.
        </p>
      </div>

      {/* Branch Details Card */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-muted shrink-0">
              {branchImage ? (
                <img
                  src={branchImage}
                  alt={branch.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{branch.name}</h2>
                <Badge variant={branch.status === "active" ? "default" : "secondary"}>
                  {branch.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{branch.owner_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{branch.mobile}</p>
              {branchLogin?.email ? (
                <p className="mt-1 text-sm text-muted-foreground">Login email: {branchLogin.email}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Login email: Not created yet</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Address
                </p>
                <p className="mt-1 text-sm">{branch.address}</p>
              </div>
              {branch.map_location && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Location
                  </p>
                  <p className="mt-1 text-sm text-blue-600 dark:text-blue-400 break-all">
                    {branch.map_location}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branch QR Code Card */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-sm font-semibold">Branch QR code</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this QR code with customers to access your branch ordering portal.
            </p>
          </div>
          <div className="flex justify-center">
            <BranchQr token={branch.qr_token} branchName={branch.name} size={200} />
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
