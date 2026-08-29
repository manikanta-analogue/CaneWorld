import {
  getBranchByToken,
  getCustomerProgress,
  getPublicSettings,
  listPublicProducts,
  loginWithPin,
  lookupCustomer,
  registerCustomer,
  startCustomerAuth,
  verifyOtpAndSetPin,
  submitCheckout,
} from "@/lib/branch.functions";


export type Product = {
  id: string;
  name: string;
  volume_ml: number;
  price: number;
  loyalty_target: number;
  loyalty_enabled?: boolean;
  reward_quantity?: number;
  description?: string;
  image_url?: string;
  image_signed_url?: string | null;
  sort_order: number;
  is_active: boolean;
  category_id?: string | null;
  category_name?: string | null;
  category_active?: boolean;
};

export type Branch = {
  id: string;
  name: string;
  owner_name: string;
  mobile: string;
  address: string;
  status: "active" | "disabled";
  qr_token: string;
  image_url: string;
  map_location?: string;
  image_signed_url?: string | null;
  created_at?: string;
};

export type Customer = { id: string; name: string; mobile: string; created_at: string };

export type Progress = {
  id: string;
  customer_id: string;
  product_id: string;
  purchased_count: number;
  redeemed_count: number;
};

export type CartLine = { product: Product; qty: number };

export type EligibleReward = { product: Product; progress: number; target: number };

export const formatMoney = (amount: number, currency = "₹") =>
  `${currency}${Number(amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const DUMMY_OTP = "123456";

/** A product is reward-eligible once the customer has paid for target - reward glasses. */
export function isEligible(progress: number, target: number, reward = 1, enabled = true) {
  const rewardQty = Math.max(1, reward);
  return enabled && target > 1 && progress >= target - rewardQty;
}

export const rewardQuantity = (product: Product) => Math.max(1, Number(product.reward_quantity ?? 1));
export const loyaltyOn = (product: Product) =>
  product.loyalty_enabled !== false && Number(product.loyalty_target) > 1;

export function eligibleRewards(
  cart: CartLine[],
  progressByProduct: Record<string, Progress | undefined>,
): EligibleReward[] {
  return cart
    .filter((line) => line.qty > 0)
    .filter((line) =>
      isEligible(
        progressByProduct[line.product.id]?.purchased_count ?? 0,
        line.product.loyalty_target,
        rewardQuantity(line.product),
        loyaltyOn(line.product),
      ),
    )
    .map((line) => ({
      product: line.product,
      progress: progressByProduct[line.product.id]?.purchased_count ?? 0,
      target: line.product.loyalty_target,
    }));
}

export function buildOrder(cart: CartLine[], redeemProductIds: string[]) {
  const items = cart
    .filter((line) => line.qty > 0)
    .map((line) => {
      const free = redeemProductIds.includes(line.product.id)
        ? Math.min(rewardQuantity(line.product), line.qty)
        : 0;
      const paid = Math.max(0, line.qty - free);
      return {
        product: line.product,
        paid_quantity: paid,
        free_quantity: free,
        line_total: paid * Number(line.product.price),
      };
    });
  return {
    items,
    total: items.reduce((sum, item) => sum + item.line_total, 0),
    paidGlasses: items.reduce((sum, item) => sum + item.paid_quantity, 0),
    freeGlasses: items.reduce((sum, item) => sum + item.free_quantity, 0),
  };
}

export function makeReference(method: "cash" | "razorpay") {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${method === "cash" ? "CASH" : "RZP"}-${Date.now().toString().slice(-6)}${rand}`;
}

/* Branch-portal reads and writes go through server functions so the public
   database never needs anonymous access to customer or sales data. */

export async function fetchProducts(): Promise<Product[]> {
  return (await listPublicProducts()) as unknown as Product[];
}

/** Only items customers can actually buy right now. */
export async function fetchSellableProducts(): Promise<Product[]> {
  const products = await fetchProducts();
  return products.filter((product) => product.is_active && product.category_active !== false);
}

export async function fetchSettings() {
  return await getPublicSettings();
}

export async function fetchBranchByToken(token: string) {
  return (await getBranchByToken({ data: { token } })) as unknown as Branch | null;
}

export async function fetchProgress(token: string, customerId: string): Promise<Progress[]> {
  return (await getCustomerProgress({ data: { token, customerId } })) as unknown as Progress[];
}

export async function findCustomerByMobile(token: string, mobile: string) {
  return (await lookupCustomer({ data: { token, mobile } })) as unknown as Customer | null;
}

export async function createCustomer(token: string, name: string, mobile: string) {
  return (await registerCustomer({ data: { token, name, mobile } })) as unknown as Customer;
}

/** Tells the sign-in screen whether to ask for a PIN or run first-time OTP onboarding. */
export async function beginCustomerAuth(token: string, mobile: string) {
  return (await startCustomerAuth({ data: { token, mobile } })) as unknown as {
    exists: boolean;
    hasPin: boolean;
    name: string;
  };
}

export async function verifyOtpSetPin(input: {
  token: string;
  mobile: string;
  otp: string;
  pin: string;
  name?: string;
}) {
  return (await verifyOtpAndSetPin({ data: input })) as unknown as Customer;
}

export async function signInWithPin(token: string, mobile: string, pin: string) {
  return (await loginWithPin({ data: { token, mobile, pin } })) as unknown as Customer;
}

export type CheckoutInput = {
  token: string;
  customerId: string;
  cart: CartLine[];
  redeemProductIds: string[];
  method: "cash" | "razorpay";
};

/** Persists the sale server-side; totals and loyalty counters are recomputed there. */
export async function checkout(input: CheckoutInput) {
  return await submitCheckout({
    data: {
      token: input.token,
      customerId: input.customerId,
      cart: input.cart.filter((line) => line.qty > 0).map((line) => ({
        productId: line.product.id,
        qty: line.qty,
      })),
      redeemProductIds: input.redeemProductIds,
      method: input.method,
    },
  });
}
