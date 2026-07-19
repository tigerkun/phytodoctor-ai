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
