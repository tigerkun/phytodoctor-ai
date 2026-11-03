/**
 * localStorage with an in-memory fallback. Storage can be unavailable in
 * practice — Safari private mode throws on access, the node test
 * environment has none — and a feature that crashed on storage would be
 * worse than one that merely forgot preferences between sessions.
 *
 * One shared implementation: the reminder engine, the library engagement
 * maths and anything else device-local goes through here.
 */

const memoryStore = new Map<string, string>();

export const safeStore = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key) ?? memoryStore.get(key) ?? null; } catch { return memoryStore.get(key) ?? null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { memoryStore.set(key, value); }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* noop */ }
    memoryStore.delete(key);
  },
};
