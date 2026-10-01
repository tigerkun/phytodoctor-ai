import { describe, it, expect } from 'vitest';
import { GuestQuota } from '../guestQuota';

/**
 * The guest lane is the only unauthenticated door to the model, so its
 * arithmetic is worth pinning: the cap must hold, a denial must not burn
 * quota, the counters must be per-IP and per-day, and the backing map must
 * not grow for the life of the process.
 */

const DAY = '2026-09-30';
const NEXT_DAY = '2026-10-01';
const IP = '203.0.113.7';

describe('GuestQuota', () => {
  it('grants up to the limit and refuses the next one', () => {
    const quota = new GuestQuota(2);
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(true);
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(true);
    const third = quota.take(IP, DAY, 'identify');
    expect(third.allowed).toBe(false);
    expect(third.used).toBe(2);
  });

  it('does not consume quota on a denial, so the gate stays stable under hammering', () => {
    const quota = new GuestQuota(1);
    quota.take(IP, DAY, 'identify');
    for (let i = 0; i < 5; i++) {
      expect(quota.take(IP, DAY, 'identify').allowed).toBe(false);
    }
    expect(quota.peek(IP, DAY, 'identify')).toBe(1);
  });

  it('counts each address and each day separately', () => {
    const quota = new GuestQuota(1);
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(true);
    // A different address on the same day is unaffected...
    expect(quota.take('198.51.100.4', DAY, 'identify').allowed).toBe(true);
    // ...and so is the same address tomorrow.
    expect(quota.take(IP, NEXT_DAY, 'identify').allowed).toBe(true);
    // Yesterday's spent quota is still visible inside the retention window.
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(false);
  });

  it('keeps actions from sharing a budget', () => {
    const quota = new GuestQuota(1);
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(true);
    expect(quota.take(IP, DAY, 'assess').allowed).toBe(true);
    expect(quota.take(IP, DAY, 'identify').allowed).toBe(false);
  });

  it('drops expired days so the map cannot grow forever', () => {
    const quota = new GuestQuota(5);
    for (let day = 1; day <= 28; day++) {
      quota.take(IP, `2026-09-${String(day).padStart(2, '0')}`, 'identify');
    }
    // Retention is 2 days, so walking the month leaves yesterday and today.
    expect(quota.size).toBeLessThanOrEqual(2);

    // A stale counter cannot be resurrected by rolling the clock back.
    expect(quota.take(IP, '2026-09-01', 'identify').allowed).toBe(true);
  });
});