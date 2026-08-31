import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Home, ShoppingCart, Sparkles, User } from "lucide-react";
import {
  buildOrder,
  checkout,
  eligibleRewards,
  fetchBranchByToken,
  fetchSellableProducts,
  fetchProgress,
  fetchSettings,
  type CartLine,
  type Customer,
} from "@/lib/loyalty";
import { CustomerAuth } from "@/components/branch/CustomerAuth";
import { PosScreen } from "@/components/branch/PosScreen";
import { CartScreen } from "@/components/branch/CartScreen";
import { PaymentScreen } from "@/components/branch/PaymentScreen";
import { SuccessScreen, type Receipt } from "@/components/branch/SuccessScreen";
import { CustomerProfile } from "@/components/branch/CustomerProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/b/$token")({
  head: () => ({
    meta: [
      { title: "Branch Portal — Sugarcane Loyalty" },
      {
        name: "description",
        content:
          "Branch mobile portal for sugarcane juice check-ins, POS billing, loyalty redemption and payments.",
      },
      { property: "og:title", content: "Branch Portal — Sugarcane Loyalty" },
      {
        property: "og:description",
        content: "Scan, order and redeem free glasses at your sugarcane juice branch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BranchPortal,
});

type Tab = "home" | "cart" | "rewards" | "account";

const customerSessionKey = (token: string) => `branch-customer:${token}`;
const tabSessionKey = (token: string) => `branch-tab:${token}`;

function BranchPortal() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try {
      const saved = window.sessionStorage.getItem(customerSessionKey(token));
      return saved ? (JSON.parse(saved) as Customer) : null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = window.sessionStorage.getItem(tabSessionKey(token));
      return saved === "home" || saved === "cart" || saved === "rewards" || saved === "account"
        ? (saved as Tab)
        : "home";
    } catch {
      return "home";
    }
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [rewardOpen, setRewardOpen] = useState(false);
  const [pending, setPending] = useState<{ cart: CartLine[]; redeem: string[] } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);

  const branchQuery = useQuery({ queryKey: ["branch", token], queryFn: () => fetchBranchByToken(token) });
  const branch = branchQuery.data;
  const productsQuery = useQuery({
    queryKey: ["products", branch?.id],
    queryFn: () => fetchSellableProducts(branch?.id),
    enabled: Boolean(branch),
  });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const progressQuery = useQuery({
    queryKey: ["progress", customer?.id],
    queryFn: () => fetchProgress(token, customer!.id),
    enabled: Boolean(customer),
  });

  const currency = (settingsQuery.data as { currency?: string } | null)?.currency ?? "₹";
  const products = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.is_active),
    [productsQuery.data],
  );
  const progress = progressQuery.data ?? [];

  const cart: CartLine[] = useMemo(
    () => products.map((product) => ({ product, qty: quantities[product.id] ?? 0 })),
    [products, quantities],
  );
  const cartCount = buildOrder(cart, []).paidGlasses;

  const setQty = (productId: string, next: number) =>
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, Math.min(50, next)) }));

  useEffect(() => {
    if (!customer) {
      window.sessionStorage.removeItem(customerSessionKey(token));
      return;
    }
    window.sessionStorage.setItem(customerSessionKey(token), JSON.stringify(customer));
  }, [customer, token]);

  useEffect(() => {
    window.sessionStorage.setItem(tabSessionKey(token), tab);
  }, [tab, token]);

  const resetSession = () => {
    setCustomer(null);
    setPending(null);
    setQuantities({});
    setTab("home");
    window.sessionStorage.removeItem(customerSessionKey(token));
    window.sessionStorage.removeItem(tabSessionKey(token));
  };

  const finishCheckout = () => {
    setReceipt(null);
    setPending(null);
    setQuantities({});
    setTab("home");
    window.sessionStorage.setItem(tabSessionKey(token), "home");
  };

  if (branchQuery.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading branch…</p>;
  }

  if (!branch || branch.status !== "active") {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">Branch unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This QR code is invalid or the branch has been disabled.
        </p>
      </div>
    );
  }

  if (receipt) {
    return (
      <SuccessScreen
        receipt={receipt}
        currency={currency}
        onDone={finishCheckout}
      />
    );
  }

  if (!customer) {
    return (
      <CustomerAuth
        token={token}
        branchName={branch.name}
        branchImage={branch.image_signed_url}
        onReady={setCustomer}
      />
    );
  }

  const progressByProduct = Object.fromEntries(progress.map((row) => [row.product_id, row]));
  const rewards = eligibleRewards(cart, progressByProduct);

  const proceed = () => {
    if (cartCount === 0) {
      setTab("cart");
      return;
    }
    if (rewards.length > 0) {
      setRewardOpen(true);
      return;
    }
    setPending({ cart, redeem: [] });
  };

  const pay = async (method: "cash" | "razorpay") => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await checkout({
        token,
        customerId: customer.id,
        cart: pending.cart,
        redeemProductIds: pending.redeem,
        method,
      });
      setReceipt({
        reference: result.reference,
        total: result.total,
        method,
        branchName: branch.name,
        customerName: customer.name,
        customerMobile: customer.mobile,
        lines: result.items,
      });
      queryClient.invalidateQueries({ queryKey: ["progress", customer.id] });
      toast.success("Payment successful");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const navItems = [
    { key: "home" as Tab, label: "Home", icon: Home },
    { key: "cart" as Tab, label: "Cart", icon: ShoppingCart, badge: cartCount },
    { key: "rewards" as Tab, label: "Rewards", icon: Gift },
    { key: "account" as Tab, label: "Account", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md lg:max-w-3xl xl:max-w-5xl">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-b-3xl bg-cane-700 px-4 py-4 text-primary-foreground shadow-lift sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs opacity-90">
              Good day, {customer.name.split(" ")[0]} 👋
            </p>
            <p className="truncate text-lg font-extrabold leading-tight">Fresh Juice. Great Rewards.</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {branch.image_signed_url ? (
                <img
                  src={branch.image_signed_url}
                  alt={branch.name}
                  className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-white/40"
                />
              ) : null}
              <p className="truncate text-xs opacity-80">{branch.name}</p>
            </div>
          </div>
          {/* <span className="shrink-0 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
            {customer.mobile}
          </span> */}
        </header>

        {pending ? (
          <PaymentScreen
            cart={pending.cart}
            redeemProductIds={pending.redeem}
            progressByProduct={progressByProduct}
            currency={currency}
            busy={busy}
            onBack={() => setPending(null)}
            onPay={pay}
          />
        ) : tab === "home" ? (
          <PosScreen
            products={products}
            progress={progress}
            currency={currency}
            quantities={quantities}
            setQty={setQty}
            onProceed={proceed}
            bannerUrls={
              settingsQuery.data?.banner_urls_signed?.length
                ? settingsQuery.data.banner_urls_signed
                : settingsQuery.data?.home_banner_signed_url
                  ? [settingsQuery.data.home_banner_signed_url]
                  : []
            }
          />
        ) : tab === "cart" ? (
          <CartScreen
            cart={cart}
            progressByProduct={progressByProduct}
            currency={currency}
            setQty={setQty}
            onProceed={proceed}
            onBrowse={() => setTab("home")}
          />
        ) : (
          <CustomerProfile
            token={token}
            customer={customer}
            products={products}
            progress={progress}
            currency={currency}
            view={tab === "rewards" ? "rewards" : "account"}
            onSwitchCustomer={resetSession}
          />
        )}

        {!pending && (
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md border-t border-border bg-background lg:max-w-3xl"
          >
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                aria-current={tab === item.key ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  tab === item.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" aria-hidden />
                  {item.badge ? (
                    <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="rounded-4xl">
          <DialogHeader>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="h-6 w-6" aria-hidden />
            </div>
            <DialogTitle className="text-center">Congratulations!</DialogTitle>
            <DialogDescription className="text-center">
              You are eligible for one FREE{" "}
              {rewards.map((reward) => reward.product.name).join(" and one FREE ")}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="h-12 w-full rounded-full text-base"
              onClick={() => {
                setRewardOpen(false);
                setPending({ cart, redeem: rewards.map((reward) => reward.product.id) });
              }}
            >
              Redeem free glass
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-full bg-card text-base"
              onClick={() => {
                setRewardOpen(false);
                setPending({ cart, redeem: [] });
              }}
            >
              Pay normally
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
