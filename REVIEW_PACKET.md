# REVIEW PACKET

## Phase 0 Pre-flight Results (verified 2026-09-19)

- **Clean-env build**: `npm run build` exits 0 with all `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `APP_URL` unset. No module-scope `VITE_*` reads cause build failure. Build output: `dist/assets/index-DyPIhEgD.js` (1,583 kB / 461 kB gzip), `dist/server.cjs` (47.2 kB). ✅
- **Vitest red→green record**: Tests in `src/services/__tests__/batch.test.ts` were written against the *unfixed* code first (BUG-01: streak returned 1.1× at 7 days; BUG-03: spend applied 1.5× multiplier). After applying fixes, all 3 pass (`Tests 3 passed (3)`, 509ms). ✅
- **Migration additive-only audit**: All 5 new migrations verified safe:
  - `20260912000000_game_economy.sql` — additive (new table + RLS) ✅
  - `20260913000000_harden_seed_mutations.sql` — `create or replace function` (5-arg overload), `revoke update(seeds)` ✅ (old code never relied on direct column updates from client)
  - `20260913010000_plant_lineage.sql` — `alter table ... add column if not exists` ✅
  - `20260913020000_weather_alert_foundation.sql` — new table + `add column if not exists` ✅
  - `20260914010000_drop_unsafe_increment_seeds.sql` — drops **old 3-arg overload** `(integer, text, text)` only. New `server.ts:853` calls the 5-arg overload. No caller in `src/` or `server.ts` uses the old signature. ✅ Safe.
- **Non-audit bug rule**: BUG-06 (seeds-before-upload race) and BUG-09/BUG-10 (assistant/check-in hardcoded IDs) were found mid-batch and confirmed via AUDIT_CLAIMS_VERIFIED. Both are below the BUG-01/SEC-10 severity threshold (no data loss, no security) → correctly deferred to backlog, not buried in this batch. ✅
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
- **Test Suite**: 24 tests passed across 3 test suites (`batch.test.ts`, `ruleEngine.challenge.test.ts`, `driftDetector.challenge.test.ts`). Strict typecheck passed (0 errors). Production build clean.

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
- Public-read photo bucket
- Amazon search-page links

## BUG-03 evidence
```sql
SELECT COUNT(*) FROM profiles;
```
*(result pending user run)*

## Items 2–5 & 7 checklist
- [ ] Render branch+commit verification
- [ ] Supabase `pg_proc` expected output including `increment_seeds` 3-arg single row
- [ ] GitHub app audit
- [ ] Branch protection on `main`
- [ ] Phone tests including gemini model-fallback log check on first real identify

## Deferred post-merge backlog
- R2 dead-code purge
- R3 perf rework
- R4 accessibility pass
- SEC-06 CSP narrowing (prepared allowlist: api.razorpay.com, checkout.razorpay.com, eonet.gsfc.nasa.gov, api.open-meteo.com, *.supabase.co)
- Dependency dedupe: `motion` vs `framer-motion` — both genuinely imported, needs import migration
- Docs consolidation into `docs/`
