import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, ImagePlus, KeyRound, Pencil, Plus, RefreshCw, Store, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  createBranchUser,
  listBranchUsers,
  resetBranchUserPassword,
} from "@/lib/branch-users.functions";
import type { Branch } from "@/lib/loyalty";
import {
  removeProductImage,
  signProductImage,
  signProductImages,
  uploadProductImage,
} from "@/lib/product-images";
import { BranchQr } from "@/components/BranchQr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/branches")({
  component: BranchesPage,
});

const branchSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required").max(80),
  owner_name: z.string().trim().min(2, "Owner name is required").max(80),
  mobile: z.string().trim().regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile"),
  address: z.string().trim().min(4, "Address is required").max(200),
  map_location: z
    .string()
    .trim()
    .min(3, "Add a Google Maps link or coordinates for directions")
    .max(500),
  status: z.enum(["active", "disabled"]),
  image_url: z.string().trim().max(300),
});

async function fetchBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Branch[];
}

const emptyForm = {
  name: "",
  owner_name: "",
  mobile: "",
  address: "",
  map_location: "",
  status: "active" as "active" | "disabled",
  image_url: "",
};

function BranchesPage() {
  const queryClient = useQueryClient();
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formPreview, setFormPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: images = {} } = useQuery({
    queryKey: ["branch-images", branches.map((b) => b.image_url).join(",")],
    queryFn: () => signProductImages(branches.map((b) => b.image_url ?? "")),
    enabled: branches.length > 0,
  });

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadProductImage(file, "branches");
      const previous = form.image_url;
      setForm((current) => ({ ...current, image_url: path }));
      setFormPreview(await signProductImage(path));
      if (previous && previous !== editing?.image_url) await removeProductImage(previous);
      toast.success("Image ready — save the branch to apply");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };


  const [newLogin, setNewLogin] = useState({ email: "", password: "" });
  const [showNewLoginPassword, setShowNewLoginPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = branchSchema.parse(form);
      if (editing) {
        const { error } = await supabase.from("branches").update(parsed).eq("id", editing.id);
        if (error) throw error;
        if (editing.image_url && editing.image_url !== parsed.image_url) {
          await removeProductImage(editing.image_url);
        }
        return;
      }
      const email = newLogin.email.trim().toLowerCase();
      const password = newLogin.password;
      if (email || password) {
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid branch login email");
        if (password.length < 8) throw new Error("Branch password must be at least 8 characters");
      }
      const { data: created, error } = await supabase
        .from("branches")
        .insert(parsed)
        .select("id")
        .single();
      if (error) throw error;
      if (email && password) {
        await createBranchUser({
          data: {
            branchId: created.id,
            email,
            password,
            fullName: `${parsed.name} login`,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Branch updated" : "Branch created with its own QR code");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["branch-images"] });
      queryClient.invalidateQueries({ queryKey: ["branch-users"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormPreview(null);
      setNewLogin({ email: "", password: "" });
    },

    onError: (error) =>
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Please check the form")
          : (error as Error).message,
      ),
  });




  const toggleStatus = useMutation({
    mutationFn: async (branch: Branch) => {
      const { error } = await supabase
        .from("branches")
        .update({ status: branch.status === "active" ? "disabled" : "active" })
        .eq("id", branch.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  const regenerate = useMutation({
    mutationFn: async (branch: Branch) => {
      const token =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "")
          : `${Date.now()}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      const { error } = await supabase.from("branches").update({ qr_token: token }).eq("id", branch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("QR regenerated. Old printed QR is now invalid.");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const startEdit = async (branch: Branch) => {
    setEditing(branch);
    setForm({
      name: branch.name,
      owner_name: branch.owner_name,
      mobile: branch.mobile,
      address: branch.address,
      map_location: branch.map_location ?? "",
      status: branch.status,
      image_url: branch.image_url ?? "",
    });
    setFormPreview(branch.image_url ? await signProductImage(branch.image_url) : null);
    setOpen(true);
  };

  const { data: branchUsers = [] } = useQuery({
    queryKey: ["branch-users"],
    queryFn: () => listBranchUsers(),
  });
  const [loginBranch, setLoginBranch] = useState<Branch | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const existingLogin = loginBranch
    ? (branchUsers.find((u) => u.branchId === loginBranch.id) ?? null)
    : null;

  const saveLogin = useMutation({
    mutationFn: async () => {
      if (!loginBranch) return;
      const password = loginForm.password;
      if (password.length < 8) throw new Error("Password must be at least 8 characters");
      if (existingLogin) {
        await resetBranchUserPassword({ data: { userId: existingLogin.id, password } });
        return "reset" as const;
      }
      const email = loginForm.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
      await createBranchUser({
        data: { branchId: loginBranch.id, email, password, fullName: `${loginBranch.name} login` },
      });
      return "created" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "reset" ? "Password updated" : "Branch login created");
      queryClient.invalidateQueries({ queryKey: ["branch-users"] });
      setLoginBranch(null);
      setLoginForm({ email: "", password: "" });
    },
    onError: (error) => toast.error((error as Error).message),
  });



  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">Branches</h1>
          <p className="text-sm text-muted-foreground">Every branch gets one unique QR code</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setEditing(null);
              setForm(emptyForm);
              setFormPreview(null);
              setNewLogin({ email: "", password: "" });
            }

          }}

        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New branch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit branch" : "Create branch"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Branch image</Label>
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border p-3">
                  <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {formPreview ? (
                      <img src={formPreview} alt="Branch" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      <ImagePlus className="mr-1 h-4 w-4" />
                      {uploading ? "Uploading…" : formPreview ? "Replace" : "Upload"}
                    </Button>
                    {formPreview ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setForm({ ...form, image_url: "" });
                          setFormPreview(null);
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    ) : null}
                    <p className="w-full text-xs text-muted-foreground">
                      Recommended 800×800 (square) · JPG, PNG or WEBP · max 5MB
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-name">Branch name</Label>

                <Input
                  id="b-name"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-owner">Owner name</Label>
                <Input
                  id="b-owner"
                  value={form.owner_name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-mobile">Mobile number</Label>
                <Input
                  id="b-mobile"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-address">Address</Label>
                <Textarea
                  id="b-address"
                  value={form.address}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-map">Branch location (Google Maps link or lat,lng)</Label>
                <Input
                  id="b-map"
                  placeholder="https://maps.app.goo.gl/… or 12.9716,77.5946"
                  value={form.map_location}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, map_location: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Customers use this for the directions button on the branch list.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <Label htmlFor="b-status">Active</Label>
                <Switch
                  id="b-status"
                  checked={form.status === "active"}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, status: checked ? "active" : "disabled" })
                  }
                />
              </div>
              {!editing ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">Branch login access</p>
                    <p className="text-xs text-muted-foreground">
                      Staff sign in at /auth and see only this branch&apos;s data. You can add this
                      later from the branch card.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-login-email">Login email</Label>
                    <Input
                      id="b-login-email"
                      type="email"
                      autoComplete="off"
                      placeholder="mgroad@caneworld.in"
                      value={newLogin.email}
                      onChange={(e) => setNewLogin({ ...newLogin, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="b-login-password"
                        type={showNewLoginPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={newLogin.password}
                        onChange={(e) => setNewLogin({ ...newLogin, password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={showNewLoginPassword ? "Hide branch login password" : "Show branch login password"}
                        onClick={() => setShowNewLoginPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <Button className="h-12 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save branch"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => (
          <Card key={branch.id} className="rounded-2xl shadow-card">
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {images[branch.image_url ?? ""] ? (
                    <img
                      src={images[branch.image_url]!}
                      alt={branch.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{branch.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {branch.owner_name} · {branch.mobile}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{branch.address}</p>
                </div>
                <Badge variant={branch.status === "active" ? "default" : "secondary"}>
                  {branch.status}
                </Badge>
              </div>


              <BranchQr token={branch.qr_token} branchName={branch.name} size={160} />

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Branch login
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  {branchUsers.find((u) => u.branchId === branch.id)?.email ?? "Not created yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Staff sign in at /auth with this email and password.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setLoginBranch(branch);
                    setLoginForm({ email: "", password: "" });
                  }}
                >
                  <KeyRound className="mr-1 h-4 w-4" />
                  {branchUsers.some((u) => u.branchId === branch.id)
                    ? "Change password"
                    : "Create login"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(branch)}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => regenerate.mutate(branch)}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Regenerate QR
                </Button>
                <Button
                  size="sm"
                  variant={branch.status === "active" ? "secondary" : "default"}
                  onClick={() => toggleStatus.mutate(branch)}
                >
                  {branch.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={loginBranch !== null}
        onOpenChange={(next) => {
          if (!next) {
            setLoginBranch(null);
            setLoginForm({ email: "", password: "" });
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {existingLogin ? "Change branch password" : "Create branch login"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {loginBranch?.name} · staff signs in at <span className="font-semibold">/auth</span>{" "}
              and sees only this branch&apos;s data.
            </p>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="off"
                disabled={Boolean(existingLogin)}
                value={existingLogin?.email ?? loginForm.email}
                placeholder="mgroad@caneworld.in"
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={loginForm.password}
                  placeholder="At least 8 characters"
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showLoginPassword ? "Hide branch password" : "Show branch password"}
                  onClick={() => setShowLoginPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              className="h-12 w-full"
              onClick={() => saveLogin.mutate()}
              disabled={saveLogin.isPending}
            >
              {saveLogin.isPending
                ? "Saving…"
                : existingLogin
                  ? "Update password"
                  : "Create login"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
