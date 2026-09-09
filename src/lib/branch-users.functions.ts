import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  branchId: z.string().uuid(),
  email: z.string().trim().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  fullName: z.string().trim().max(80).optional(),
});

const resetSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const adminCreateSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  fullName: z.string().trim().max(80).optional(),
});

/** Creates a confirmed super admin account directly via service role. */
export const createSuperAdminUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName?.trim() || "Super Admin",
      },
    });

    if (error) throw new Error(error.message);

    const userId = created.user?.id;
    if (!userId) throw new Error("Admin user creation succeeded but no user id was returned.");

    const profileName = data.fullName?.trim() || "Super Admin";
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, email: data.email, full_name: profileName, branch_id: null },
        { onConflict: "id" },
      );

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    return { id: userId, email: data.email, fullName: profileName, role: "super_admin" };
  });

/** Lists the branch logins for every branch (super admin only). */
export const listBranchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, branch_id")
      .not("branch_id", "is", null);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      branchId: row.branch_id as string,
    }));
  });

/** Creates a fixed branch login and assigns it to the branch (super admin only). */
export const createBranchUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id, name")
      .eq("id", data.branchId)
      .maybeSingle();
    if (branchError) throw branchError;
    if (!branch) throw new Error("Branch not found");

    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName?.trim() || `${branch.name} login`;

    // Deleting a branch intentionally keeps its auth user, while the profile's
    // branch_id becomes null. Reattach that orphaned login instead of failing
    // with Supabase's "already registered" error.
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, branch_id")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (existingProfile) {
      if (existingProfile.branch_id && existingProfile.branch_id !== data.branchId) {
        throw new Error("This email is already assigned to another branch");
      }

      const { data: roles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingProfile.id);
      if (rolesError) throw rolesError;
      if (roles?.some((item) => item.role === "super_admin")) {
        throw new Error("This email belongs to a super admin and cannot be used as a branch login");
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingProfile.id,
        {
          password: data.password,
          email_confirm: true,
          user_metadata: { branch_id: data.branchId, full_name: fullName },
        },
      );
      if (authUpdateError) throw new Error(authUpdateError.message);

      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ branch_id: data.branchId, email, full_name: fullName })
        .eq("id", existingProfile.id);
      if (profileUpdateError) throw profileUpdateError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: existingProfile.id, role: "branch_user" },
          { onConflict: "user_id,role" },
        );
      if (roleError) throw roleError;

      return { id: existingProfile.id, email, branchId: data.branchId };
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        branch_id: data.branchId,
        full_name: fullName,
      },
    });
    if (error) throw new Error(error.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Could not create the branch login");

    // Trigger creates the profile + branch_user role; make sure the branch sticks.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ branch_id: data.branchId, email, full_name: fullName })
      .eq("id", userId);
    if (profileError) throw profileError;

    return { id: userId, email, branchId: data.branchId };
  });

/** Sets a new password for an existing branch login (super admin only). */
export const resetBranchUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, branch_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.branch_id) throw new Error("This account is not a branch login");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
