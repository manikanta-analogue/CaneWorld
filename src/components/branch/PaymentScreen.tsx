import { useState } from "react";
import { CreditCard, Gift, Loader2, Trash2 } from "lucide-react";
import { buildOrder, formatMoney, type CartLine } from "@/lib/loyalty";
import { Button } from "@/components/ui/button";

export function PaymentScreen({
  cart,
  redeemProductIds,
  progressByProduct,
  currency,
  busy,
  onBack,
  onRemove,
  onPay,
}: {
  cart: CartLine[];
  redeemProductIds: string[];
  progressByProduct?: Record<string, { purchased_count: number; loyalty_target_at_creation?: number | null; reward_quantity_at_creation?: number | null } | undefined>;
  currency: string;
  busy: boolean;
  onBack: () => void;
  onRemove: (productId: string) => void;
  onPay: (method: "cash" | "razorpay") => void;
}) {
  const { items, total, freeGlasses } = buildOrder(cart, redeemProductIds, progressByProduct);
  const [simulating, setSimulating] = useState(false);

  const payRazorpay = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      onPay("razorpay");
    }, 1200);
  };

  const pending = busy || simulating;

  return (
    <div className="space-y-5 px-4 pb-32 pt-4 sm:px-6">
      <h1 className="text-xl font-extrabold">Checkout</h1>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-card">
        <p className="text-sm font-bold">Order summary</p>
        <div className="mt-3 space-y-2">
          {items
            .filter((item) => item.paid_quantity + item.free_quantity > 0)
            .map((item) => (
              <div key={item.product.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item.product.name} ×{item.paid_quantity}
                    {item.free_quantity > 0 && (
                      <span className="ml-1 font-semibold text-primary">+{item.free_quantity} free</span>
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{formatMoney(item.line_total, currency)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.product.name} from checkout`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30"
                    onClick={() => onRemove(item.product.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total amount</span>
          <span className="text-2xl font-extrabold">{formatMoney(total, currency)}</span>
        </div>
        {freeGlasses > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            {freeGlasses} free glass redeemed from your loyalty card
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-bold">Payment method</p>
        <Button
          className="h-14 w-full justify-start rounded-2xl text-base"
          disabled={pending}
          onClick={payRazorpay}
        >
          {simulating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <CreditCard className="mr-2 h-5 w-5" />
          )}
          {simulating ? "Contacting Razorpay (demo)…" : "Razorpay (demo)"}
        </Button>
        <button
          type="button"
          className="h-12 w-full rounded-2xl text-center text-sm font-semibold text-emerald-600 underline-offset-4 transition hover:text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onBack}
          disabled={pending}
        >
          Back to cart
        </button>
      </section>
    </div>
  );
}
