import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The market's purchased state — punched tickets, claimed refunds, basket,
 * wishlist — is bought with seeds, so it must survive a browser-data wipe and
 * must never leak between accounts on a shared device.
 *
 * It used to live in four browser-wide localStorage keys (`phyto_stall_*`).
 * Both of those promises were broken: clearing site data took purchased
 * tickets with it, and the keys carried no user id, so every account on the
 * device shared one basket and one claim history. The live copy is now a
 * user-scoped row in Dexie (`marketLedger`, schema v22), with a one-time
 * import of whatever the old keys held.
 *
 * No DOM test environment exists (see AGENTS.md), so these are source-level:
 * they read the shipped source with comments stripped and assert on what the
 * code actually does. Each has been mutation-verified — reverting the
 * behaviour turns exactly the matching assertion red.
 */

function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const dbSource = stripJsComments(readFileSync(join(process.cwd(), 'src/db/database.ts'), 'utf8'));
const typesSource = stripJsComments(readFileSync(join(process.cwd(), 'src/types.ts'), 'utf8'));
const market = stripJsComments(readFileSync(join(process.cwd(), 'src/pages/Market.tsx'), 'utf8'));

const LEGACY_KEYS = ['phyto_stall_cart', 'phyto_stall_wish', 'phyto_stall_tickets', 'phyto_stall_refunds'];

describe('the marketLedger schema', () => {
  it('exists, is user-scoped, and was added as schema v22', () => {
    expect(dbSource).toMatch(/version\(22\)\.stores\(\{\s*marketLedger:\s*'userId'/);
  });

  it('declares the table on the database class', () => {
    expect(dbSource).toMatch(/marketLedger!\s*:\s*Table<MarketLedgerRow>/);
  });

  it('types the row with every piece of purchased state', () => {
    expect(typesSource).toMatch(/export interface MarketLedgerRow \{/);
    for (const field of ['userId', 'refunds', 'claimedItemIds', 'tickets', 'wishlist', 'cart', 'updatedAt']) {
      expect(typesSource, `MarketLedgerRow.${field} is missing`).toMatch(new RegExp(`MarketLedgerRow \\{[^}]*${field}:`));
    }
  });

  it('keeps ClaimedRefund where the ledger can persist it', () => {
    expect(typesSource).toMatch(/export interface ClaimedRefund \{/);
    expect(market).toMatch(/import type \{ ClaimedRefund, MarketLedgerRow \} from '\.\.\/types'/);
  });
});

describe('the market page reads and writes the ledger', () => {
  it('never writes purchased state to localStorage any more', () => {
    // The old code had four setItem effects plus one inline inside a state
    // updater. Any one of them returning would quietly resurrect the
    // browser-wide, clearable, shared-across-accounts copy.
    for (const key of LEGACY_KEYS) {
      expect(market, `localStorage.setItem with ${key} came back`).not.toContain(`localStorage.setItem`);
    }
    expect(market).not.toMatch(/localStorage\.setItem/);
  });

  it('hydrates the mirrors from the user-scoped row', () => {
    expect(market).toMatch(/useLiveQuery\(async \(\) => \(await db\.marketLedger\.get\(userId\)\) \?\? null/);
    expect(market).toMatch(/setClaimedRefunds\(row\.refunds \?\? \[\]\)/);
    expect(market).toMatch(/setRedeemedTickets\(row\.tickets \?\? \[\]\)/);
  });

  it('blocks writes until the row has been read, for this user', () => {
    // The guards are what stop the empty initial state from overwriting the
    // ledger before hydration, and stop one account's basket from being
    // written under the next account's id when they switch.
    expect(market).toMatch(/const \[ledgerReadyFor, setLedgerReadyFor\] = useState<string \| null>\(null\)/);
    expect(market).toMatch(/if \(ledger === undefined \|\| ledgerReadyFor === userId\) return;/);
    expect(market).toMatch(/if \(ledgerReadyFor !== userId\) return;/);
  });

  it('writes the whole row back through db.marketLedger.put', () => {
    expect(market).toMatch(/db\.marketLedger\.put\(\{[\s\S]*?refunds: claimedRefunds,[\s\S]*?cart: cartItems/);
  });
});

describe('the one-time legacy migration', () => {
  it('imports all four legacy keys when no ledger row exists', () => {
    const start = market.indexOf('function migrateLegacyMarketState');
    expect(start, 'the migration function was not found').toBeGreaterThan(-1);
    const body = market.slice(start, market.indexOf('}', market.indexOf('localStorage.removeItem', start)) + 1);
    for (const key of ['REFUNDS_KEY', 'TICKET_KEY', 'WISH_KEY', 'CART_KEY']) {
      expect(body, `migration does not read ${key}`).toMatch(new RegExp(`readJson[^\\n]*${key}`));
    }
    expect(body).toContain('db.marketLedger.put(');
    expect(body).toMatch(/for \(const key of \[CART_KEY, WISH_KEY, TICKET_KEY, REFUNDS_KEY\]\) \{\s*localStorage\.removeItem\(key\);/);
  });

  it('only runs when the ledger has no row for this user, and hydrates from what it imported', () => {
    // Resurrecting deleted data on every visit would make the ledger
    // impossible to clear; the import is reserved for a player whose row does
    // not exist yet. The import is also awaited and its result hydrates the
    // mirrors — a fire-and-forget put would race the write-back effect, whose
    // empty initial state would land after it and erase the import.
    expect(market).toMatch(/if \(!row\) row = await migrateLegacyMarketState\(userId\);/);
    expect(market).toMatch(/await db\.marketLedger\.put\(row\);[\s\S]{0,200}localStorage\.removeItem\(key\);/);
  });
});
