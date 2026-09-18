# REVIEW PACKET

## Verified & Fixed
- **BUG-01**: Streak multiplier logic fixed to calculate maximum milestone bonus.
- **BUG-03**: Seed deduction separated to `spendSeeds` without multiplier padding.
- **SEC-03**: Rate limiters for general and AI endpoints decoupled with separate in-memory maps.
- **SEC-09**: Added `ENV NODE_ENV=production` to `Dockerfile`.
- **SEC-10**: Implemented `transactionId` verification in seed-sync endpoint and client-side outbox queue with IndexedDB.
- **SEC-11**: Supabase admin client initialization wrapped in a timeout promise to prevent blocking health checks.

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
