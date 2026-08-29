import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, MapPin, Phone, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { BranchQr } from "@/components/BranchQr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/branch-settings")({
  component: BranchSettingsPage,
});

type BranchInfo = {
  id: string;
  name: string;
  owner_name: string;
  mobile: string;
  address: string;
  qr_token: string;
};

function BranchSettingsPage() {
  const navigate = useNavigate();
  const { access } = useStaffAccess();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Redirect super admin users to regular settings
  if (access.isSuperAdmin) {
    navigate({ to: "/admin/settings", replace: true });
    return null;
  }

  const { data: branchInfo } = useQuery({
    queryKey: ["branch-info", access.branchId],
    queryFn: async () => {
      if (!access.branchId) return null;
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, owner_name, mobile, address, qr_token")
        .eq("id", access.branchId)
        .maybeSingle();
      if (error) throw error;
      return data as BranchInfo | null;
    },
    enabled: !!access.branchId,
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword || !confirmPassword) {
        throw new Error("Please fill in the new password and confirm it.");
      }
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters long.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirm password do not match.");
      }

      if (currentPassword.trim()) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: (await supabase.auth.getUser()).data.user?.email ?? "",
          password: currentPassword,
        });
        if (signInError) throw new Error("Current password is incorrect.");
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    },
  });

  if (!branchInfo) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Loading branch settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Branch Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your branch details, QR code, and account.</p>
      </div>

      {/* Branch Details Card */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4" /> Branch Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input id="branch-name" value={branchInfo.name} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-name">Owner name</Label>
              <Input id="owner-name" value={branchInfo.owner_name} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-mobile" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Mobile
              </Label>
              <Input id="branch-mobile" value={branchInfo.mobile} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Address
              </Label>
              <Input id="branch-address" value={branchInfo.address} disabled className="bg-muted" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            To edit branch details, contact your super admin.
          </p>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Branch QR Code</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <BranchQr token={branchInfo.qr_token} branchName={branchInfo.name} size={220} />
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrent((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNew((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending}
            className="w-full"
          >
            {passwordMutation.isPending ? "Updating…" : "Update password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
