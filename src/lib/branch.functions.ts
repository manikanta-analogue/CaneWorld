import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().trim().min(8).max(128);
const mobileSchema = z.string().trim().regex(/^[0-9]{10}$/);
const uuidSchema = z.string().uuid();
const pinSchema = z.string().trim().regex(/^[0-9]{4}$/, "PIN must be 4 digits");

const cartSchema = z.array(
  z.object({ productId: uuidSchema, qty: z.number().int().min(0).max(50) }),
);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resolves a branch from its QR token; throws when the token is unknown or disabled. */
async function requireBranch(db: Awaited<ReturnType<typeof admin>>, token: string) {
  const { data, error } = await db
    .from("branches")
    .select("id, name, address, status, qr_token")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "active") throw new Error("This QR code is invalid or disabled.");
  return data;
}

export const getBranchByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: tokenSchema.parse(input.token) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: branch, error } = await db
      .from("branches")
      .select("id, name, address, status, qr_token, image_url")
      .eq("qr_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!branch) return null;

    let image_signed_url: string | null = null;
    if (branch.image_url) {
      const { data: url } = await db.storage
        .from("product-images")
        .createSignedUrl(branch.image_url, 60 * 60 * 12);
      image_signed_url = url?.signedUrl ?? null;
    }
    return { ...branch, image_signed_url };
  });

export const listPublicBranches = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("branches")
    .select("id, name, qr_token, address, map_location")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const listPublicProducts = createServerFn({ method: "GET" })
  .inputValidator((input?: { branchId?: string }) => ({
    branchId: input?.branchId && input.branchId.trim() ? z.string().uuid().parse(input.branchId) : null,
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rowsData, error } = await db
      .from("products")
      .select(
        "id, name, description, image_url, volume_ml, price, loyalty_target, loyalty_enabled, reward_quantity, sort_order, is_active, category_id, branch_ids, categories(name, is_active, sort_order)",
      )
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const rows = (rowsData ?? []) as (Record<string, unknown> & {
      image_url: string;
      sort_order: number;
      branch_ids: string[] | null;
      categories: { name: string; is_active: boolean; sort_order: number } | null;
    })[];

    const filtered = rows.filter((row) => {
      if (!data?.branchId) return true;
      const allowed = row.branch_ids;
      if (!Array.isArray(allowed) || allowed.length === 0) return true;
      return allowed.includes(data.branchId);
    });

    const paths = Array.from(new Set(filtered.map((row) => row.image_url).filter(Boolean)));
    const signed = new Map<string, string>();
    for (const path of paths) {
      const { data: url } = await db.storage.from("product-images").createSignedUrl(path, 60 * 60 * 12);
      if (url?.signedUrl) signed.set(path, url.signedUrl);
    }

    return filtered
      .map((row) => {
        const { categories, ...product } = row;
        return {
          ...product,
          image_signed_url: signed.get(row.image_url) ?? null,
          category_name: categories?.name ?? null,
          category_active: categories?.is_active ?? true,
          category_sort_order: categories?.sort_order ?? 0,
        };
      })
      .sort(
        (a, b) =>
          a.category_sort_order - b.category_sort_order ||
          a.sort_order - b.sort_order,
      );
  });

export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("app_settings")
    .select("company_name, logo_url, currency, home_banner_url, banner_urls")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const storedBannerPaths = Array.isArray(data.banner_urls)
    ? data.banner_urls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const uniqueBannerPaths = Array.from(
    new Set([...(storedBannerPaths ?? []), ...(data.home_banner_url ? [data.home_banner_url] : [])].filter(Boolean)),
  );

  const signedUrlMap = new Map<string, string>();
  for (const path of uniqueBannerPaths) {
    if (!path) continue;
    if (/^https?:\/\//i.test(path)) {
      signedUrlMap.set(path, path);
      continue;
    }
    const { data: url } = await db.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 12);
    if (url?.signedUrl) signedUrlMap.set(path, url.signedUrl);
  }

  const banner_urls_signed = uniqueBannerPaths.map((path) => signedUrlMap.get(path) ?? path);
  const home_banner_signed_url = data.home_banner_url
    ? signedUrlMap.get(data.home_banner_url) ?? data.home_banner_url
    : banner_urls_signed[0] ?? null;

  return {
    ...data,
    banner_urls: storedBannerPaths,
    banner_urls_signed,
    home_banner_signed_url,
  };
});

export const lookupCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; mobile: string }) => ({
    token: tokenSchema.parse(input.token),
    mobile: mobileSchema.parse(input.mobile),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: customer, error } = await db
      .from("customers")
      .select("id, name, mobile, created_at")
      .eq("mobile", data.mobile)
      .maybeSingle();
    if (error) throw error;
    return customer ?? null;
  });

export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; mobile: string; name: string }) => ({
    token: tokenSchema.parse(input.token),
    mobile: mobileSchema.parse(input.mobile),
    name: z.string().trim().min(2).max(60).parse(input.name),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: existing } = await db
      .from("customers")
      .select("id, name, mobile, created_at")
      .eq("mobile", data.mobile)
      .maybeSingle();
    if (existing) return existing;
    const { data: created, error } = await db
      .from("customers")
      .insert({ name: data.name, mobile: data.mobile })
      .select("id, name, mobile, created_at")
      .single();
    if (error) throw error;
    return created;
  });

/** Step 1: tells the app whether this mobile needs OTP onboarding or a PIN login. */
export const startCustomerAuth = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; mobile: string }) => ({
    token: tokenSchema.parse(input.token),
    mobile: mobileSchema.parse(input.mobile),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: customer, error } = await db
      .from("customers")
      .select("id, name, pin_hash")
      .eq("mobile", data.mobile)
      .maybeSingle();
    if (error) throw error;
    return {
      exists: Boolean(customer),
      hasPin: Boolean(customer?.pin_hash),
      name: customer?.name ?? "",
    };
  });

/** First-time onboarding (or PIN reset): OTP is verified server-side before the PIN is stored. */
export const verifyOtpAndSetPin = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; mobile: string; otp: string; pin: string; name?: string }) => ({
      token: tokenSchema.parse(input.token),
      mobile: mobileSchema.parse(input.mobile),
      otp: z.string().trim().regex(/^[0-9]{6}$/).parse(input.otp),
      pin: pinSchema.parse(input.pin),
      name: z.string().trim().max(60).optional().parse(input.name ?? ""),
    }),
  )
  .handler(async ({ data }) => {
    const { hashPin, otpValid } = await import("@/lib/customer-pin.server");
    if (!otpValid(data.otp)) throw new Error("Incorrect OTP. Please try again.");
    const db = await admin();
    await requireBranch(db, data.token);
    const pin_hash = await hashPin(data.mobile, data.pin);

    const { data: existing, error: lookupError } = await db
      .from("customers")
      .select("id, name, mobile, created_at")
      .eq("mobile", data.mobile)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { data: updated, error } = await db
        .from("customers")
        .update({ pin_hash, ...(data.name ? { name: data.name } : {}) })
        .eq("id", existing.id)
        .select("id, name, mobile, created_at")
        .single();
      if (error) throw error;
      return updated;
    }

    if (!data.name || data.name.length < 2) throw new Error("Enter your name to continue.");
    const { data: created, error } = await db
      .from("customers")
      .insert({ name: data.name, mobile: data.mobile, pin_hash })
      .select("id, name, mobile, created_at")
      .single();
    if (error) throw error;
    return created;
  });

/** Returning customers sign in with mobile + 4-digit PIN. */
export const loginWithPin = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; mobile: string; pin: string }) => ({
    token: tokenSchema.parse(input.token),
    mobile: mobileSchema.parse(input.mobile),
    pin: pinSchema.parse(input.pin),
  }))
  .handler(async ({ data }) => {
    const { pinMatches } = await import("@/lib/customer-pin.server");
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: customer, error } = await db
      .from("customers")
      .select("id, name, mobile, created_at, pin_hash")
      .eq("mobile", data.mobile)
      .maybeSingle();
    if (error) throw error;
    if (!customer || !customer.pin_hash) throw new Error("Verify your mobile with OTP first.");
    if (!(await pinMatches(data.mobile, data.pin, customer.pin_hash)))
      throw new Error("Incorrect PIN.");
    const { pin_hash: _hash, ...safe } = customer;
    return safe;
  });



export const getCustomerProgress = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; customerId: string }) => ({
    token: tokenSchema.parse(input.token),
    customerId: uuidSchema.parse(input.customerId),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: rows, error } = await db
      .from("loyalty_progress")
      .select(
        "id, customer_id, product_id, purchased_count, redeemed_count, loyalty_target_at_creation, reward_quantity_at_creation",
      )
      .eq("customer_id", data.customerId);
    if (error) throw error;
    return rows ?? [];
  });

export const getCustomerHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; customerId: string }) => ({
    token: tokenSchema.parse(input.token),
    customerId: uuidSchema.parse(input.customerId),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: rows, error } = await db
      .from("transactions")
      .select(
        "id, created_at, total_amount, paid_glasses, free_glasses, payment_method, reference_no, status, branches(name, address), transaction_items(id, product_name, unit_price, paid_quantity, free_quantity, line_total)",
      )
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return rows ?? [];
  });

/** Fetch comprehensive reward history with product-specific loyalty progression and all historical rules. */
export const getRewardHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; customerId: string }) => ({
    token: tokenSchema.parse(input.token),
    customerId: uuidSchema.parse(input.customerId),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);

    // Get loyalty progress records with product info
    const { data: progressRows, error: progressError } = await db
      .from("loyalty_progress")
      .select(
        "id, product_id, purchased_count, redeemed_count, loyalty_target_at_creation, reward_quantity_at_creation, created_at, updated_at, products(name, loyalty_target, reward_quantity, loyalty_enabled)",
      )
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false });

    if (progressError) throw progressError;

    // Build reward history grouped by product
    const rewardHistory = progressRows?.map((row: any) => ({
      product_id: row.product_id,
      product_name: row.products?.name ?? "Unknown",
      current_rule: row.loyalty_target_at_creation && row.reward_quantity_at_creation
        ? `Buy ${row.loyalty_target_at_creation} Get ${row.reward_quantity_at_creation} Free`
        : "N/A",
      purchased_count: row.purchased_count,
      redeemed_count: row.redeemed_count,
      free_count: row.purchased_count > 0 
        ? Math.floor((row.purchased_count - 1) / (row.loyalty_target_at_creation || 1)) * (row.reward_quantity_at_creation || 1)
        : 0,
      started_at: row.created_at,
      last_updated: row.updated_at,
      loyalty_target_at_creation: row.loyalty_target_at_creation,
      reward_quantity_at_creation: row.reward_quantity_at_creation,
    })) ?? [];

    // Get all historical rule changes by extracting from transactions
    const ruleChangesByProduct = new Map<
      string,
      Array<{ rule: string; effective_from: string; effective_to?: string; count: number }>
    >();

    if (progressRows && progressRows.length > 0) {
      // For each product, get all transactions to track all rule changes chronologically
      for (const progress of progressRows) {
        const productId = progress.product_id;

        // Get all transactions for this product, ordered by date
        const { data: txns, error: txnError } = await db
          .from("transaction_items")
          .select(
            "transaction_id, transactions(created_at, loyalty_target, loyalty_reward)",
          )
          .eq("product_id", productId)
          .eq("transactions.customer_id", data.customerId)
          .order("transactions.created_at", { ascending: true });

        if (!txnError && txns && txns.length > 0) {
          const ruleTimeline: Array<{
            rule: string;
            effective_from: string;
            effective_to?: string;
            count: number;
          }> = [];

          let currentRule: string | null = null;
          let ruleStart: string | null = null;
          let ruleCount = 0;

          for (const item of txns as any[]) {
            if (item.transactions) {
              const target = item.transactions.loyalty_target || 1;
              const reward = item.transactions.loyalty_reward || 1;
              const ruleStr = `Buy ${target} Get ${reward} Free`;

              if (ruleStr !== currentRule) {
                // Rule changed, save the previous one
                if (currentRule !== null && ruleStart !== null) {
                  ruleTimeline.push({
                    rule: currentRule,
                    effective_from: ruleStart,
                    effective_to: item.transactions.created_at,
                    count: ruleCount,
                  });
                }
                currentRule = ruleStr;
                ruleStart = item.transactions.created_at;
                ruleCount = 1;
              } else {
                ruleCount++;
              }
            }
          }

          // Add the last rule
          if (currentRule !== null && ruleStart !== null) {
            ruleTimeline.push({
              rule: currentRule,
              effective_from: ruleStart,
              count: ruleCount,
            });
          }

          if (ruleTimeline.length > 0) {
            ruleChangesByProduct.set(productId, ruleTimeline);
          }
        }
      }
    }

    return {
      rewardHistory,
      ruleChanges: Object.fromEntries(ruleChangesByProduct),
    };
  });

/** Profile card for the account tab, including a short-lived avatar link. */
export const getCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; customerId: string }) => ({
    token: tokenSchema.parse(input.token),
    customerId: uuidSchema.parse(input.customerId),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);
    const { data: row, error } = await db
      .from("customers")
      .select("id, name, mobile, created_at, image_url")
      .eq("id", data.customerId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    let image_signed_url: string | null = null;
    if (row.image_url) {
      const { data: url } = await db.storage
        .from("product-images")
        .createSignedUrl(row.image_url, 60 * 60 * 12);
      image_signed_url = url?.signedUrl ?? null;
    }
    return { ...row, image_signed_url };
  });

/** Customers edit their own name and avatar; the image arrives as a compressed data URL. */
export const updateCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; customerId: string; name: string; imageDataUrl?: string | null }) => ({
      token: tokenSchema.parse(input.token),
      customerId: uuidSchema.parse(input.customerId),
      name: z.string().trim().min(2).max(60).parse(input.name),
      imageDataUrl: z
        .string()
        .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
        .max(3_000_000)
        .nullish()
        .parse(input.imageDataUrl ?? null),
    }),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await requireBranch(db, data.token);

    const { data: existing, error: lookupError } = await db
      .from("customers")
      .select("id, image_url")
      .eq("id", data.customerId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new Error("Customer not found.");

    const patch: { name: string; image_url?: string } = { name: data.name };

    if (data.imageDataUrl) {
      const meta = data.imageDataUrl.slice(0, data.imageDataUrl.indexOf(","));
      const base64 = data.imageDataUrl.slice(data.imageDataUrl.indexOf(",") + 1);
      const contentType = meta.slice(5, meta.indexOf(";"));
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const path = `customers/${data.customerId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await db.storage
        .from("product-images")
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      if (existing.image_url) {
        await db.storage.from("product-images").remove([existing.image_url]);
      }
      patch.image_url = path;
    }

    const { data: updated, error } = await db
      .from("customers")
      .update(patch)
      .eq("id", data.customerId)
      .select("id, name, mobile, created_at, image_url")
      .single();
    if (error) throw error;

    let image_signed_url: string | null = null;
    if (updated.image_url) {
      const { data: url } = await db.storage
        .from("product-images")
        .createSignedUrl(updated.image_url, 60 * 60 * 12);
      image_signed_url = url?.signedUrl ?? null;
    }
    return { ...updated, image_signed_url };
  });

/** Server-authoritative checkout: prices, totals and loyalty maths never come from the client. */
export const submitCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      customerId: string;
      cart: { productId: string; qty: number }[];
      redeemProductIds: string[];
      method: "cash" | "razorpay";
    }) => ({
      token: tokenSchema.parse(input.token),
      customerId: uuidSchema.parse(input.customerId),
      cart: cartSchema.parse(input.cart),
      redeemProductIds: z.array(uuidSchema).max(20).parse(input.redeemProductIds),
      method: z.enum(["cash", "razorpay"]).parse(input.method),
    }),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const branch = await requireBranch(db, data.token);

    const { data: customer, error: customerError } = await db
      .from("customers")
      .select("id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) throw new Error("Customer not found.");

    const lines = data.cart.filter((line) => line.qty > 0);
    if (lines.length === 0) throw new Error("Add at least one glass before paying.");

    const { data: products, error: productsError } = await db
      .from("products")
      .select("id, name, price, loyalty_target, loyalty_enabled, reward_quantity, is_active")
      .in(
        "id",
        lines.map((line) => line.productId),
      );
    if (productsError) throw productsError;

    const { data: progressRows, error: progressError } = await db
      .from("loyalty_progress")
      .select("id, product_id, purchased_count, redeemed_count, loyalty_target_at_creation, reward_quantity_at_creation")
      .eq("customer_id", data.customerId);
    if (progressError) throw progressError;
    const progressByProduct = new Map((progressRows ?? []).map((row) => [row.product_id, row]));

    const items = lines.map((line) => {
      const product = (products ?? []).find((row) => row.id === line.productId);
      if (!product || !product.is_active) throw new Error("A selected product is unavailable.");
      const existing = progressByProduct.get(product.id);
      const target = Number(existing?.loyalty_target_at_creation ?? product.loyalty_target ?? 1);
      const rewardQty = Math.max(1, Number(existing?.reward_quantity_at_creation ?? product.reward_quantity ?? 1));
      const loyaltyOn = product.loyalty_enabled !== false && target > 1 && rewardQty > 0;
      const purchased = existing?.purchased_count ?? 0;
      const bundleFree = loyaltyOn ? Math.floor((purchased + line.qty) / target) * rewardQty - Math.floor(purchased / target) * rewardQty : 0;
      const free = data.redeemProductIds.includes(product.id) ? Math.min(bundleFree, line.qty) : 0;
      const paid = Math.max(0, line.qty - free);
      return {
        product_id: product.id,
        product_name: product.name,
        unit_price: Number(product.price),
        paid_quantity: paid,
        free_quantity: free,
        line_total: paid * Number(product.price),
        loyalty_target: target,
        loyalty_reward: rewardQty,
      };
    });

    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    const paidGlasses = items.reduce((sum, item) => sum + item.paid_quantity, 0);
    const freeGlasses = items.reduce((sum, item) => sum + item.free_quantity, 0);
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const reference = `${data.method === "cash" ? "CASH" : "RZP"}-${Date.now().toString().slice(-6)}${rand}`;

    const { data: txn, error: txnError } = await db
      .from("transactions")
      .insert({
        branch_id: branch.id,
        customer_id: data.customerId,
        total_amount: total,
        paid_glasses: paidGlasses,
        free_glasses: freeGlasses,
        payment_method: data.method,
        reference_no: reference,
        status: "success",
      })
      .select("id")
      .single();
    if (txnError) throw txnError;

    const { error: itemsError } = await db.from("transaction_items").insert(
      items.map((item) => ({
        transaction_id: txn.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        paid_quantity: item.paid_quantity,
        free_quantity: item.free_quantity,
        line_total: item.line_total,
      })),
    );
    if (itemsError) throw itemsError;

    for (const item of items) {
      const current = progressByProduct.get(item.product_id);
      const ruleTarget = Number(current?.loyalty_target_at_creation ?? item.loyalty_target ?? 1);
      const ruleReward = Math.max(1, Number(current?.reward_quantity_at_creation ?? item.loyalty_reward ?? 1));
      const nextPurchased = (current?.purchased_count ?? 0) + item.paid_quantity;
      const nextRedeemed = (current?.redeemed_count ?? 0) + item.free_quantity;

      if (current) {
        const { error } = await db
          .from("loyalty_progress")
          .update({
            purchased_count: nextPurchased,
            redeemed_count: nextRedeemed,
            loyalty_target_at_creation: current.loyalty_target_at_creation ?? ruleTarget,
            reward_quantity_at_creation: current.reward_quantity_at_creation ?? ruleReward,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("loyalty_progress").insert({
          customer_id: data.customerId,
          product_id: item.product_id,
          purchased_count: nextPurchased,
          redeemed_count: nextRedeemed,
          loyalty_target_at_creation: ruleTarget,
          reward_quantity_at_creation: ruleReward,
        });
        if (error) throw error;
      }
    }

    return {
      transactionId: txn.id,
      reference,
      total,
      freeGlasses,
      items: items.map((item) => ({
        name: item.product_name,
        paid: item.paid_quantity,
        free: item.free_quantity,
        amount: item.line_total,
      })),
    };
  });
