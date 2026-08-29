import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_IMAGE_BUCKET = "product-images";
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function createSafeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/** Uploads a product/variant image and returns the storage path stored on the row. */
export async function uploadProductImage(file: File, prefix = "products") {
  if (!ALLOWED.includes(file.type)) throw new Error("Use a JPG, PNG or WEBP image");
  if (file.size > MAX_BYTES) throw new Error("Image must be smaller than 5MB");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${prefix}/${createSafeId()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeProductImage(path: string) {
  if (!path) return;
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

/** Temporary readable link for admin previews (bucket is private). */
export async function signProductImage(path: string) {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function signProductImages(paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (path) => [path, await signProductImage(path)] as const),
  );
  return Object.fromEntries(entries) as Record<string, string | null>;
}
