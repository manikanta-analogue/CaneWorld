import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffAccess = {
  isSuperAdmin: boolean;
  branchId: string | null;
  branchName: string | null;
};

async function loadAccess(): Promise<StaffAccess> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { isSuperAdmin: false, branchId: null, branchName: null };

  const [roles, profile] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("branch_id").eq("id", user.id).maybeSingle(),
  ]);

  const isSuperAdmin = (roles.data ?? []).some((row) => row.role === "super_admin");
  const branchId = profile.data?.branch_id ?? null;

  let branchName: string | null = null;
  if (!isSuperAdmin && branchId) {
    const { data } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
    branchName = data?.name ?? null;
  }

  return { isSuperAdmin, branchId, branchName };
}

export function useStaffAccess() {
  const { data, isLoading } = useQuery({ queryKey: ["staff-access"], queryFn: loadAccess });
  return {
    access: data ?? { isSuperAdmin: false, branchId: null, branchName: null },
    loading: isLoading,
  };
}
