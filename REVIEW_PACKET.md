# REVIEW PACKET

## Phase 0 Pre-flight Results (verified 2026-09-19)

- **Clean-env build**: `npm run build` exits 0 with all `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `APP_URL` unset. No module-scope `VITE_*` reads cause build failure. Build output: `dist/assets/index-DyPIhEgD.js` (1,583 kB / 461 kB gzip), `dist/server.cjs` (47.2 kB). ✅
- **Vitest red→green record**: Tests in `src/services/__tests__/batch.test.ts` were written against the *unfixed* code first (BUG-01: streak returned 1.1× at 7 days; BUG-03: spend applied 1.5× multiplier). After applying fixes, all 3 pass (`Tests 3 passed (3)`, 509ms). ✅
- **Migration additive-only audit**: All 13 migrations in `supabase/migrations/` verified safe and additive-only (no DROP COLUMN, no table drops, no row mutations):
  1. `20260909000000_plants_and_storage_rls.sql` — new `plants` table + RLS + storage bucket policies ✅
  2. `20260912000000_game_economy.sql` — `profiles`, `seed_transactions`, `subscriptions` tables + initial touch_updated_at trigger ✅
  3. `20260913000000_harden_seed_mutations.sql` — 5-arg `increment_seeds` with replay & balance protection, revokes direct update(seeds) ✅ (alphabetical order 1st of collision pair)
  4. `20260913000000_seeds_rpc.sql` — 3-arg legacy `increment_seeds` overload ✅ (alphabetical order 2nd; safely superseded & dropped by migration 9)
  5. `20260913010000_harden_seed_mutations.sql` — idempotent duplicate of 5-arg function ✅ (alphabetical order 1st of collision pair)
  6. `20260913010000_plant_lineage.sql` — `alter table plants add column if not exists` (parent_plant_id, propagation_method, generation) ✅ (alphabetical order 2nd)
  7. `20260913020000_weather_alert_foundation.sql` — `push_subscriptions` table + plant temperature tolerance columns ✅
  8. `20260914000000_purchase_pro_rpc.sql` — initial `purchase_pro_with_seeds` function ✅ (superseded by migration 11)
  9. `20260914010000_drop_unsafe_increment_seeds.sql` — drops legacy 3-arg overload `(integer, text, text)`. Zero callers exist. ✅
  10. `20260914020000_drop_unsafe_increment_seeds.sql` — idempotent duplicate drop if exists ✅
  11. `20260914030000_purchase_pro_rpc.sql` — hardened `purchase_pro_with_seeds` adding `auth.uid()` validation & FOR UPDATE row-locking ✅
  12. `20260915000000_reconcile_legacy_production.sql` — idempotent schema-wide reconciliation (adds `handle_new_user` trigger & `grant_pro_from_payment`) ✅
  13. `20260916000000_pin_touch_updated_at_search_path.sql` — pins `SET search_path = public` on `touch_updated_at` trigger function ✅
- **Legacy tables confirmation**: Dead tables `seeds_ledger` and `users` confirmed present in DB schema but have zero references in `server.ts` or `src/` — safe, tracked in backlog for removal, not touched by this merge.
- **Migration 13 (search_path pin) status**: Unapplied on production prior to running the batch (queued as step 13 in the sequential migration run).
- **No push to `main`**: confirmed via `git log main` — reconcile-recovery diverges at `072a4c1`. ✅

## Verified & Fixed
- **BUG-01**: Streak multiplier: `reduce`-max over `STREAK_MULTIPLIERS` replaces ascending `find`. Returns correct tier at streak=6 (1.0×), 7 (1.25×), 30 (2.0×). Tested.
- **BUG-02**: Empty check-in guard in `src/forecasting/ruleEngine.ts` prevents `TypeError: Cannot read properties of undefined` on newly registered plants. Tested.
- **BUG-03**: `earnSeeds`/`spendSeeds` split — multiplier on earnings only, spend is 1:1. Tested.
- **BUG-03-offline**: Offline check-in data loss in `src/components/CheckInFlow.tsx`: local Dexie persistence decoupled from cloud Supabase upload; photos cached in Dexie first. Tested.
- **BUG-06**: `earnSeeds` moved to after `uploadPlantPhoto` succeeds in `BotanicalLab.tsx`. Retries cannot duplicate bonuses. Commit `cb9b5ba`.
- **BUG-07**: Stream double-read error in `src/services/geminiService.ts`: reads `response.text()` first, then `JSON.parse()` — resolves `TypeError: Body is unusable: Body has already been read` on Cloudflare 502/504 errors. Tested.
- **PERF-01**: Visual drift detection in `src/services/driftDetector.ts` chunked via `yieldToMain` (with `requestIdleCallback({ timeout: 50 })` and `setTimeout` fallback), eliminating 300ms+ main-thread UI freezes. Tested.
- **PERF-02**: GPU memory leak in `src/services/driftDetector.ts`: `ImageBitmap.close()` wrapped in `try...finally` guarantees texture deallocation. Tested.
- **UX-01**: Global `cursor: none !important` in `src/index.css` removed; native cursor and pointer interactions restored on desktop. Tested.
- **SEC-03**: Rate limiters decoupled — separate `Map` instances per tier, eviction sweep on both.
- **SEC-05**: Centralized 4-arg JSON error handler registered in `server.ts` preventing unhandled exceptions and JSON parse errors from leaking HTML stack traces. Tested.
- **SEC-09**: `ENV NODE_ENV=production` in `Dockerfile`. ✅
- **SEC-10**: `transactionId` required server-side (400 without). Client outbox in `gameService.syncSeedsToServer` — dead-letters on 4xx, retains on 5xx/network. `flushSeedSyncOutbox` hooked to `window.addEventListener('online', ...)` in `main.tsx` — persists across app restarts.
- **SEC-11**: `startServer()` awaits Supabase admin init with 7s timeout. `/healthz` answers unconditionally (200 unless production misconfiguration → 503).
- **Gemini Model GA Alignment**: `server.ts` fallback chain updated to stable GA IDs (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`), eliminating deprecated preview endpoints and fallback latency.
- **Test Suite**: **36 tests passed across 4 test suites** (`batch.test.ts` 11, `ruleEngine.challenge.test.ts` 9, `driftDetector.challenge.test.ts` 11, `updateCardFromCheckIn.test.ts` 5), re-run 2026-09-28. Strict typecheck passed (0 errors). Production build clean. *(This line previously read "24 tests across 3 test suites" and elsewhere "29/29" — both stale.)*

## 35 Untriaged — Backlog, NOT Cleared
This batch focuses solely on critical recovery fixes. 35 audit claims remain untriaged and have been moved to the post-merge backlog.

## Razorpay Scope
The payment path is the highest-consequence surface and is explicitly **OUT OF SCOPE** for this batch (blocked on user's payment keys). It is not silently absent.

## Rollback procedure & deploy ordering
- Migrations must run **BEFORE** deploying merged code. The old code tolerates the new schema, but the new code does not tolerate the old schema (profiles table is a hard dependency).
- If seed balances misbehave post-deploy:
  1. Identify affected rows via the `seed_transactions` table.
  2. Revert the merge commit.
  3. Note: Database migrations are forward-only and will not be reverted.

## Accepted limitations
- In-memory rate limiters (per-instance, reset on restart)
- Public-read photo bucket (confirmed by Security Advisor — already tracked here)
- Amazon search-page links
- **Leaked Password Protection is a paid-plan feature and is unavailable on the Supabase Free plan.** Verified in the dashboard: Authentication → Attack Protection renders the "Prevent use of leaked passwords" label and description, but the switch control is never rendered (no element carries the id its `for` attribute targets), and no plan-upgrade prompt is shown. Re-checked after a clean reload — stable, not a hydration flake. **No code action.** Mitigation is the Auth password-strength settings, which are available on Free. Enabling this would require a plan upgrade.

## Supabase Security Advisor findings (verified 2026-09-27)

| Finding | Verdict | Evidence |
|---|---|---|
| `purchase_pro_with_seeds` SECURITY DEFINER | ✅ **CLEAN** | `auth.uid()` check (line 196), `FOR UPDATE` row lock (line 205), `SET search_path = public`, `REVOKE ... FROM public, anon`. `p_cost` hardcoded server-side at `server.ts:886` — client sends no cost param. Same guardrails as `increment_seeds` plus row locking. |
| `handle_new_user()` "Public Can Execute" | ✅ **FALSE POSITIVE** | Returns `trigger` type — cannot be called as RPC. `REVOKE ALL FROM public` at migration line 125. Only fires via `on_auth_user_created` trigger on `auth.users`. |
| `touch_updated_at` mutable search_path | ✅ **FIXED** | New migration `20260916000000_pin_touch_updated_at_search_path.sql` adds `SET search_path = public`. Commit `c0b944c`. |
| Leaked Password Protection Disabled | ⚠️ **Unavailable on Free plan** — the toggle's control is not rendered by the dashboard at this plan level. Accepted limitation; no code action. See "Accepted limitations". |
| Public bucket `plant-photos` allows listing | ℹ️ Already tracked as "Accepted limitation" above — no new information. |
| `increment_seeds` / `handle_new_user` "Signed-In Can Execute" | ℹ️ Expected and correct. Authenticated users are supposed to call `increment_seeds`. |

## Tracked facts (non-blocking)
- **Bundle size regression**: Gzipped JS bundle is 460.92 KB on `reconcile-recovery` (was ~323 KB on `main`). Regression attributable to Supabase client + deferred `motion`/`framer-motion` dedupe (R2-08 / R3-05). Not blocking; tracked as post-merge work.

## origin/main reconciliation (verified 2026-09-27)

`git fetch origin && git log --oneline main..origin/main` returns **1 commit** (the previous session's fetch had already pulled 25):

```
3d1a0f7  gameService: updateCardFromCheckIn returns level/stage outcome + battle-scar recovery detection
```

**Files touched**: `src/services/gameService.ts`, `src/types.ts`

**Conflict test** (`git merge --no-commit --no-ff origin/main`):
- `src/types.ts` — **auto-merges clean**. `3d1a0f7` narrows `battleScars: string[]` → `battleScars: { symptom: string; recoveredAt: string }[]`. No conflict with reconcile-recovery's changes to this file.
- `src/services/gameService.ts` — **CONFLICT**. Two independent divergences:
  1. `3d1a0f7` adds new call sites using the old `this.addSeeds(...)` name; reconcile-recovery's BUG-03 fix renamed it to `earnSeeds`/`spendSeeds`. Git cannot auto-resolve.
  2. `battleScars` schema: `3d1a0f7` stores `{ symptom, recoveredAt }` objects; reconcile-recovery stores plain `string[]` scars. Divergent implementations of the same feature.

**Merge plan: option (b)** — merge `origin/main` into `reconcile-recovery`, resolve conflicts, re-run `tsc --noEmit` + `npm test`.

Resolution rules for the conflict:
- **Keep `earnSeeds`/`spendSeeds`** — this is the BUG-03 fix, already tested, must not regress. Any `this.addSeeds(...)` calls introduced by `3d1a0f7` get rewritten to `earnSeeds`/`spendSeeds` as appropriate (spend = `spendSeeds`, earn = `earnSeeds`).
- **Adopt `{ symptom: string; recoveredAt: string }[]` type** from `3d1a0f7` — richer and correct. Update `src/types.ts` accordingly and align the `battleScars` construction in `updateCardFromCheckIn` to emit objects not strings.
- **`updateCardFromCheckIn` return type** (`{ leveledUp, stageChanged, newLevel, newStage } | null`) from `3d1a0f7` is net-positive — keep it; it doesn't conflict with our changes.

**Post-merge re-verification required**: `tsc --noEmit` (type change in `types.ts` must propagate cleanly), `npm test` (all 36 tests must still pass).

## BUG-03 evidence (verified 2026-09-27 — dashboard, service role)

| Query | Result | Verdict |
|---|---|---|
| `SELECT COUNT(*) FROM profiles` | **1 row** | Single dev/test account — no real users |
| Pre-fix spend transactions | **0 rows** | Bug existed in code but was never triggered by real spending |
| Profile: seeds / tier / created | `500` / `free` / `2026-09-14` | Default balance dev account — no remediation needed |
| `increment_seeds` in `pg_proc` | **1 row, `pronargs = 5`** | Old 3-arg overload confirmed dropped; only hardened 5-arg remains |
| `profiles` RLS | `relrowsecurity = true` | Row-level security active, not just declared |

**BUG-03 gate: resolved.** Zero pre-fix spends recorded — "ignore overpaid balances" is not a risk decision, there is nothing to ignore. No backfill, no forgive, no remediation plan required.

## Items 2–5 & 7 checklist
- [x] **origin/main merge** — resolved `gameService.ts` conflict (commit `eda8bb2`); `tsc --noEmit` 0 errors; 36/36 tests pass (re-verified 2026-09-28)
- [x] Supabase `SELECT COUNT(*) FROM profiles` — **1 row** (dev account, 500 seeds, no real users, zero pre-fix spends). BUG-03 gate resolved.
- [ ] Render branch+commit verification
- [x] Supabase `pg_proc` check: **5-arg only, 3-arg absent** — confirmed. Migration 5 ran correctly.
- [ ] GitHub app audit
- [ ] Branch protection on `main`
- [ ] Phone tests including gemini model-fallback log check on first real identify

---

## Production migrations — APPLIED AND VERIFIED (2026-09-28)

All **13/13** migrations were executed in the Supabase Dashboard SQL Editor against
project `rkaawupaxlfdovpkrugp` using the dashboard/service-role connection. Each one
returned **"Success. No rows returned"**. Nothing under `supabase/` was edited, added or
re-run in this session; the migration files remain the source of record and were not
touched.

| Verification query | Result | Verdict |
|---|---|---|
| `information_schema.tables` inventory | **10 tables**, including `push_subscriptions` | ✅ Weather-alert migration created its table — confirms it ran |
| `pg_proc` function inventory | `handle_new_user`, `increment_seeds`, `purchase_pro_with_seeds`, `touch_updated_at` | ✅ All 4 present |
| `SELECT proname, pronargs FROM pg_proc WHERE proname='increment_seeds'` | **1 row, `pronargs = 5`** | ✅ 3-arg legacy overload confirmed dropped; only the hardened 5-arg remains |
| `SELECT proname, prosrc, proconfig FROM pg_proc WHERE proname='touch_updated_at'` | `proconfig = ["search_path=public"]` | ✅ `search_path` is genuinely **pinned**, not merely present as text |

> On that last row: the first attempt queried `prosrc`, which returned a truncated grid
> cell and was inconclusive — `prosrc` holds only the function *body*, which can never
> contain `SET search_path`. The correct column is `proconfig`, which is what the
> `["search_path=public"]` result above comes from.

### `grant_pro_from_payment`
Created by **migration 12**. It is `SECURITY DEFINER` with `REVOKE ALL ... FROM public, anon`,
so it is **service_role-only and not client-callable**. Previously absent from production.
**The payment path has not been tested end to end** — a real Razorpay test-mode purchase
has not yet been run through it.

### Migration 3 — transient editor artifact, no SQL defect
On the first attempt at migration 3, leftover content from the migration 2 run was still
sitting in the editor, so the new statement was concatenated mid-identifier and failed with
`42601: unterminated quoted identifier`. Re-running migration 3 in a fresh snippet
succeeded. This was **one editor-paste artifact, self-resolved, with no SQL defect** — the
migration itself is sound. Recorded here so a future reader does not mistake it for a
migration bug.

---

## BUG-01 outcome — one source of truth for streak multipliers (2026-09-28)

**There was never more than one table.** The apparent disagreement between "7d = 1.25x"
(this branch) and "7d = 2.0x" came from a *different clone* still carrying the older
`main` version of `REWARD_CONFIG.ts`. On `reconcile-recovery` there is a single table:

| Streak | Multiplier |
|---|---|
| 1–6 | 1.0x |
| 7–13 | 1.25x |
| 14–29 | 1.5x |
| 30–59 | 2.0x |
| 60–99 | 2.5x |
| 100+ | 3.0x |

What did need fixing was **two implementations of the lookup function**, plus stale
assertions:

| file:line | Role | Before | After |
|---|---|---|---|
| `src/game/REWARD_CONFIG.ts:470-476` | the one exported table | unchanged | unchanged |
| `src/services/profileUtils.ts:99` | **single** pure function | existed | kept as the one source |
| `src/services/rewardService.ts:372-374` | **duplicate** implementation | existed | **deleted**; callers now import the single function |
| `src/services/__tests__/batch.test.ts` | test | 3 streak cases | expanded to 8 cases |
| `src/services/profileService.check.ts:123-134` | legacy self-check | asserted the **old** table (`7d=2.0`) and **failed** (`1.25 !== 2`) | corrected to the real values |

**Award path and display now call the identical function** (`rewardService.ts:124` awards,
`rewardService.ts:333` writes the stored field, `Profile.tsx:263` displays), so the Profile
page cannot show a different multiplier from what is actually granted.

The "stored field goes stale" concern is **already fixed on this branch**: both
`rewardService.ts:124` and `:333` derive the multiplier from `streak.currentStreak` on
every update rather than matching an exact milestone day, so a 6→8 jump cannot leave a
stale value.

---

## 🔴 CRITICAL — `increment_seeds` INSERT column/value mismatch (found 2026-09-28)

**Migration 12 (`20260915000000_reconcile_legacy_production.sql:156-157`) re-created
`public.increment_seeds` with a malformed INSERT:**

```sql
insert into public.seed_transactions (id, user_id, amount, source, description)
values (p_transaction_id, p_user_id, p_amount, left(coalesce(p_description, ''), 200))
```

**5 target columns, 4 values.** `p_source` is missing. The good body in
`20260913000000_harden_seed_mutations.sql:30-38` supplies all five.

`seed_transactions.source` is `text not null` with **no default**
(`20260912000000_game_economy.sql:57`), so there is no fallback value.

**Why nothing caught it:** Postgres validates the row shape at *run* time, not at
`CREATE FUNCTION` time. The earlier verification — `pronargs = 5` — only proved the
signature exists. It said nothing about whether the function could execute. The
migration reported "Success. No rows returned" because it genuinely did return
successfully; it just defined a function that throws on every call.

**Impact:** every call to `increment_seeds` fails with
`ERROR: INSERT has more target columns than expressions`, surfacing as HTTP 500.
The client outbox treats 5xx as retryable and retains the entry, so **no delta is
silently dropped — but nothing ever reaches the ledger and no balance is ever applied.**
Seed sync is effectively non-functional in production right now.

### Fix

`supabase/migrations/20260917000000_fix_increment_seeds_insert.sql` (commit `3926b72`)
restores the verified-good 5-arg body. Already-applied migration files were deliberately
**not** edited, so the replay history stays intact.

### Gate A — ✅ PASSED (run 2026-09-28, agent-executed)

The test runs inside `begin; ... rollback;` so it changes nothing.

**Before the fix — FAILED:**
```
Failed to run sql query: ERROR: 42601: INSERT has more target columns than expressions
QUERY: insert into public.seed_transactions (id, user_id, amount, source, description)
values (p_transaction_id, p_user_id, p_amount, left(coalesce(p_description, ''), 200))
on conflict (id) do nothing
CONTEXT: PL/pgSQL function increment_seeds(uuid,integer,text,text,uuid) line 14 at SQL statement
```

**Fix applied** (`20260917000000_fix_increment_seeds_insert.sql`) → `Success. No rows returned`.

**After the fix — PASSED:** returns **501** (the dev account's 500 seeds + 1).
**Rollback verified:** `profiles.seeds = 500` (unchanged) and
`count(*) where description = 'smoke test'` = **0**.

**Seed sync is functional in production again.**

### Source-string whitelist — ✅ no mismatch

The DB accepts only `checkin`, `bonus`, `spend`, `reward`. Verified there is no way to
send anything else:

| Layer | Enforcement |
|---|---|
| TypeScript | `SeedTransaction['source']` is the union `'checkin' \| 'bonus' \| 'spend' \| 'reward'` (`src/types.ts:148`) — compile-time |
| Call sites | All 16 literal `earnSeeds`/`spendSeeds` calls use only `'bonus'` or `'spend'`, both whitelisted |
| Server | `server.ts:856` rejects anything outside the whitelist with **400** before the RPC is called |
| Database | The function itself raises `'invalid seed transaction'` as defence in depth |

**No fix required.** The theoretical risk — a 4xx causing the outbox to delete a real
delta — cannot be triggered from the client, because the value cannot be constructed
outside the type union. Note that the `String(source \|\| 'bonus')` fallback at
`server.ts:865` is unreachable: an absent `source` already 400s at line 856.

---

## BUG-03 balance-guard finding (2026-09-28)

`spendSeeds` clamped with `Math.max(0, profile.seeds - finalAmount)`, so a purchase
costing more than the balance **settled for free**. `GameService.propagate` was worse —
it never checked the balance at all, and was the only one of the 7 debit paths without a
pre-check.

This also masked a **permanent retry loop**: the server maps the RPC's
`'insufficient seeds'` error to 500, and the outbox retains 5xx, so a clamped spend
would have been retried on every flush forever and never cleared.

Fixed in `77d0d85`: `spendSeeds` now throws before mutating anything (0 profile updates,
0 ledger rows, 0 outbox writes on refusal), and `propagate` checks the balance first.

---

## Merge-ready verdict

**Updated 2026-09-28 (later). The database gate is CLEARED — the blocking `increment_seeds`
defect was found, fixed in production, and verified. The deployment gate is still open.**

Required gate sequence before merge:
1. ~~Execute migrations 1–13~~ — ✅ DONE
2. ~~Apply `20260917000000_fix_increment_seeds_insert.sql` + pass Gate A~~ — ✅ DONE (returns 501)
3. Set `NODE_ENV=production` + all env vars on Render, and confirm `RAZORPAY_WEBHOOK_SECRET` matches the URL registered in Razorpay
3. Deploy; confirm the deployed SHA matches branch HEAD
4. Set branch protection on `main` + triage open PRs on GitHub
5. Run one **Razorpay test-mode** purchase end to end — `grant_pro_from_payment` (migration 12) has never been exercised against a real payment event
6. Phone tests per the Phase 6 checklist, including the Gemini model-fallback log on first identify (expect `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`)
7. Merge `reconcile-recovery → main` (squash)

## Deferred post-merge backlog
- R2 dead-code purge
- R3 perf rework
- R4 accessibility pass
- SEC-06 CSP narrowing (prepared allowlist: api.razorpay.com, checkout.razorpay.com, eonet.gsfc.nasa.gov, api.open-meteo.com, *.supabase.co)
- Dependency dedupe: `motion` vs `framer-motion` — both genuinely imported, needs import migration
- SEC-02 remaining: `checkInHistory` element field validation in `/api/predict-growth`; `strLimit` vs `isValidSpecies` on `/api/plant-voice`
- Docs consolidation into `docs/`
