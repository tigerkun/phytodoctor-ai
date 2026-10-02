import { describe, it, expect } from 'vitest';
import { refundValueFor, SEEDS_PER_RUPEE, volumeDiscountPct, lineSeedCost, lineRefundRupees } from '../marketPricing';

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

describe('cart volume pricing', () => {
  it('has two legible tiers and nothing below one unit', () => {
    expect(volumeDiscountPct(1)).toBe(0);
    expect(volumeDiscountPct(2)).toBe(5);
    expect(volumeDiscountPct(3)).toBe(5);
    expect(volumeDiscountPct(4)).toBe(10);
    expect(volumeDiscountPct(9)).toBe(10);
    expect(volumeDiscountPct(0)).toBe(0);
  });

  it('applies the tier to the whole line, not per extra unit', () => {
    // A line of four at 1000 seeds costs 10% off all four: 3600, not
    // 1000 + 950 + 950 + 900.
    expect(lineSeedCost(1000, 4)).toBe(3600);
    expect(lineSeedCost(1000, 2)).toBe(1900);
    expect(lineSeedCost(1000, 1)).toBe(1000);
  });

  it('rounds the discounted line, never the unit price first', () => {
    // Rounding before multiplying would let a price differ by a seed between
    // the sidebar and the checkout total. Both call the same function.
    expect(lineSeedCost(715, 4)).toBe(Math.round(715 * 4 * 0.9));
  });

  it('scales the tracked refund with quantity', () => {
    // Buying two of something records twice the discount — the claim is a
    // share of the real cash paid, and the cash paid doubled.
    expect(lineRefundRupees(449, 1)).toBe(refundValueFor({ cashPrice: 449 }));
    expect(lineRefundRupees(449, 3)).toBe(refundValueFor({ cashPrice: 449 }) * 3);
  });
});
