# Loyalty Logic

This document describes how product loyalty rules, customer progress, rewards, rule changes, and checkout history work in CaneWorld.

## Core rule

Each product has its own loyalty card. A rule consists of:

- `loyalty_enabled`: whether the product earns rewards.
- `loyalty_target`: paid quantity required, such as `5` in Buy 5 Get 1.
- `reward_quantity`: free quantity earned, such as `1`.

Products do not share progress. Buying one size or product never advances another product's card.

## Database records

### `products`

Stores the currently configured rule. Admin changes update this record.

### `loyalty_progress`

Stores one current cycle for each customer/product pair:

- `customer_id`, `product_id`: identify the loyalty card.
- `purchased_count`: paid items accumulated in the current cycle.
- `redeemed_count`: rewards already consumed in that cycle.
- `loyalty_target_at_creation`: target locked for the active cycle.
- `reward_quantity_at_creation`: reward quantity locked for the active cycle.
- `loyalty_rule_locked`: whether the current cycle must continue using its saved rule.

### `transactions` and `transaction_items`

`transactions` stores the sale totals and payment details. `transaction_items` stores paid/free quantities and snapshots the loyalty rule attributed to each item at checkout:

- `paid_quantity`
- `free_quantity`
- `loyalty_target_at_purchase`
- `reward_quantity_at_purchase`

Historical snapshots must not be recalculated from the current product rule.

## Rule locking

Once a customer has paid progress in a cycle, that cycle keeps its original rule even if an admin edits the product.

Example:

1. Product rule is Buy 5 Get 1.
2. Customer buys 3. Progress is `3 / 5`; Buy 5 is locked for this cycle.
3. Admin changes the product to Buy 6 Get 1.
4. The customer still needs 2 paid items to finish the locked Buy 5 cycle.
5. After redemption, the next paid cycle uses Buy 6.

This prevents an admin edit from unfairly changing an already-started card.

## Checkout calculation

The server is authoritative. Prices, paid/free quantities, totals, and progress are recalculated in `submitCheckout`; client previews do not determine the saved result.

For each cart line:

1. Load the customer's existing progress.
2. Use the locked snapshot when the current cycle has paid progress; otherwise use the latest product rule.
3. Calculate the largest free quantity supported by existing progress plus the paid part of the cart.
4. Apply free quantity only when the customer chooses redemption.
5. Charge `paid_quantity × current product price`.
6. Save immutable transaction rule snapshots.
7. Update the next loyalty cycle.

The reward calculation is:

```text
earned free quantity = floor(total paid quantity / target) × reward quantity
```

The checkout solver reduces the free portion until the paid portion plus existing progress earns enough rewards to cover it.

## Mixed redemption after a rule change

Example: the customer completed Buy 5 Get 1, the admin changed the live rule to Buy 6 Get 1, and the customer selects two items.

- One item is free under the completed Buy 5 rule.
- One item is paid.
- The paid item starts the new Buy 6 cycle at `1 / 6`.
- Transaction history stores the free and paid portions separately so each portion displays the correct rule.
- The bill total remains the price of one item.

If a redemption contains no paid item, the new empty cycle remains unlocked. It will use whatever product rule is active when the next paid purchase occurs.

## Client display

The branch portal reads `loyalty_progress` after checkout and displays the effective locked rule. React Query invalidates the customer's progress after successful payment so the new cycle is fetched from the server.

Transaction history uses the saved transaction snapshots. It must never label an old sale using today's product configuration.

## Useful SQL queries

Run these in the Supabase SQL editor. Replace placeholder UUIDs/tokens before execution.

### Inspect a customer's current loyalty cards

```sql
select
  lp.customer_id,
  p.name as product_name,
  lp.purchased_count,
  lp.redeemed_count,
  lp.loyalty_target_at_creation,
  lp.reward_quantity_at_creation,
  lp.loyalty_rule_locked,
  p.loyalty_target as live_target,
  p.reward_quantity as live_reward,
  lp.updated_at
from public.loyalty_progress lp
join public.products p on p.id = lp.product_id
where lp.customer_id = 'CUSTOMER_UUID'
order by p.name;
```

### Inspect transaction history with saved rules

```sql
select
  t.created_at,
  t.reference_no,
  ti.product_name,
  ti.paid_quantity,
  ti.free_quantity,
  ti.line_total,
  ti.loyalty_target_at_purchase,
  ti.reward_quantity_at_purchase
from public.transactions t
join public.transaction_items ti on ti.transaction_id = t.id
where t.customer_id = 'CUSTOMER_UUID'
order by t.created_at desc, ti.product_name;
```

### Look up the branch encoded by a QR token

```sql
select id, name, status, qr_token
from public.branches
where qr_token = 'QR_TOKEN';
```

### Find progress whose locked rule differs from the current product rule

This is expected when an admin changes a rule during an active customer cycle.

```sql
select
  lp.customer_id,
  p.name,
  lp.purchased_count,
  lp.loyalty_target_at_creation as locked_target,
  p.loyalty_target as live_target,
  lp.reward_quantity_at_creation as locked_reward,
  p.reward_quantity as live_reward
from public.loyalty_progress lp
join public.products p on p.id = lp.product_id
where lp.loyalty_rule_locked = true
  and (
    lp.loyalty_target_at_creation is distinct from p.loyalty_target
    or lp.reward_quantity_at_creation is distinct from p.reward_quantity
  )
order by p.name, lp.customer_id;
```

## Safety rules for future changes

- Never trust price, total, or free quantity submitted by the browser.
- Never overwrite historical loyalty snapshots when an admin edits a product.
- Count only paid items toward the next cycle; free items do not earn progress.
- Keep service-role credentials on the server and never prefix them with `VITE_`.
- Add a regression test for every new boundary case in `tests/loyalty-calculations.test.mjs`.

## Relevant source files

- `src/lib/loyalty-calculations.ts`: pure reward calculations.
- `src/lib/loyalty.ts`: client-facing loyalty helpers and previews.
- `src/lib/branch.functions.ts`: authoritative checkout and database updates.
- `src/components/branch/CustomerProfile.tsx`: reward and transaction-history display.
- `tests/loyalty-calculations.test.mjs`: loyalty calculation regression tests.
- `supabase/migrations/`: database schema and loyalty snapshot migrations.
