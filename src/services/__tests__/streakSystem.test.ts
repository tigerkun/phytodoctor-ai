import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db/database';

/**
 * Regression cover for the streak, which is the retention spine: it gates the
 * seed multiplier and the daily reward. Two things were quietly broken.
 *
 *  1. A brand-new keeper sat on a 0-day streak. `ensureStreakRecord` stamps a
 *     fresh record with *today's* date, so the first upload matched the
 *     "already logged in today" branch and returned the record untouched.
 *  2. Freezes protected nothing. `useStreakFreeze` had no callers, and the
 *     streak-break path reset to 1 without ever consulting the allowance, so a
 *     keeper holding two freezes still lost the run on a single missed day.
 *
 * The fix spends a freeze on exactly the one gap that can be covered, and lets
 * purchased freezes sit above the tier cap -- otherwise buying one would be a
 * no-op for exactly the established keepers most likely to buy.
 */

const USER = 'sb_test-user';

let streakRow: any = null;
let freezeRow: any = null;
let profile: any = { id: USER, tier: 'keeper' };
let realLocalStorage: any;

function installFakeTables() {
  vi.spyOn(db.streakRecords, 'get').mockImplementation((async (key: string) =>
    streakRow && streakRow.userId === key ? { ...streakRow } : undefined) as any);
  vi.spyOn(db.streakRecords, 'put').mockImplementation((async (row: any) => {
    streakRow = { ...row };
    return row.key ?? row.userId;
  }) as any);

  vi.spyOn(db.streakFreezes, 'get').mockImplementation((async (key: [string, string]) =>
    freezeRow && freezeRow.userId === key[0] && freezeRow.monthYear === key[1]
      ? { ...freezeRow }
      : undefined) as any);
  vi.spyOn(db.streakFreezes, 'add').mockImplementation((async (row: any) => {
    freezeRow = { ...row };
    return row.id;
  }) as any);
  vi.spyOn(db.streakFreezes, 'put').mockImplementation((async (row: any) => {
    freezeRow = { ...row };
    return row.id;
  }) as any);

  vi.spyOn(db.userProfile, 'get').mockImplementation((async () => profile) as any);
}

/** Pins "now" so the local-date arithmetic is deterministic. */
function setClock(isoDay: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${isoDay}T12:00:00`));
}

const D1 = '2026-03-10'; // first day
const D2 = '2026-03-11'; // consecutive
const D4 = '2026-03-13'; // two-day gap after D1
const MONTH = '2026-03';

async function service() {
  return (await import('../rewardService')).RewardService;
}

/** The implicit `freeze` passed to every call site. */
async function reward() {
  return (await service()).updateStreakOnUpload(USER);
}

beforeEach(() => {
  streakRow = null;
  freezeRow = null;
  profile = { id: USER, tier: 'keeper' };
  realLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k: string) => (k === 'botanical_guardian_userId' ? USER : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  } as any;
  installFakeTables();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.localStorage = realLocalStorage;
});

describe('streak: first activity', () => {
  it('starts a brand-new keeper at 1, not 0', async () => {
    setClock(D1);
    const r = await reward();
    expect(r.currentStreak).toBe(1);
  });

  it('does not double-count a second activity on the same day', async () => {
    setClock(D1);
    await reward();
    const r = await reward();
    expect(r.currentStreak).toBe(1);
    expect(r.continuedToday).toBe(false);
  });

  it('replays the fix against the exact row a new keeper starts with', async () => {
    // The on-disk shape `ensureStreakRecord` writes: today's date, streak of 0.
    setClock(D1);
    streakRow = {
      userId: USER, currentStreak: 0, longestStreak: 0, lastLoginDate: D1,
      streakMultiplier: 1.0, freezesAvailableThisMonth: 0, freezesUsedThisMonth: 0,
      nextResetDate: '2026-04-01',
    };
    const r = await reward();
    expect(r.currentStreak).toBe(1);
  });
});

describe('streak: consecutive days', () => {
  it('increments and reports the run as continued', async () => {
    setClock(D1);
    await reward();
    setClock(D2);
    const r = await reward();
    expect(r.currentStreak).toBe(2);
    expect(r.continuedToday).toBe(true);
  });
});

describe('streak: a gap', () => {
  it('spends a freeze to bridge the gap instead of resetting', async () => {
    setClock(D1);
    await reward();
    setClock(D2);
    await reward(); // streak = 2

    setClock(D4);
    const r = await reward();
    expect(r.freezeUsed).toBe(true);
    // Preserved and extended, not collapsed back to 1.
    expect(r.currentStreak).toBe(3);
  });

  it('spends exactly one freeze no matter how long the gap is', async () => {
    const RewardService = await service();
    setClock(D1);
    await reward();
    await RewardService.grantFreezes(USER, 1);
    const before = await RewardService.getFreezeBalance(USER);

    setClock(D4);
    await reward();

    expect(await RewardService.getFreezeBalance(USER)).toBe(before - 1);
  });

  it('resets to 1 when the allowance is exhausted', async () => {
    setClock(D1);
    await reward();
    setClock(D2);
    await reward(); // streak = 2

    freezeRow = {
      id: 'f1', userId: USER, monthYear: MONTH,
      freezesRemaining: 0, freezesUsed: 2, tier: 'keeper', lastUsedAt: null,
    };
    setClock(D4);
    const r = await reward();
    expect(r.freezeUsed).toBe(false);
    expect(r.currentStreak).toBe(1);
  });

  it('keeps the longest run even after the current one breaks', async () => {
    setClock(D1);
    await reward();
    setClock(D2);
    await reward(); // streak = 2

    freezeRow = {
      id: 'f1', userId: USER, monthYear: MONTH,
      freezesRemaining: 0, freezesUsed: 2, tier: 'keeper', lastUsedAt: null,
    };
    setClock('2026-03-20');
    await reward();

    expect(streakRow.currentStreak).toBe(1);
    expect(streakRow.longestStreak).toBe(2);
  });
});

describe('freeze allowance', () => {
  it('grants the tier allowance to a keeper who has no row yet', async () => {
    const RewardService = await service();
    // The row is written lazily on read: a first upload never reaches the gap
    // path, so without this the newest keepers would be shown 0 freezes.
    expect(await RewardService.getFreezeBalance(USER)).toBe(2); // keeper = level 14
  });

  it('shows the tier allowance after a first-ever upload', async () => {
    const RewardService = await service();
    setClock(D1);
    await reward();
    expect(await RewardService.getFreezeBalance(USER)).toBe(2);
  });

  it('scales the allowance by tier', async () => {
    const RewardService = await service();
    expect(RewardService.tierFreezeAllowance('pro')).toBe(1);
    expect(RewardService.tierFreezeAllowance('keeper')).toBe(2);
    expect(RewardService.tierFreezeAllowance('sprout')).toBe(1);
  });

  it('lets purchased freezes exceed the tier allowance', async () => {
    const RewardService = await service();
    setClock(D1);
    await reward();
    // 2 from the tier + 3 bought. Capping here would make buying a no-op for
    // exactly the established keepers most likely to buy.
    expect(await RewardService.grantFreezes(USER, 3)).toBe(5);
  });

  it('counts bought freezes toward bridging a real gap', async () => {
    const RewardService = await service();
    setClock(D1);
    await reward();
    setClock(D2);
    await reward();

    await RewardService.grantFreezes(USER, 1);

    setClock(D4);
    const r = await reward();
    expect(r.freezeUsed).toBe(true);
    expect(r.currentStreak).toBe(3);
  });

  it('tops the first grant up with the tier allowance', async () => {
    const RewardService = await service();
    // No row yet, so the keeper's 2 tier freezes come first: 2 + 5.
    expect(await RewardService.grantFreezes(USER, 5)).toBe(7);
  });

  it('ignores a non-positive grant', async () => {
    const RewardService = await service();
    const before = await RewardService.grantFreezes(USER, 5);
    expect(await RewardService.grantFreezes(USER, 0)).toBe(before);
    expect(await RewardService.grantFreezes(USER, -3)).toBe(before);
  });

  it('refreshes a stale allowance when the tier has since changed', async () => {
    const RewardService = await service();

    // Build a real run first, so the next call lands on the gap path.
    setClock(D1);
    await reward();
    setClock(D2);
    await reward(); // streak = 2

    // A sprout row exhausted last month, now carried by a keeper. Left as-is
    // it would read 0 and reset the run to 1.
    freezeRow = {
      id: 'f1', userId: USER, monthYear: MONTH,
      freezesRemaining: 0, freezesUsed: 1, tier: 'sprout', lastUsedAt: null,
    };

    setClock(D4);
    const r = await reward();
    // Refreshed to the keeper allowance of 2, then spent one covering the gap.
    expect(r.freezeUsed).toBe(true);
    expect(r.currentStreak).toBe(3);
    expect(await RewardService.getFreezeBalance(USER)).toBe(1);
  });
});
