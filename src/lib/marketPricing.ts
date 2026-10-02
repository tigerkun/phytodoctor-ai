/**
 * Market pricing helpers that must stay consistent across every card that
 * renders them.
 *
 * These live outside the page component on purpose. The seed-refund discount
 * used to be computed inline in two separate cards, and the two drifted apart:
 * one was fixed when the seed rate was rebalanced and the other was not, so
 * most of the market quietly charged 3x the intended discount. A single
 * exported function cannot drift.
 */

/** Seeds per rupee the stall is priced at. */
export const SEEDS_PER_RUPEE = 6;

/**
 * The tracked ₹ discount a claimed seed-refund is worth.
 *
 * This is a share of the item's REAL cash price on purpose. It used to be
 * `seedPrice / 200`, which is only correct at the old 20-seeds-per-rupee rate.
 * Once the rate moved to {@link SEEDS_PER_RUPEE}, that same formula collapsed
 * to ~3% of the sticker and the discount became meaningless — so it is derived
 * from `cashPrice` instead, which no seed rebalance can move.
 *
 * Floored at ₹10 so a cheap item still yields a redeemable-looking code rather
 * than a rounding artefact of `₹0`.
 */
export function refundValueFor(product: { cashPrice: number }): number {
  return Math.max(10, Math.round(product.cashPrice * 0.12));
}
