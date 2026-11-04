# ADR 001: Deterministic Visual Drift Detection

## Context
Plant health monitoring often relies on qualitative user assessment ("is it yellow?") or heavy Machine Learning models (TFLite) that require significant compute and training data.

## Decision
We implement a **Deterministic Visual Drift Detection** algorithm using HSV (Hue, Saturation, Value) histogram comparison via the standard HTML5 Canvas API.

## Rationale
1. **Explainability**: We can tell the user exactly which color bands shifted.
2. **Determinism**: Same photo + same algorithm = same score. No "hallucinating" stress.
3. **Privacy**: Analysis happens entirely on the client. No photos are sent to servers for inference.
4. **Efficiency**: Zero model overhead. Analysis takes <50ms on mobile devices.

## Status
Accepted / Implemented.

---

# ADR 002: Offline-First Data Architecture

## Context
Gardeners often check plants in areas with poor connectivity (balconies, backyards).

## Decision
Use **IndexedDB (via Dexie.js)** as the primary source of truth.

## Rationale
1. **Structured Data**: Allows complex queries (e.g., "all plants needing water today").
2. **Binary Storage**: Handles check-in photo Blobs efficiently without blocking the UI thread.
3. **Resilience**: App remains fully functional without an internet connection.

## Status
Accepted / Implemented.

---

# ADR 003: Gamification Economy Hardening

## Context
Initial testing revealed exploits where users could farm "Seeds" by deleting and recreating the same plant card.

## Decision
Implement a **Discovery Registry** within the User Profile that tracks species-level discovery state across the entity lifecycle.

## Rationale
1. **Verifiable State**: `discoveredSpecies` array ensures bonuses are awarded exactly once per lifetime.
2. **XP Throttling**: The `xpLog` table with composite indexing `[plantId+date]` prevents multi-check-in spam.

## Status
Accepted / Implemented.

---

# ADR 004: Sync Engine & Cloud Boundary

## Context
Users expect data to follow them across devices, but a full multi-tenant backend increases infrastructure costs and PII risk.

## Decision
Implement a **Local-First Sync Queue** pattern. v1.0 implements the queueing and network monitoring logic; v1.1 defines the POST boundary to a headless API.

## Rationale
1. **Decoupling**: The app doesn't care if the backend is live. It queues and moves on.
2. **Portfolio Transparency**: Demonstrates architectural intent for cloud integration while keeping the demo cost-free and privacy-preserving.

## Status
Accepted / In Queue.

---

# ADR 005: Garden-Briefed Assistant (Context Boundary)

## Context
The assistant answered as a generic chatbot — it could not name the Keeper's actual plants. Meanwhile `/api/guardian/predict` already sends full check-in histories and weather to Gemini, so a stricter privacy line for chat would have been inconsistent rather than stronger.

## Decision
The client builds a compact, serializable garden summary per send (name, species, guardian score, status, watering dates, care staleness — capped at 12 plants, worst first) in `src/lib/assistantContext.ts`; `/api/chat` validates it (shape + 8 KB cap), appends the shared prompt block to the system instruction, and the prompt forbids inventing plants. The whole briefing is gated by a Settings privacy toggle (default on, revocable) and disclosed in both assistant surfaces. Actions are client-computed chips from the same priority queue the dashboard uses — no Gemini function-calling.

## Rationale
1. **Inside the established boundary**: names, species, scores and dates are the same class of data `/api/guardian/predict` already carries. Explicitly excluded: photos, check-in payloads, note contents.
2. **Revocable**: the toggle makes the data flow a visible choice; off means nothing about the garden leaves the device.
3. **Honest failure modes**: missing context degrades to generic advice; oversize payloads are rejected loudly (400), and the client prunes below 80% of the cap with a `truncated` flag the user and the model both see.

## Status
Accepted / Implemented.

---

# ADR 006: Market Live Data Honesty

## Context
The Market's curated crates displayed invented social proof ("4.8 ★ · 203 keepers") and the page implied price awareness it did not have. SerpApi's free plan (250 searches/month, shared with the Library's daily engine) cannot fund per-product or per-user queries.

## Decision
Live listings run through a server module (`src/server/marketLive.ts`) on the careGuide discipline: **one `google_shopping` call per category per week, shared by every account** (4-category allowlist, ~21 searches/month), 7-day cache, stale-over-nothing degradation. Ratings and review counts render **only when the engine supplies them**; price history is the previous fetch's real prices ("was ₹X"), never a fabricated trend; trending surfaces real headlines, never a popularity rank. The curated crates keep their seed economy but carry no invented numbers — the internal curation score sorts but is labelled "Curated", not "Rating".

## Rationale
1. **Bounded quota**: the allowlist is the budget. The existing monthly ledger and circuit breaker meter everything through one funnel.
2. **Honest failure modes**: quota exhaustion or outage degrades to cached data or an explicit note — never stale numbers presented as live, never fake stars.
3. **Value before the paywall**: the live store renders outside the stall lock, because real prices help before the seed economy opens.

## Status
Accepted / Implemented.
