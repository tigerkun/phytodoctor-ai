# AGENTS.md — PhytoDoctor AI

Project memory for anyone (human or agent) working in this repo. It records
what the codebase *is* and where its sharp edges are, so that knowledge does
not have to be rediscovered by reading 1,800 lines of server code.

Writing-style rules live separately in [`.agents/AGENTS.md`](.agents/AGENTS.md).
This file is about the system, not the tone of voice.

---

## What this is

A plant-care web app. Photograph a leaf, get a diagnosis; track plants over
time; trade harvested produce in a marketplace. Deployed at
`phytodoctor-ai.onrender.com`, repo `tigerkun/phytodoctor-ai`, database
Supabase Postgres `rkaawupaxlfdovpkrugp`.

React SPA + Express in one deploy. `server.ts` is both the API and the static
file host — there is no second server to configure.

## Commands

```bash
npm run dev      # tsx server.ts, port 3000
npm run build    # vite build + esbuild bundle of server.ts -> dist/server.cjs
npm start        # node dist/server.cjs  (what Render runs)
npm test         # vitest run — 213 tests
npm run lint     # tsc --noEmit, the ONLY lint. There is no eslint config.
```

CI (`.github/workflows/ci.yml`) runs exactly `tsc --noEmit`, `npm run build`,
`npm test`, on **Node 22**. The comment in that file explains why: Node 20 has
no global `WebSocket`, so the CDP harness throws during construction there and
reddens CI without saying anything about the code under test. The Dockerfile is
`node:22-alpine` to match. Do not "modernise" this to a newer major without
changing the Dockerfile in the same commit.

## Layout

```
server.ts              API + static host + SPA fallback
src/lib/               server-shared pure logic (logger, clientIp, publicPaths, guestQuotaStore)
src/services/          Supabase, Gemini, economy, marketplace, drift detection
src/components/        UI, incl. feedback/ (Skeleton, ErrorState)
src/pages/             one file per route
public/sw.js           service worker, cache-busted by name (phyto-guard-vX.Y)
sql/                   additive migrations, applied by hand
docs/architecture.md   ADRs
```

`sql/` holds only **additive** migrations. There is no runner and no down-migration.
This is deliberate — see "Things that are deliberately absent" below.

## Conventions that are load-bearing

**Offline-first is not a feature, it is the source of truth.** Dexie/IndexedDB
is the primary store and the UI renders from it. Never make a component fetch
first and render second; that is the pattern that produces a spinner where a
plant card should be.

**The economy has two halves, and only one of them is enforced.** Know which is
which before you touch it. Seed awards, tier multipliers and the Discovery
Registry (`discoveredSpecies`, which stops the delete-and-recreate exploit) are
computed in `src/services/gameService.ts` and persisted to the player's profile
— that is client-side and only as trustworthy as the client. Purchases go
through Postgres RPCs (`increment_seeds`, `purchase_pro_with_seeds`,
`grant_pro_from_payment`), and those are server-authoritative. If you are
changing what a player *earns*, the current protection is the Discovery Registry
and the `xpLog` composite index in ADR 003, not a server check. Do not assume
either half validates the other.

**Analysis stays on the device.** Drift detection is an HSV histogram
comparison on canvas, so a photo never leaves the browser for inference. Do not
"improve" it by sending the image to a model; that breaks the privacy claim in
ADR 001 and is a real behavioural change, not an optimisation.

**Route gating lives in one place.** Public paths are `src/lib/publicPaths.ts`
— `['/', '/auth', '/lab', '/help', '/privacy', '/terms']`. `routeGates.test.ts`
fails if a route is added without deciding its gate. `/market` is auth-gated
despite looking like marketing.

**Tests are source-level where there is no DOM.** There is no jsdom and no
@testing-library in this project. The established pattern is to read the file as
text and assert on its structure (`routeGates.test.ts`,
`formLabels.test.ts`, `feedbackStates.test.ts`). Match it — do not introduce a
DOM test dependency for one test. Each such test must include a
"the scan found something to check" assertion, because a regex that silently
stops matching makes the whole file pass vacuously, which is exactly the bug
these tests exist to prevent.

## Gotchas

**`server.ts` is ESM.** `"type": "module"`. The build bundles it to CJS for
`dist/server.cjs`; anything requiring a relative path at runtime will behave
differently between `npm run dev` and `npm start`.

**Never `console.*` in `server.ts`.** Use `log.info/warn/error` from
`src/lib/logger`. Two reasons, both learned the hard way: JSON lines are
greppable and correlate by request id, and the logger redacts secrets that ride
in on error objects. Supabase attaches the offending request to its errors, and
that request carries the service-role key. Passing a raw `error` to
`console.error` prints it.

**Every response carries `x-request-id`.** It is echoed from the request when
the caller sends a well-formed one (8–128 word characters), generated otherwise.
That id is attached to every log line the request produces. When debugging a
production report, ask for the id and grep for it — that is the whole point of
the `AsyncLocalStorage` in `src/lib/logger.ts`.

**`.env` is gitignored and must stay that way.** `.gitignore:14-16` excludes
`.env*`, re-includes `.env.example`, and excludes `secrets.json`. Read prefixes
and lengths, never values. Do not print a secret into a transcript, a commit
message, or a test fixture.

**Rate-limit identity is not the socket address.** `src/lib/clientIp.ts` prefers
`CF-Connecting-IP` because production is behind Cloudflare, which sets that
header and the client cannot forge it. Trusting `X-Forwarded-For` was measured
granting 70 requests in 19 seconds on the routes that bill Gemini per call.

**The guest scanner has a hard daily cap** (`GUEST_IDENTIFY_LIMIT = 2`), backed
by a shared quota store. An in-process `Map` is per-instance and production was
observed granting a third scan, because the next request landed on a second
instance. See `src/lib/guestQuotaStore.ts`.

**The service worker matches on URL and method only.** It ignores
`Authorization`. Anything auth-scoped must be excluded from caching by path.
A cross-user leak was suspected here and **could not be reproduced** under a
controlled two-account test — each player got their own balance on every read —
but the cache guard stays in regardless, because the failure mode is severe and
the fix is one condition.

**JSX text matching truncates on `>`.** `onChange={e => ...}` contains a `>`,
so matching a tag to its first `>` misses every attribute after it. The a11y
test scans tags with brace-depth tracking (`readTag`) for exactly this reason.
If you write another source-level scanner, it needs the same.

## Things that are deliberately absent

**No migration runner.** `sql/` is applied by hand. A runner that replays SQL
against a live database is the single highest-risk change available in this
repo, and the value does not pay for it. Do not add one without being asked.

**No paid-tier provisioning.** Supabase Pro and Razorpay checkout both require
the operator's own accounts; the app degrades to a documented free behaviour
when they are absent (`/healthz` reports `configured` per service).

## Production checks

```bash
curl -s https://phytodoctor-ai.onrender.com/healthz      # readiness: config, schema drift, RPC probes
curl -s https://phytodoctor-ai.onrender.com/healthz/live # liveness: fast, no dependencies
```

Readiness is deliberately slow (it probes the database). Liveness is the right
probe for a restart policy. Poll the **body** for `uptimeSeconds`, never just
the status code — the SPA fallback returns `200` with `index.html` for any
unknown path, so a bare `200` proves nothing about which build is running.