import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
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
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return row;
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
  const [uploading, setUploading] = useState(false);
  const bannerInput = useRef<HTMLInputElement>(null);

  const syncBannerPreviews = async (paths: string[]) => {
    const signed = await Promise.all(
      paths.map(async (path) => (path ? signProductImage(path) : null)),
    );
    setBannerPreviews(signed.filter((url): url is string => Boolean(url)));
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
      setForm((current) => ({ ...current, banner_urls: nextBannerUrls }));
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
    setForm((current) => ({ ...current, banner_urls: next }));
    await syncBannerPreviews(next);
    if (path.trim()) {
      try {
        await removeProductImage(path);
      } catch {
        // ignore storage cleanup failures for already-deleted files
      }
    }
  };


  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const { error } = await supabase
        .from("app_settings")
        .update({
          ...parsed,
          banner_urls: parsed.banner_urls,
          home_banner_url: parsed.home_banner_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
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
    { key: "logo_url", label: "Logo URL", placeholder: "https://…" },
    { key: "currency", label: "Currency symbol" },
    { key: "razorpay_key", label: "Dummy Razorpay key" },
    { key: "business_mobile", label: "Business mobile" },
  ];

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Company details used across both portals</p>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="Company logo preview"
              className="h-16 w-16 rounded-xl border border-border object-contain"
            />
          )}

          <div className="space-y-2 rounded-2xl border border-border p-3">
            <Label>Home page banners</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {bannerPreviews.length > 0 ? (
                bannerPreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="overflow-hidden rounded-xl border border-border bg-muted">
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
                <div className="col-span-full flex h-32 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
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
                  <Trash2 className="mr-1 h-4 w-4" /> Remove primary banner
                </Button>
              ) : null}
              <p className="w-full text-xs text-muted-foreground">
                Upload one or more wide banners for the public home screen · JPG, PNG or WEBP · max 5MB
              </p>
            </div>
          </div>

          <Button className="h-12 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
