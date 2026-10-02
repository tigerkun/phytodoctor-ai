import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  scoreFromStanding,
  resolveDuel,
  nextRival,
  ARENA_RIVALS,
  WEEKLY_FREE_DUELS,
  ARENA_WIN_SEEDS,
} from '../../game/arenaScoring';

/**
 * The Arena makes one promise to the Keeper, and it is the whole reason the
 * page is allowed to exist: you win by caring, not by pressing a button. If a
 * future change makes the score a dice roll, a constant, or something that
 * ignores the player's actual plants, the page becomes a decoration and this
 * test is the only thing between it and a lie.
 */

const score = scoreFromStanding;

describe('Arena score — care is what moves it', () => {
  it('rewards a healthier specimen', () => {
    expect(score({ bestGuardianScore: 100, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }))
      .toBeGreaterThan(score({ bestGuardianScore: 20, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }));
  });

  it('rewards a longer streak', () => {
    expect(score({ bestGuardianScore: 60, currentStreak: 14, checkInCount: 0, discoveredCount: 0 }))
      .toBeGreaterThan(score({ bestGuardianScore: 60, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }));
  });

  it('rewards logging check-ins', () => {
    expect(score({ bestGuardianScore: 60, currentStreak: 0, checkInCount: 20, discoveredCount: 0 }))
      .toBeGreaterThan(score({ bestGuardianScore: 60, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }));
  });

  it('rewards discovering species', () => {
    expect(score({ bestGuardianScore: 60, currentStreak: 0, checkInCount: 0, discoveredCount: 12 }))
      .toBeGreaterThan(score({ bestGuardianScore: 60, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }));
  });

  it('never leaves the 0..100 band the ladder is calibrated against', () => {
    for (const standing of [
      { bestGuardianScore: 0, currentStreak: 0, checkInCount: 0, discoveredCount: 0 },
      { bestGuardianScore: 100, currentStreak: 999, checkInCount: 9999, discoveredCount: 999 },
      { bestGuardianScore: 55, currentStreak: 7, checkInCount: 11, discoveredCount: 5 },
    ]) {
      const value = score(standing);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('is a pure function — the same record always scores the same', () => {
    const standing = { bestGuardianScore: 77, currentStreak: 5, checkInCount: 9, discoveredCount: 3 };
    expect(score(standing)).toBe(score(standing));
  });

  it('gives a new Keeper almost nothing, so the first rung is winnable', () => {
    // A brand-new Keeper who greets the page with a defeat has been told, in
    // the first ten seconds, that the thing is not for them.
    expect(score({ bestGuardianScore: 0, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }))
      .toBeLessThan(ARENA_RIVALS[0].threshold);
  });

  it('lets a genuinely dedicated Keeper reach the top of the ladder', () => {
    const top = ARENA_RIVALS[ARENA_RIVALS.length - 1];
    expect(score({ bestGuardianScore: 100, currentStreak: 30, checkInCount: 40, discoveredCount: 20 }))
      .toBeGreaterThanOrEqual(top.threshold);
  });

  it('is not decided by any one input alone', () => {
    const top = ARENA_RIVALS[ARENA_RIVALS.length - 1];
    // A perfect plant and nothing else must not already clear the ladder,
    // or the streak and the log would be pointless.
    expect(score({ bestGuardianScore: 100, currentStreak: 0, checkInCount: 0, discoveredCount: 0 }))
      .toBeLessThan(top.threshold);
  });
});

describe('duel resolution is the score, not a roll', () => {
  const rival = ARENA_RIVALS[1];

  it('wins only above the threshold', () => {
    expect(resolveDuel(rival.threshold + 1, rival)).toBe('win');
    expect(resolveDuel(rival.threshold, rival)).toBe('draw');
    expect(resolveDuel(rival.threshold - 1, rival)).toBe('loss');
  });

  it('is deterministic — the same score always gives the same outcome', () => {
    for (let i = 0; i < 25; i++) {
      expect(resolveDuel(60, rival)).toBe(resolveDuel(60, rival));
    }
  });

  it('contains no randomness anywhere in the module', () => {
    // Comment lines are stripped first. The module's own doc comment names
    // `Math.random` to explain what it must never contain, so a raw text scan
    // matched the explanation and failed the module for documenting the rule.
    const source = readFileSync(resolve(__dirname, '../../game/arenaScoring.ts'), 'utf8');
    const code = source
      .split('\n')
      .filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/Math\.random|Date\.now|crypto\.randomUUID/);
  });
});

describe('the ladder', () => {
  it('is strictly ascending, so progress is always forward', () => {
    for (let i = 1; i < ARENA_RIVALS.length; i++) {
      expect(ARENA_RIVALS[i].threshold).toBeGreaterThan(ARENA_RIVALS[i - 1].threshold);
    }
  });

  it('always offers a fight — a strong Keeper faces the top rung rather than none', () => {
    expect(nextRival(0)).toBe(ARENA_RIVALS[0]);
    expect(nextRival(ARENA_RIVALS[1].threshold - 1)).toBe(ARENA_RIVALS[1]);
    expect(nextRival(100)).toBe(ARENA_RIVALS[ARENA_RIVALS.length - 1]);
  });
});

describe('Arena honesty', () => {
  it('caps free duels at the same allowance canStartCareOff enforces', () => {
    // The page must not advertise a different number than the service that
    // actually counts them, or the two quietly disagree.
    const service = readFileSync(resolve(__dirname, '../../services/gameService.ts'), 'utf8');
    expect(service).toMatch(/return count < 3/);
    expect(WEEKLY_FREE_DUELS).toBe(3);
  });

  it('credits the same win reward the economy config declares', () => {
    const economy = readFileSync(resolve(__dirname, '../../game/ECONOMY_DATA.ts'), 'utf8');
    expect(economy).toMatch(/arena_win:\s*(\d+)/);
    const declared = Number(economy.match(/arena_win:\s*(\d+)/)![1]);
    expect(ARENA_WIN_SEEDS).toBe(declared);
  });

  it('tells the Keeper the rivals are benchmarks, not other players', () => {
    const page = readFileSync(resolve(__dirname, '../Arena.tsx'), 'utf8');
    expect(page).toMatch(/not other players/i);
  });
});
