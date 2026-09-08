import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Eye, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { formatMoney } from "@/lib/loyalty";
import { signProductImages } from "@/lib/product-images";
import {
  ProductDialog,
  type MenuCategory,
  type MenuProduct,
} from "@/components/admin/ProductDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({
    meta: [
      { title: "Menu — CaneWorld" },
      {
        name: "description",
        content:
          "One screen for categories and juices: prices, images, loyalty plans, display order and availability.",
      },
      { property: "og:title", content: "Menu — CaneWorld" },
      {
        property: "og:description",
        content: "Manage categories and every juice size from a single admin screen.",
      },
    ],
  }),
  component: MenuPage,
});

async function loadCatalogue() {
  const [categories, products] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, sort_order").order("sort_order"),
    supabase
      .from("products")
      .select(
        "id, name, description, image_url, volume_ml, price, loyalty_target, loyalty_enabled, reward_quantity, sort_order, is_active, category_id, branch_ids",
      )
      .order("sort_order"),
  ]);
  if (categories.error) throw categories.error;
  if (products.error) throw products.error;
  const items = (products.data ?? []) as unknown as MenuProduct[];
  const images = await signProductImages(items.map((v) => v.image_url));
  return {
    categories: (categories.data ?? []) as MenuCategory[],
    products: items,
    images,
  };
}

function loyaltyLabel(product: MenuProduct) {
  if (!product.loyalty_enabled) return "Loyalty off";
  const reward = product.reward_quantity || 1;
  return `Buy ${product.loyalty_target} get ${reward} free`;
}

const normalizedName = (value: string) => value.trim().toLocaleLowerCase();

function categoryError(error: unknown) {
  if ((error as { code?: string })?.code === "23505") {
    return new Error("This category name already exists");
  }
  return error;
}

function MenuPage() {
  const queryClient = useQueryClient();
  const { access, loading: accessLoading } = useStaffAccess();
  const { data, isLoading, error } = useQuery({ queryKey: ["catalogue"], queryFn: loadCatalogue });
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<{
    open: boolean;
    product: MenuProduct | null;
    categoryId: string;
  }>({ open: false, product: null, categoryId: "" });

  const canManageMenu = access.isSuperAdmin;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["menu"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = categoryName.trim();
      if (name.length < 2) throw new Error("Enter a category name");
      if (data?.categories.some((category) => normalizedName(category.name) === normalizedName(name))) {
        throw new Error("This category name already exists");
      }
      const nextOrder = (data?.categories.at(-1)?.sort_order ?? 0) + 1;
      const { error: insertError } = await supabase
        .from("categories")
        .insert({ name, sort_order: nextOrder });
      if (insertError) throw categoryError(insertError);
    },
    onSuccess: () => {
      toast.success("Category added");
      setCategoryName("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveCategory = useMutation({
    mutationFn: async ({
      category,
      name,
      sort_order,
    }: {
      category: MenuCategory;
      name: string;
      sort_order: number;
    }) => {
      if (name.trim().length < 2) throw new Error("Enter a category name");
      if (
        data?.categories.some(
          (item) => item.id !== category.id && normalizedName(item.name) === normalizedName(name),
        )
      ) {
        throw new Error("This category name already exists");
      }
      const { error: updateError } = await supabase
        .from("categories")
        .update({ name: name.trim(), sort_order })
        .eq("id", category.id);
      if (updateError) throw categoryError(updateError);
    },
    onSuccess: () => {
      toast.success("Category updated");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleCategory = useMutation({
    mutationFn: async (category: MenuCategory) => {
      const { error: updateError } = await supabase
        .from("categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);
      if (updateError) throw updateError;
    },
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  /** Only allowed when no juices reference the category. */
  const deleteCategory = useMutation({
    mutationFn: async (category: MenuCategory) => {
      const { count, error: countError } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id);
      if (countError) throw countError;
      if ((count ?? 0) > 0) throw new Error("Move or delete the juices in this category first");
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success("Category deleted");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleProduct = useMutation({
    mutationFn: async (product: MenuProduct) => {
      const { error: updateError } = await supabase
        .from("products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);
      if (updateError) throw updateError;
    },
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const term = search.trim().toLowerCase();
  const scopedProducts = useMemo(() => {
    const products = data?.products ?? [];
    if (access.isSuperAdmin) return products;
    if (!access.branchId) return [];
    return products.filter(
      (product) =>
        !Array.isArray(product.branch_ids) ||
        product.branch_ids.length === 0 ||
        product.branch_ids.includes(access.branchId as string),
    );
  }, [data?.products, access.isSuperAdmin, access.branchId]);

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuProduct[]>();
    for (const product of scopedProducts) {
      if (!showHidden && !product.is_active) continue;
      if (term && !product.name.toLowerCase().includes(term)) continue;
      const key = product.category_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), product]);
    }
    return map;
  }, [scopedProducts, showHidden, term]);

  if (isLoading || accessLoading) return <p className="text-sm text-muted-foreground">Loading menu…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load the menu. Please retry.</p>;
  if (!data) return null;

  const nextSortOrder = (data.products.length + 1) * 100;
  const scopedCategories = access.isSuperAdmin
    ? data.categories
    : data.categories.filter((category) => (byCategory.get(category.id)?.length ?? 0) > 0);
  const visibleCategories = term
    ? scopedCategories.filter((category) => (byCategory.get(category.id)?.length ?? 0) > 0)
    : scopedCategories;
  const hasUncategorisedMatches = (byCategory.get("none")?.length ?? 0) > 0;
  const hasSearchResults = visibleCategories.length > 0 || hasUncategorisedMatches;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Categories and juices in one place — price, photo, loyalty plan, order and availability.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Label htmlFor="menu-search" className="text-xs text-muted-foreground">
              Search juices
            </Label>
            <Input
              id="menu-search"
              placeholder="e.g. 500ml"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <span className="text-sm font-medium">Show hidden</span>
            <Switch
              checked={showHidden}
              onCheckedChange={setShowHidden}
              aria-label="Show hidden juices"
            />
          </div> */}
        </div>
      </div>

      {!canManageMenu && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          Read-only view for {access.branchName ?? "this branch"}
        </div>
      )}

      {canManageMenu && (
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Add category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="category-name">Category name</Label>
              <Input
                id="category-name"
                placeholder="e.g. Fruit Mix with Sugarcane Juice"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <Button onClick={() => addCategory.mutate()} disabled={addCategory.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add category
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visibleCategories.map((category) => {
          const items = byCategory.get(category.id) ?? [];
          const isCollapsed = collapsed[category.id] ?? false;
          return (
            <Card key={category.id} className="rounded-2xl shadow-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${category.name}`}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [category.id]: !isCollapsed }))
                    }
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {canManageMenu ? (
                    <Input
                      className="h-9 w-56"
                      defaultValue={category.name}
                      aria-label={`Rename ${category.name}`}
                      onBlur={(e) =>
                        e.target.value.trim() !== category.name &&
                        saveCategory.mutate({
                          category,
                          name: e.target.value,
                          sort_order: category.sort_order,
                        })
                      }
                    />
                  ) : (
                    <span className="font-semibold">{category.name}</span>
                  )}
                  <span className="text-xs font-normal text-muted-foreground">
                    {items.length} juice{items.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
                {canManageMenu && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{category.is_active ? "Visible" : "Hidden"}</span>
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => toggleCategory.mutate(category)}
                      aria-label={`Toggle ${category.name}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => deleteCategory.mutate(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>

              {isCollapsed ? null : (
                <CardContent className="space-y-2">
                  {items.map((product) => {
                    const signed = data.images[product.image_url] ?? null;
                    return (
                      <div
                        key={product.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                      >
                        {signed ? (
                          <img
                            src={signed}
                            alt={product.name}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-32 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {product.name} <span className="font-normal text-muted-foreground">· {product.volume_ml} ml</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(Number(product.price))} · {loyaltyLabel(product)}
                          </p>
                        </div>
                        {canManageMenu ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{product.is_active ? "Visible" : "Hidden"}</span>
                            <Switch
                              checked={product.is_active}
                              onCheckedChange={() => toggleProduct.mutate(product)}
                              aria-label={`Toggle ${product.name}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setDialog({ open: true, product, categoryId: category.id })
                              }
                            >
                              <Pencil className="mr-1 h-4 w-4" /> Edit
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">View only</div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No juices here yet.</p>
                  ) : null}
                  {canManageMenu && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDialog({ open: true, product: null, categoryId: category.id })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add juice to this category
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {hasUncategorisedMatches ? (
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Uncategorised</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(byCategory.get("none") ?? []).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {product.name} <span className="font-normal text-muted-foreground">· {product.volume_ml} ml</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(Number(product.price))} · {loyaltyLabel(product)}
                    </p>
                  </div>
                  {canManageMenu && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ open: true, product, categoryId: "" })}
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {data.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add your first category above to get started.</p>
        ) : null}
        {term && !hasSearchResults ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No juices found for “{search.trim()}”.
          </p>
        ) : null}
      </div>

      {canManageMenu && (
        <ProductDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          categories={data.categories}
          product={dialog.product}
          defaultCategoryId={dialog.categoryId}
          nextSortOrder={nextSortOrder}
          signedImage={dialog.product ? (data.images[dialog.product.image_url] ?? null) : null}
        />
      )}
    </div>
  );
}
