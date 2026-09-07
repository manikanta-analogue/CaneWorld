import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, KeyRound, Trash2, UserRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  removeProductImage,
  signProductImage,
  uploadProductImage,
} from "@/lib/product-images";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const schema = z.object({
  company_name: z.string().trim().min(2, "Company name is required").max(80),
  logo_url: z.string().trim().max(300),
  currency: z.string().trim().min(1).max(4),
  razorpay_key: z.string().trim().max(80),
  business_mobile: z.string().trim().max(15),
  home_banner_url: z.string().trim().max(300),
  banner_urls: z.array(z.string().trim().max(300)).default([]),
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: adminAccount } = useQuery({
    queryKey: ["main-admin-account"],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      return {
        name: profile?.full_name || user.user_metadata?.full_name || "Main Admin",
        email: profile?.email || user.email || "",
      };
    },
  });
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (row) return row;

      const { data: created, error: insertError } = await supabase
        .from("app_settings")
        .upsert(
          {
            id: 1,
            company_name: "CaneWorld",
            logo_url: "",
            currency: "₹",
            razorpay_key: "",
            business_mobile: "",
            home_banner_url: "",
            banner_urls: [],
          },
          { onConflict: "id" },
        )
        .select()
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
  const [form, setForm] = useState({
    company_name: "",
    logo_url: "",
    currency: "₹",
    razorpay_key: "",
    business_mobile: "",
    home_banner_url: "",
    banner_urls: [] as string[],
  });
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerPreviews, setBannerPreviews] = useState<string[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const bannerInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const syncBannerPreviews = async (paths: string[]) => {
    const signed = await Promise.all(
      paths.map(async (path) => (path ? signProductImage(path) : null)),
    );
    setBannerPreviews(signed.filter((url): url is string => Boolean(url)));
  };

  const syncLogoPreview = async (path?: string | null) => {
    if (!path) {
      setLogoPreview(null);
      return;
    }
    if (/^https?:\/\//i.test(path)) {
      setLogoPreview(path);
      return;
    }
    const signed = await signProductImage(path);
    setLogoPreview(signed ?? path);
  };

  useEffect(() => {
    if (data) {
      const storedBanners = Array.isArray(data.banner_urls)
        ? data.banner_urls.filter((value): value is string => typeof value === "string")
        : [];
      const nextBannerUrls = storedBanners.length > 0 ? storedBanners : data.home_banner_url ? [data.home_banner_url] : [];

      setForm({
        company_name: data.company_name,
        logo_url: data.logo_url,
        currency: data.currency,
        razorpay_key: data.razorpay_key,
        business_mobile: data.business_mobile,
        home_banner_url: data.home_banner_url ?? "",
        banner_urls: nextBannerUrls,
      });
      if (data.home_banner_url) {
        void signProductImage(data.home_banner_url).then(setBannerPreview);
      } else {
        setBannerPreview(null);
      }
      void syncLogoPreview(data.logo_url);
      void syncBannerPreviews(nextBannerUrls);
    }
  }, [data]);

  const pickBanner = async (files: FileList | File[] | null | undefined) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploadedPaths = await Promise.all(
        Array.from(files).map((file) => uploadProductImage(file, "banners")),
      );
      const nextBannerUrls = Array.from(new Set([...form.banner_urls, ...uploadedPaths]));
      setForm((current) => ({
        ...current,
        banner_urls: nextBannerUrls,
        home_banner_url: current.home_banner_url || uploadedPaths[0] || "",
      }));
      await syncBannerPreviews(nextBannerUrls);
      if (uploadedPaths.length > 0) {
        toast.success(
          uploadedPaths.length > 1
            ? `${uploadedPaths.length} banners uploaded — save settings to publish them`
            : "Banner ready — save settings to publish it",
        );
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (bannerInput.current) bannerInput.current.value = "";
    }
  };

  const removeBanner = async (path: string) => {
    const next = form.banner_urls.filter((item) => item !== path);
    const fallback = next[0] ?? "";
    setForm((current) => ({
      ...current,
      banner_urls: next,
      home_banner_url: current.home_banner_url === path ? fallback : current.home_banner_url,
    }));
    await syncBannerPreviews(next);
    if (path.trim()) {
      try {
        await removeProductImage(path);
      } catch {
        // ignore storage cleanup failures for already-deleted files
      }
    }
  };

  const persistSettings = async (nextForm: typeof form) => {
    const parsed = schema.parse(nextForm);
    const { data: savedRow, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          ...parsed,
          banner_urls: parsed.banner_urls,
          home_banner_url: parsed.home_banner_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw error;
    queryClient.setQueryData(["admin-settings"], savedRow);
    queryClient.setQueryData(["admin-brand"], {
      company_name: savedRow?.company_name ?? nextForm.company_name,
      logo_url: savedRow?.logo_url ?? nextForm.logo_url,
    });
    return savedRow;
  };

  const pickLogo = async (file: File | null | undefined) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const path = await uploadProductImage(file, "branding");
      const updated = { ...form, logo_url: path };
      setForm(updated);
      await syncLogoPreview(path);
      await persistSettings(updated);
      toast.success("Logo uploaded and saved");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLogoUploading(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  };

  const removeLogo = async () => {
    if (!form.logo_url) return;
    const updated = { ...form, logo_url: "" };
    setForm(updated);
    setLogoPreview(null);
    try {
      await removeProductImage(form.logo_url);
      await persistSettings(updated);
    } catch {
      // ignore cleanup failures
    }
  };

  const save = useMutation({
    mutationFn: async () => persistSettings(form),
    onSuccess: (savedRow) => {
      toast.success("Settings saved");
      queryClient.setQueryData(["admin-settings"], savedRow);
      queryClient.setQueryData(["admin-brand"], {
        company_name: savedRow?.company_name ?? form.company_name,
        logo_url: savedRow?.logo_url ?? form.logo_url,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-brand"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Please check the form")
          : (error as Error).message,
      ),
  });

  const fields: { key: keyof typeof form; label: string; placeholder?: string }[] = [
    { key: "company_name", label: "Company name" },
    { key: "currency", label: "Currency symbol" },
    { key: "razorpay_key", label: "Dummy Razorpay key" },
    { key: "business_mobile", label: "Business mobile" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Branding, contact details and home page media</p>
        </div>
        <Button className="h-11" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" /> Main admin account
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="main-admin-name">Name</Label>
              <Input
                id="main-admin-name"
                value={adminAccount?.name ?? "Loading…"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="main-admin-email">Login email</Label>
              <Input
                id="main-admin-email"
                type="email"
                value={adminAccount?.email ?? "Loading…"}
                disabled
              />
            </div>
            <Button asChild variant="outline" className="h-10">
              <Link to="/admin/change-password">
                <KeyRound className="mr-1 h-4 w-4" /> Change password
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Brand identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brand logo</Label>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company logo preview" className="h-20 w-20 rounded-xl border border-border bg-background object-cover" />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-border bg-background text-xs font-bold text-muted-foreground">Logo</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => pickLogo(e.target.files?.[0])}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={logoUploading} onClick={() => logoInput.current?.click()}>
                    <ImagePlus className="mr-1 h-4 w-4" />
                    {logoUploading ? "Uploading…" : form.logo_url ? "Change logo" : "Upload logo"}
                  </Button>
                  {form.logo_url ? (
                    <Button type="button" size="sm" variant="ghost" onClick={removeLogo}>
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    value={form[field.key]}
                    placeholder={field.placeholder}
                    maxLength={300}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Home page banners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {bannerPreviews.length > 0 ? (
                bannerPreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="overflow-hidden rounded-2xl border border-border bg-muted">
                    <img src={preview} alt={`Banner ${index + 1}`} className="h-28 w-full object-cover" />
                    <div className="flex justify-end p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeBanner(form.banner_urls[index])}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex h-32 items-center justify-center rounded-2xl bg-muted text-xs text-muted-foreground">
                  No banners uploaded yet
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={bannerInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => pickBanner(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => bannerInput.current?.click()}
              >
                <ImagePlus className="mr-1 h-4 w-4" />
                {uploading ? "Uploading…" : bannerPreviews.length > 0 ? "Add more banners" : "Upload banners"}
              </Button>
              {bannerPreview ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setForm({ ...form, home_banner_url: "" });
                    setBannerPreview(null);
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove main banner
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Upload one or more wide banners for the public home screen · JPG, PNG or WEBP · up to 5MB each
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
