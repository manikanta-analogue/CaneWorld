import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeProductImage, uploadProductImage } from "@/lib/product-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MenuCategory = { id: string; name: string; is_active: boolean; sort_order: number };

export type MenuProduct = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  volume_ml: number;
  price: number;
  loyalty_target: number;
  loyalty_enabled: boolean;
  reward_quantity: number;
  sort_order: number;
  is_active: boolean;
  category_id: string | null;
  branch_ids: string[] | null;
};

type Draft = {
  name: string;
  description: string;
  volume_ml: string;
  price: string;
  loyalty_enabled: boolean;
  loyalty_target: string;
  reward_quantity: string;
  sort_order: string;
  is_active: boolean;
  category_id: string;
  branch_ids: string[];
};

const blankDraft = (categoryId: string, sortOrder: number): Draft => ({
  name: "",
  description: "",
  volume_ml: "",
  price: "",
  loyalty_enabled: true,
  loyalty_target: "10",
  reward_quantity: "1",
  sort_order: String(sortOrder),
  is_active: true,
  category_id: categoryId,
  branch_ids: [],
});

const toDraft = (v: MenuProduct): Draft => ({
  name: v.name,
  description: v.description ?? "",
  volume_ml: String(v.volume_ml ?? 0),
  price: String(v.price),
  loyalty_enabled: v.loyalty_enabled,
  loyalty_target: String(v.loyalty_target),
  reward_quantity: String(v.reward_quantity ?? 1),
  sort_order: String(v.sort_order ?? 0),
  is_active: v.is_active,
  category_id: v.category_id ?? "",
  branch_ids: Array.isArray(v.branch_ids) ? v.branch_ids : [],
});

/** Shared validation for both create and edit paths. */
function validate(draft: Draft) {
  const price = Number(draft.price);
  const volume = Number(draft.volume_ml || 0);
  const target = Number(draft.loyalty_target || 0);
  const reward = Number(draft.reward_quantity || 1);
  const order = Number(draft.sort_order || 0);
  if (draft.name.trim().length < 1) throw new Error("Enter a size / variant name");
  if (!draft.category_id) throw new Error("Pick a category");
  if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error("Enter a valid price");
  if (!Number.isFinite(volume) || volume < 0 || volume > 20000)
    throw new Error("Enter a valid volume in ml");
  if (draft.loyalty_enabled) {
    if (!Number.isInteger(target) || target < 2 || target > 100)
      throw new Error("Loyalty target must be between 2 and 100");
    if (!Number.isInteger(reward) || reward < 1 || reward >= target)
      throw new Error("Free quantity must be at least 1 and less than the target");
  }
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    volume_ml: Math.round(volume),
    price,
    loyalty_enabled: draft.loyalty_enabled,
    loyalty_target: draft.loyalty_enabled ? target : Math.max(2, target || 10),
    reward_quantity: draft.loyalty_enabled ? reward : 1,
    sort_order: Number.isFinite(order) ? Math.round(order) : 0,
    is_active: draft.is_active,
    category_id: draft.category_id,
    branch_ids: draft.branch_ids,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MenuCategory[];
  /** Existing juice to edit, or null to create a new one. */
  product: MenuProduct | null;
  /** Pre-selected category when creating. */
  defaultCategoryId?: string;
  /** Suggested display order when creating. */
  nextSortOrder?: number;
  signedImage?: string | null;
};

export function ProductDialog({
  open,
  onOpenChange,
  categories,
  product,
  defaultCategoryId = "",
  nextSortOrder = 0,
  signedImage = null,
}: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(blankDraft(defaultCategoryId, nextSortOrder));
  const [allBranchesMode, setAllBranchesMode] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextDraft = product ? toDraft(product) : blankDraft(defaultCategoryId, nextSortOrder);
    setDraft(nextDraft);
    setAllBranchesMode(!product || !Array.isArray(product.branch_ids) || product.branch_ids.length === 0);
    setPendingFile(null);
    setPendingPreview(null);
  }, [open, product, defaultCategoryId, nextSortOrder]);

  const pickPendingFile = (file: File) => {
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["menu"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, status")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; status: "active" | "disabled" }[];
    },
    enabled: open,
  });

  const toggleBranch = (branchId: string) => {
    setAllBranchesMode(false);
    setDraft((current) => {
      const next = current.branch_ids.includes(branchId)
        ? current.branch_ids.filter((id) => id !== branchId)
        : [...current.branch_ids, branchId];
      return { ...current, branch_ids: next };
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = validate(draft);
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        if (pendingFile && data?.id) {
          const path = await uploadProductImage(pendingFile);
          const { error: imgError } = await supabase
            .from("products")
            .update({ image_url: path })
            .eq("id", data.id);
          if (imgError) throw imgError;
        }
      }
    },
    onSuccess: () => {
      toast.success(product ? "Juice saved" : "Juice added to the menu");
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setImage = useMutation({
    mutationFn: async (file: File) => {
      if (!product) throw new Error("Save the juice first, then add an image");
      const path = await uploadProductImage(file);
      const { error } = await supabase
        .from("products")
        .update({ image_url: path })
        .eq("id", product.id);
      if (error) throw error;
      if (product.image_url) await removeProductImage(product.image_url);
    },
    onSuccess: () => {
      toast.success("Image updated");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const clearImage = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const { error } = await supabase
        .from("products")
        .update({ image_url: "" })
        .eq("id", product.id);
      if (error) throw error;
      await removeProductImage(product.image_url);
    },
    onSuccess: () => {
      toast.success("Image removed");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const buyCount =
    Math.max(0, Number(draft.loyalty_target || 0) - Number(draft.reward_quantity || 1)) || 0;
  const allBranchesSelected = allBranchesMode && branches.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add juice"}</DialogTitle>
          <DialogDescription>
            Price, image, loyalty plan and availability — all in one place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (product) setImage.mutate(file);
              else pickPendingFile(file);
            }}
          />
          {product ? (
            <div className="flex items-center gap-3">
              {signedImage ? (
                <img
                  src={signedImage}
                  alt={product.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                  disabled={setImage.isPending}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {product.image_url ? "Replace" : "Upload"} image
                </Button>
                {product.image_url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearImage.mutate()}
                    disabled={clearImage.isPending}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                ) : null}
                <p className="w-full text-xs text-muted-foreground">
                  Recommended 800×800 (square) · JPG, PNG or WEBP · max 5MB
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {pendingPreview ? (
                <img
                  src={pendingPreview}
                  alt="New juice"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {pendingFile ? "Replace" : "Upload"} image
                </Button>
                {pendingFile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingFile(null);
                      setPendingPreview(null);
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
          )}

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={draft.category_id} onValueChange={(value) => patch({ category_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pd-name">Name</Label>
              <Input
                id="pd-name"
                placeholder="Juice Name"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pd-volume">Volume (ml)</Label>
              <Input
                id="pd-volume"
                inputMode="numeric"
                placeholder="500"
                value={draft.volume_ml}
                onChange={(e) => patch({ volume_ml: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pd-price">Price</Label>
              <Input
                id="pd-price"
                inputMode="decimal"
                placeholder="80"
                value={draft.price}
                onChange={(e) => patch({ price: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pd-desc">Description</Label>
            <Input
              id="pd-desc"
              placeholder="Optional"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <span className="text-sm font-medium">Loyalty</span>
            <Switch
              checked={draft.loyalty_enabled}
              onCheckedChange={(value) => patch({ loyalty_enabled: value })}
              aria-label="Loyalty enabled"
            />
          </div>

          {draft.loyalty_enabled ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pd-target">Required purchases</Label>
                  <Input
                    id="pd-target"
                    inputMode="numeric"
                    value={draft.loyalty_target}
                    onChange={(e) => patch({ loyalty_target: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pd-reward">Free quantity</Label>
                  <Input
                    id="pd-reward"
                    inputMode="numeric"
                    value={draft.reward_quantity}
                    onChange={(e) => patch({ reward_quantity: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              </div>
              {/* <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                Buy {buyCount || "?"} · get {draft.reward_quantity || 1} free
              </p> */}
            </>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Loyalty is off for this juice.
            </p>
          )}

          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Branch availability</p>
                <p className="text-xs text-muted-foreground">
                  {allBranchesSelected
                    ? "Available to all branches"
                    : `${draft.branch_ids.length} branch${draft.branch_ids.length > 1 ? "es" : ""} selected`}
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">Available to all branches</p>
              </div>
              <input
                type="checkbox"
                checked={allBranchesMode}
                onChange={() => {
                  setAllBranchesMode((current) => {
                    const next = !current;
                    if (next) {
                      setDraft((currentDraft) => ({ ...currentDraft, branch_ids: [] }));
                    }
                    return next;
                  });
                }}
                className="h-4 w-4 accent-primary"
              />
            </label>

            {!allBranchesSelected && (
              <div className="space-y-2">
                {branches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No branches available yet.</p>
                ) : (
                  branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{branch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {branch.status === "active" ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.branch_ids.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <span className="text-sm font-medium">
              {draft.is_active ? "Visible on the menu" : "Hidden from the menu"}
            </span>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(value) => patch({ is_active: value })}
              aria-label="Availability"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {product ? "Save changes" : "Add juice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
