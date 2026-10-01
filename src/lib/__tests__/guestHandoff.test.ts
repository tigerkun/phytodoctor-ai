import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rememberAuthReturn, consumeAuthReturn, stashPendingScan, takePendingScan, clearPendingScan } from '../guestHandoff';

/**
 * The guest handoff is the difference between a funnel that converts and one
 * that leaks: a visitor diagnoses a plant, is asked to sign up, and must find
 * their diagnosis still on the bench when they come back.
 */

// A minimal sessionStorage; the repo has no DOM environment configured, so this
// follows the same hand-rolled stub convention the other suites use.
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal('sessionStorage', fakeStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('auth return', () => {
  it('sends the visitor back where they were going', () => {
    rememberAuthReturn('/market');
    expect(consumeAuthReturn('/')).toBe('/market');
  });

  it('is a one-shot: a second sign-in lands on the default page', () => {
    rememberAuthReturn('/market');
    consumeAuthReturn('/');
    expect(consumeAuthReturn('/')).toBe('/');
  });

  it('ignores a stored value that is not an app path', () => {
    fakeStorage.setItem('phyto_auth_return', 'https://evil.example/steal');
    expect(consumeAuthReturn('/')).toBe('/');
  });
});

describe('pending scan', () => {
  it('carries the diagnosis across the sign-up wall, once', () => {
    stashPendingScan('data:image/jpeg;base64,AAA', { speciesName: 'Monstera deliciosa' });
    const restored = takePendingScan();
    expect(restored?.image).toBe('data:image/jpeg;base64,AAA');
    expect((restored?.result as any).speciesName).toBe('Monstera deliciosa');
    // Taken, not copied: a reload must not resurrect it.
    expect(takePendingScan()).toBeNull();
  });

  it('discards a scan older than the handoff window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    stashPendingScan('data:image/jpeg;base64,AAA', { speciesName: 'Monstera' });
    vi.setSystemTime(new Date('2026-09-30T10:31:00Z'));
    expect(takePendingScan()).toBeNull();
  });

  it('clears a handoff the visitor dismissed instead of keeping it', () => {
    stashPendingScan('data:image/jpeg;base64,AAA', { speciesName: 'Monstera' });
    clearPendingScan();
    expect(takePendingScan()).toBeNull();
  });

  it('survives a storage write failure rather than throwing at the save moment', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
      clear: () => {},
    });
    // The visitor still has the diagnosis on screen; the restore is a bonus.
    expect(() => stashPendingScan('data:image/jpeg;base64,AAA', { a: 1 })).not.toThrow();
    expect(takePendingScan()).toBeNull();
  });
});