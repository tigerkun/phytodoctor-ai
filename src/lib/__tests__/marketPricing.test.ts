import { describe, it, expect } from 'vitest';
import { refundValueFor, SEEDS_PER_RUPEE } from '../marketPricing';

describe('refundValueFor', () => {
  it('is a share of the real cash price, not of the seed price', () => {
    // The regression this exists to prevent: refund was seedPrice/200, which
    // is only a 12% discount at the OLD 20 seeds/rupee rate. At today's rate
    // the same formula returns ~3% of the sticker — the discount silently
    // collapses the moment the seed economy is rebalanced.
    expect(refundValueFor({ cashPrice: 349 })).toBe(42); // 12% of 349
    expect(refundValueFor({ cashPrice: 199 })).toBe(24); // 12% of 199
  });

  it('does not drift when the seed rate changes', () => {
    // The whole point: the discount is derived from cashPrice, so seedPrice —
    // and therefore SEEDS_PER_RUPEE — cannot move it. Assert against the old
    // formula at today's rate to prove the two disagree.
    const cashPrice = 449;
    const seedPrice = cashPrice * SEEDS_PER_RUPEE;
    expect(refundValueFor({ cashPrice })).not.toBe(Math.floor(seedPrice / 200));
    expect(refundValueFor({ cashPrice })).toBe(54); // 12% of 449
  });

  it('never returns a discount too small to be a real code', () => {
    // Cheap items would otherwise round to ₹0 or ₹1, which reads as a broken
    // promise on the card rather than a discount.
    expect(refundValueFor({ cashPrice: 10 })).toBe(10);
    expect(refundValueFor({ cashPrice: 0 })).toBe(10);
  });

  it('always leaves a positive payable amount on the item', () => {
    // The card renders cashPrice - refundValue as the price after refund, so a
    // discount larger than the sticker would show a negative price.
    for (const cashPrice of [49, 99, 149, 199, 299, 349, 449, 599, 799, 1299, 2499]) {
      const refund = refundValueFor({ cashPrice });
      expect(cashPrice - refund).toBeGreaterThan(0);
    }
  });
});
