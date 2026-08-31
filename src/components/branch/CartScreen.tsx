import { Minus, Plus, ShoppingCart } from "lucide-react";
import { buildOrder, formatMoney, type CartLine } from "@/lib/loyalty";
import { categoryArt, productImage } from "@/lib/category-art";
import { Button } from "@/components/ui/button";

export function CartScreen({
  cart,
  currency,
  setQty,
  onProceed,
  onBrowse,
}: {
  cart: CartLine[];
  currency: string;
  setQty: (productId: string, next: number) => void;
  onProceed: () => void;
  onBrowse: () => void;
}) {
  const lines = cart.filter((line) => line.qty > 0);
  const redeemIds = lines
    .filter((line) => {
      const target = Number(line.product.loyalty_target ?? 1);
      const reward = Number(line.product.reward_quantity ?? 1);
      return line.product.loyalty_enabled !== false && target > 1 && Math.floor(line.qty / target) * reward > 0;
    })
    .map((line) => line.product.id);
  const { total, paidGlasses, freeGlasses, items } = buildOrder(cart, redeemIds);

  if (lines.length === 0) {
    return (
      <div className="px-6 pb-32 pt-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
          <ShoppingCart className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-extrabold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a fresh glass to get started.</p>
        <Button className="mt-5 h-12 rounded-full px-6" onClick={onBrowse}>
          Browse the menu
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-36 pt-4 sm:px-6">
      <h1 className="text-xl font-extrabold">Your cart</h1>

      <div className="space-y-3">
        {lines.map((line) => {
          const lineItem = items.find((item) => item.product.id === line.product.id);
          const freeQty = lineItem?.free_quantity ?? 0;
          const containerTotal = lineItem ? lineItem.line_total : Number(line.product.price) * line.qty;

          return (
          <div
            key={line.product.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-border bg-card p-3 shadow-card"
          >
            <img
              src={productImage(line.product)}
              alt={line.product.name}
              loading="lazy"
              width={512}
              height={512}
              className={`h-16 w-16 shrink-0 rounded-2xl object-cover ${categoryArt(line.product.category_name).tint}`}
            />
            <div className="min-w-0">
              <p className="truncate font-bold">{line.product.name}</p>
              <p className="text-xs text-muted-foreground">{line.product.volume_ml} ml</p>
              <p className="text-sm font-extrabold text-primary">
                {formatMoney(containerTotal, currency)}
              </p>
              {freeQty > 0 ? (
                <p className="text-[11px] font-semibold text-primary">{freeQty} free from loyalty</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary p-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                aria-label={`Decrease ${line.product.name}`}
                onClick={() => setQty(line.product.id, line.qty - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-bold">{line.qty}</span>
              <Button
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label={`Increase ${line.product.name}`}
                onClick={() => setQty(line.product.id, line.qty + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Paid glasses</span>
          <span>{paidGlasses}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Free glasses</span>
          <span className="font-semibold text-primary">{freeGlasses}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-extrabold">{formatMoney(total, currency)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Loyalty bundles are deducted from the total when a free reward is redeemed.
        </p>
      </div>

      <Button className="h-14 w-full rounded-full text-base" onClick={onProceed}>
        Proceed to checkout
      </Button>
    </div>
  );
}
