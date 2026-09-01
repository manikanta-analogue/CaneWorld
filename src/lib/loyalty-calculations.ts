/** Pure loyalty maths shared by the checkout and all client previews. */
export function freeRewardsFromPurchases(purchased: number, target: number, rewardQty: number) {
  if (!Number.isFinite(target) || target <= 1 || !Number.isFinite(rewardQty) || rewardQty <= 0) return 0;
  return Math.floor(Math.max(0, purchased) / target) * rewardQty;
}

/**
 * Finds the largest free quantity that can be included in this line while the
 * paid part of the line earns enough rewards to cover it.
 */
export function redeemableFreeQuantityForRule(
  purchased: number,
  redeemed: number,
  cartQty: number,
  target: number,
  rewardQty: number,
) {
  if (target <= 1 || rewardQty <= 0 || cartQty <= 0) return 0;
  for (let free = Math.floor(cartQty); free >= 0; free -= 1) {
    const paid = cartQty - free;
    if (freeRewardsFromPurchases(purchased + paid, target, rewardQty) >= redeemed + free) return free;
  }
  return 0;
}
