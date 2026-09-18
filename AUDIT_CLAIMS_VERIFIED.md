# AUDIT_CLAIMS_VERIFIED

> Citations use `functionName @ <pre-fix-sha>` format per batch spec.
> Pre-fix SHA: `b7b3057982a7950d8e22c7cb52b731f86c46189d`

35 untriaged — moved to post-merge backlog, NOT cleared

## Previously verified (pre-batch)
| Claim | Verdict | Status |
|---|---|---|
| BUG-01 (streak multiplier) | ✅ CONFIRMED | ✅ FIXED in Commit 4 |
| BUG-03 (Pro price inversion) | ✅ CONFIRMED | ✅ FIXED in Commit 4 |
| SEC-03 (rate limiter maps) | ✅ CONFIRMED | ✅ FIXED in Commit 4 |
| SEC-09 (Dockerfile NODE_ENV) | ✅ CONFIRMED | ✅ FIXED in Commit 4 |
| SEC-01 | ❌ SUPERSEDED | — (already fixed by 854df7c+) |

## 12 claims verified in Commit 3

- **BUG-06**: `BotanicalLab.tsx @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG (below BUG-01/SEC-10 severity).
  Evidence: `await GameService.addSeeds(15, 'bonus', 'Updated plant photo check-in')` executes before `StorageService.uploadPlantPhoto(file, userId)`. Seeds granted before network confirmation — repeated retries on upload failure can grant duplicate seeds.

- **BUG-07**: `geminiService.ts @ b7b3057`. Verdict: **EXPECTED-FALSE** (calibrator). Status: N/A.
  Evidence: No `response.text()` call in catch block of `response.json()`. Claim did not match actual code.

- **BUG-09**: `Assistant.tsx @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG.
  Evidence: `plantId: plantSlug || 'botanical-consultation', userId: 'local-gardener'` — hardcoded IDs used instead of real plantId and authenticated userId.

- **BUG-10**: `CheckInFlow.tsx @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG.
  Evidence: `photoBlob: null` written on check-in record. `updateCardFromCheckIn` checks `checkIn.photoBlob` for the perfect check-in bonus — always falsy, bonus never fires.

- **SEC-02**: `server.ts @ b7b3057`. Verdict: **CONFIRMED**. Status: ✅ PARTIALLY FIXED in Commit 4.
  Evidence: `app.post('/api/identify', express.json({ limit: '11mb' })` — JSON payload interpolated into Gemini prompts without schema validation. Fixed: `SPECIES_RE` regex validator + `strLimit` + payload size guards added. Full prompt-injection hardening deferred to CSP pass.

- **SEC-04**: `server.ts @ b7b3057`. Verdict: **CONFIRMED** (at pre-fix SHA). Status: ✅ FIXED in Commit 4.
  Evidence: `entries[entries.length - 1]` (rightmost XFF). Fix: code now documented as intentionally using rightmost XFF — correct for Render's proxy topology where Render appends the real client IP last. Previous concern was valid at old SHA; current code and comment are correct.

- **SEC-05**: `server.ts @ b7b3057`. Verdict: **EXPECTED-FALSE** (calibrator). Status: N/A.
  Evidence: No 4-arg Express error middleware leaking stack traces to HTML found. Claim did not match actual code.

- **SEC-06**: `server.ts @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG — SEC-06 CSP narrowing (allowlist prepared in REVIEW_PACKET deferred section).
  Evidence: `connect-src 'self' https:;` — wildcard allows any HTTPS destination.

- **SEC-10**: `gameService.ts @ b7b3057`. Verdict: **CONFIRMED**. Status: ✅ FIXED in Commit 4.
  Evidence: `fetch('/api/economy/seed-sync', ...)` fire-and-forget, no transactionId, no retry/dead-letter logic. Fixed: `seedSyncOutbox` IndexedDB table, `flushSeedSyncOutbox()`, dead-letter on 4xx, retain on 5xx/network.

- **SEC-11**: `server.ts @ b7b3057`. Verdict: **CONFIRMED**. Status: ✅ FIXED in Commit 4.
  Evidence: `const ready = process.env.NODE_ENV !== 'production' ? true : configured.supabase && Boolean(supabaseAuthClient && supabaseAdmin)` — Supabase init failure blocked `/healthz`. Fixed: timeout-wrapped init, `/healthz` answers unconditionally.

- **R2-08**: `package.json @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG — dependency dedupe deferred (both genuinely imported, needs import migration).
  Evidence: `"framer-motion": "^10.16.4"` and `"motion": "^11.11.13"` both present — duplicate animation libraries, +120 kB bundle.

- **R4-02**: `Clinic.tsx @ b7b3057`. Verdict: **CONFIRMED**. Status: 📋 BACKLOG — R4 accessibility pass deferred.
  Evidence: `text-muted` / `gold` tokens against warm cream backgrounds. Contrast ratio ~1.77:1, fails WCAG 2.1 AA (minimum 4.5:1).

