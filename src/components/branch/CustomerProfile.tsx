import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Camera, Gift, LogOut, Pencil, ReceiptText, User } from "lucide-react";
import {
  getCustomerHistory,
  getCustomerProfile,
  getPublicPolicies,
  updateCustomerProfile,
} from "@/lib/branch.functions";
import {
  formatMoney,
  getDisplayLoyaltyRule,
  loyaltyOn,
  rewardBundlesForQty,
  type Customer,
  type Product,
  type Progress,
} from "@/lib/loyalty";
import { categoryArt, productImage } from "@/lib/category-art";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { SafeHtmlContent } from "@/components/SafeHtmlContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HistoryRow = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_glasses: number;
  free_glasses: number;
  payment_method: string;
  reference_no: string;
  status: string;
  branches: { name: string; address: string } | null;
  transaction_items: {
    id: string;
    product_name: string;
    unit_price: number;
    paid_quantity: number;
    free_quantity: number;
    line_total: number;
    loyalty_target_at_purchase: number | null;
    reward_quantity_at_purchase: number | null;
    products: { volume_ml: number } | null;
  }[];
};

type ProfileRow = {
  id: string;
  name: string;
  mobile: string;
  image_signed_url: string | null;
};

type PolicyRow = { policy_type: string; title: string; content: string; updated_at: string };

const RANGES = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "custom", label: "Custom" },
] as const;

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const METHODS = [
  { key: "all", label: "All payments" },
  { key: "razorpay", label: "Online" },
] as const;


/** Shrinks a picked photo in the browser so the upload stays small. */
async function toCompressedDataUrl(file: File, size = 512) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function CustomerProfile({
  token,
  customer,
  products,
  progress,
  currency,
  view = "rewards",
  onSwitchCustomer,
}: {
  token: string;
  customer: Customer;
  products: Product[];
  progress: Progress[];
  currency: string;
  view?: "rewards" | "account";
  onSwitchCustomer?: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"]>("all");
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date(Date.now() - 30 * 864e5)));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [bill, setBill] = useState<HistoryRow | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [name, setName] = useState(customer.name);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [visibleTransactions, setVisibleTransactions] = useState(10);

  const history = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () =>
      (await getCustomerHistory({
        data: { token, customerId: customer.id },
      })) as unknown as HistoryRow[],
  });

  const profile = useQuery({
    queryKey: ["customer-profile", customer.id],
    queryFn: async () =>
      (await getCustomerProfile({
        data: { token, customerId: customer.id },
      })) as unknown as ProfileRow | null,
  });
  const policies = useQuery({
    queryKey: ["public-policies"],
    queryFn: async () => (await getPublicPolicies()) as unknown as PolicyRow[],
    enabled: view === "account",
  });

  const save = useMutation({
    mutationFn: async () =>
      updateCustomerProfile({
        data: { token, customerId: customer.id, name: name.trim(), imageDataUrl: dataUrl },
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditOpen(false);
      setDataUrl(null);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["customer-profile", customer.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const rows = history.data ?? [];
    const now = Date.now();
    const cutoff =
      range === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : range === "7"
          ? now - 7 * 864e5
          : range === "30"
            ? now - 30 * 864e5
            : 0;

    return rows.filter((row) => {
      const rowTime = new Date(row.created_at).getTime();
      const inRange =
        range === "custom"
          ? rowTime >= new Date(`${customFrom}T00:00:00`).getTime() &&
            rowTime <= new Date(`${customTo}T23:59:59.999`).getTime()
          : range === "all"
            ? true
            : rowTime >= cutoff;
      const inMethod = method === "all" || row.payment_method === method;
      return inRange && inMethod;
    });
  }, [history.data, range, method, customFrom, customTo]);

  useEffect(() => {
    setVisibleTransactions(10);
  }, [customer.id, range, method, customFrom, customTo]);

  const visibleHistory = filtered.slice(0, visibleTransactions);

  const spent = filtered.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const freeGlasses = filtered.reduce((sum, row) => sum + row.free_glasses, 0);

  const byProduct = Object.fromEntries(progress.map((row) => [row.product_id, row]));
  const purchasedProductIds = new Set(
    progress
      .filter((row) => Number(row.purchased_count) > 0)
      .map((row) => row.product_id),
  );
  const loyaltyProducts = products.filter(
    (product) => loyaltyOn(product) && purchasedProductIds.has(product.id),
  );

  if (view === "account") {
    const avatar = profile.data?.image_signed_url ?? null;
    return (
      <div className="space-y-4 px-4 pb-32 pt-4 sm:px-6">
        <h1 className="text-xl font-extrabold">Account</h1>

        <section className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl bg-cane-700 p-4 text-primary-foreground shadow-lift">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary-foreground/15">
            {avatar ? (
              <img src={avatar} alt={profile.data?.name ?? customer.name} className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">
              Hi, {profile.data?.name ?? customer.name} 👋
            </p>
            <p className="truncate text-sm opacity-90">{customer.mobile}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => {
              setName(profile.data?.name ?? customer.name);
              setEditOpen(true);
            }}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-bold">Transaction history</h2>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {RANGES.map((item) => (
              <button
                key={item.key}
                onClick={() => setRange(item.key)}
                aria-pressed={range === item.key}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  range === item.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/60 p-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[140px] rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[140px] rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* {METHODS.map((item) => (
              <button
                key={item.key}
                onClick={() => setMethod(item.key)}
                aria-pressed={method === item.key}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  method === item.key
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))} */}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-secondary/60 p-2">
              <p className="text-xs text-muted-foreground">Visits</p>
              <p className="text-sm font-extrabold">{filtered.length}</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-2">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-sm font-extrabold">{formatMoney(spent, currency)}</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-2">
              <p className="text-xs text-muted-foreground">Free</p>
              <p className="text-sm font-extrabold">{freeGlasses}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {visibleHistory.map((row) => (
              <button
                key={row.id}
                onClick={() => setBill(row)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary/60 p-3 text-left transition hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.branches?.name ?? "Branch"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("en-IN")} ·{" "}
                    {row.payment_method === "cash" ? "Cash" : "Online"}
                    {row.free_glasses > 0 ? ` · ${row.free_glasses} free` : ""}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Paid for: {row.transaction_items
                      .filter((item) => item.paid_quantity > 0)
                      .map(
                        (item) =>
                          `${item.product_name} ${item.products?.volume_ml ? `(${item.products.volume_ml} ml)` : ""} ×${item.paid_quantity}`,
                      )
                      .join(", ") || "No paid items"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold">
                  {formatMoney(Number(row.total_amount), currency)}
                </span>
              </button>
            ))}
            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            ) : null}
            {!history.isLoading && filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions for this filter.</p>
            ) : null}
            {visibleTransactions < filtered.length ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-2xl"
                onClick={() => setVisibleTransactions((current) => current + 10)}
              >
                Load 10 more
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
          <h2 className="text-base font-extrabold">Policies</h2>
          <p className="mt-1 text-xs text-muted-foreground">Terms, privacy, cancellation and refund information.</p>
          <div className="mt-3 space-y-2">
            {(policies.data ?? []).map((policy) => (
              <details key={policy.policy_type} className="rounded-xl bg-secondary/50 p-3">
                <summary className="cursor-pointer text-sm font-semibold">{policy.title}</summary>
                {policy.content.trim() ? (
                  <SafeHtmlContent
                    html={policy.content}
                    className="mt-2 text-xs leading-5 text-muted-foreground"
                  />
                ) : (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This policy has not been published yet.
                  </p>
                )}
              </details>
            ))}
            {policies.isLoading ? <p className="text-xs text-muted-foreground">Loading policies…</p> : null}
          </div>
        </section>

        {onSwitchCustomer ? (
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl bg-card"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        ) : null}

        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Are you sure you want to logout?</DialogTitle>
              <DialogDescription>
                You will need to sign in again with your mobile number and PIN to continue using your rewards.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" className="h-11 rounded-full" onClick={() => setLogoutOpen(false)}>
                Cancel
              </Button>
              <Button className="h-11 rounded-full" onClick={() => {
                setLogoutOpen(false);
                onSwitchCustomer?.();
              }}>
                Logout
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(bill)} onOpenChange={(open) => !open && setBill(null)}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Bill details</DialogTitle>
              <DialogDescription>
                {bill ? `${bill.reference_no} · ${new Date(bill.created_at).toLocaleString("en-IN")}` : ""}
              </DialogDescription>
            </DialogHeader>
            {bill ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                  <p className="text-sm font-bold text-foreground">{bill.branches?.name ?? "Branch"}</p>
                  {bill.branches?.address ? <p className="truncate">{bill.branches.address}</p> : null}
                  <p className="mt-1">
                    {bill.payment_method === "cash" ? "Cash" : "Online"} · {bill.status}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {bill.transaction_items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {item.product_name}{" "}
                          {item.products?.volume_ml ? (
                            <span className="font-bold text-primary">{item.products.volume_ml} ml</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.paid_quantity} × {formatMoney(Number(item.unit_price), currency)}
                          {item.free_quantity > 0 ? ` · ${item.free_quantity} FREE` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold">
                        {formatMoney(Number(item.line_total), currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-base font-extrabold">
                  <span>Total paid</span>
                  <span>{formatMoney(Number(bill.total_amount), currency)}</span>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>Update your name and profile photo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary">
                  {preview ?? avatar ? (
                    <img src={preview ?? avatar!} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="space-y-1">
                  <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
                    <Camera className="mr-2 h-4 w-4" /> Choose photo
                  </Button>
                  <p className="text-xs text-muted-foreground">Square photo works best · JPG, PNG or WEBP</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      const url = await toCompressedDataUrl(file);
                      setDataUrl(url);
                      setPreview(url);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input value={customer.mobile} disabled className="h-12 rounded-2xl" />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="h-12 w-full rounded-full"
                disabled={save.isPending || name.trim().length < 2}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const selectedProduct = loyaltyProducts.find((product) => product.id === selectedProductForHistory) ?? null;
  const selectedProductPurchases = selectedProduct
    ? (history.data ?? []).filter((row) =>
        row.transaction_items.some((item) => item.product_name === selectedProduct.name),
      )
    : [];
  const selectedRuleTimeline = Array.from(
    selectedProductPurchases
      .flatMap((row) =>
        row.transaction_items
          .filter((item) => item.product_name === selectedProduct?.name)
          .map((item) => ({
            date: row.created_at,
            rule:
              item.loyalty_target_at_purchase && item.reward_quantity_at_purchase
                ? `Buy ${item.loyalty_target_at_purchase} Get ${item.reward_quantity_at_purchase} Free`
                : null,
          })),
      )
      .reduce((timeline, entry) => {
        const key = entry.rule ?? "legacy";
        const current = timeline.get(key);
        if (current) {
          current.count += 1;
        } else {
          timeline.set(key, { ...entry, count: 1 });
        }
        return timeline;
      }, new Map<string, { rule: string | null; date: string; count: number }>())
      .values(),
  );

  return (
    <div className="space-y-4 px-4 pb-32 pt-4 sm:px-6">
      <div>
        <h1 className="text-xl font-extrabold">Rewards</h1>
        <p className="text-sm text-muted-foreground">One loyalty card per size, tracked separately</p>
      </div>

      {loyaltyProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No purchased items yet. Rewards will appear here once the customer buys a drink.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loyaltyProducts.map((product) => {
          const progress = byProduct[product.id];
          const redeemed = progress?.redeemed_count ?? 0;
          const rule = getDisplayLoyaltyRule(product, progress);
          const reward = rule.rewardQty;
          const purchasedInCycle = progress?.purchased_count ?? 0;
          const ready = rewardBundlesForQty(progress?.purchased_count ?? 0, product, progress) > 0;
          const done = ready ? rule.target : Math.min(rule.target, purchasedInCycle % rule.target);

          return (
            <article
              key={product.id}
              onClick={() => setSelectedProductForHistory(product.id)}
              className="cursor-pointer rounded-3xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <img
                  src={productImage(product)}
                  alt={product.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className={`h-12 w-12 shrink-0 rounded-xl object-cover ${categoryArt(product.category_name).tint}`}
                />
                <p className="truncate font-bold">{product.name}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      ready ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {ready ? "Reward ready" : `${done} / ${rule.target}`}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
              </div>
              <ProgressBar value={(done / rule.target) * 100} className="mt-3 h-2" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: rule.target }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-6 w-6 rounded-full border text-center text-[10px] leading-6 ${
                      index < done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gift className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {ready
                    ? `${reward} free ${product.name} ready to redeem`
                    : `Buy ${Math.max(0, rule.target - done)} more & get ${reward} FREE`}
                  {redeemed > 0 ? ` · ${redeemed} redeemed` : ""}
                </p>
              </div>

              <div className="mt-3 rounded-xl bg-secondary/40 p-2">
                <p className="text-[10px] font-semibold text-muted-foreground">Current reward cycle</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="text-center">
                    <p className="font-semibold">{purchasedInCycle}</p>
                    <p className="text-muted-foreground">Paid in cycle</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{progress?.redeemed_count ?? 0}</p>
                    <p className="text-muted-foreground">Redeemed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-primary">Buy {rule.target} Get {reward}</p>
                    <p className="text-muted-foreground">Rule</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(selectedProductForHistory)} onOpenChange={(open) => !open && setSelectedProductForHistory(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name ?? "Transaction history"}</DialogTitle>
            <DialogDescription>All purchases and rule changes for this product.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedProduct && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Rule history</p>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Rules are grouped here; each sale is listed below.
                </p>
                <div className="space-y-1.5">
                  {selectedRuleTimeline.length > 0 ? (
                    selectedRuleTimeline.map((entry) =>
                      entry.rule ? (
                        <div key={entry.rule} className="rounded bg-background/50 p-2 text-xs">
                          <p className="font-semibold text-primary">{entry.rule}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            Used in {entry.count} sale{entry.count === 1 ? "" : "s"} · first used {new Date(entry.date).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      ) : (
                        <div key="legacy" className="rounded border border-border bg-background/50 p-2 text-[11px] text-muted-foreground">
                          {entry.count} older sale{entry.count === 1 ? "" : "s"} do not have a saved reward rule. Paid and free quantities below are still accurate.
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">No purchases yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Show all transactions */}
            {selectedProductPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase history found for this product.</p>
            ) : (
              selectedProductPurchases.map((row) => {
                const matchingItems = row.transaction_items.filter(
                  (item) => item.product_name === selectedProduct?.name,
                );
                const totalQty = matchingItems.reduce(
                  (sum, item) => sum + item.paid_quantity + item.free_quantity,
                  0,
                );
                const amount = matchingItems.reduce((sum, item) => sum + Number(item.line_total), 0);

                return (
                  <div key={row.id} className="rounded-2xl border border-border bg-secondary/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{row.branches?.name ?? "Branch"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold">{formatMoney(amount, currency)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {row.payment_method === "cash" ? "Cash" : "Online"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {matchingItems.map((item) => (
                        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl bg-background/70 p-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.paid_quantity} paid · {item.free_quantity} free · {formatMoney(Number(item.unit_price), currency)} each
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.loyalty_target_at_purchase && item.reward_quantity_at_purchase
                                ? `Rule used: Buy ${item.loyalty_target_at_purchase} Get ${item.reward_quantity_at_purchase} Free`
                                : "Rule not recorded for this older sale"}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold">{formatMoney(Number(item.line_total), currency)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                      <span>Total quantity</span>
                      <span className="font-semibold text-foreground">{totalQty} items</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
