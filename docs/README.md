# Documentation & Architecture Decision Records

This directory contains the engineering foundations of the Botanical Guardian project. It is intended for code reviewers and recruiters to understand the professional rigor applied to this student portfolio piece.

- [Architecture Decision Records (ADRs)](./architecture.md): Deep-dive justifications for technology choices (ML vs CV, Offline-First, Gamification Security).
- [Systems Integrity Suite](../src/services/integrityTests.ts): The logic behind the automated security and stability verifications.
- [Visual Drift Lab](../src/components/VisualAnalysisLab.tsx): Real-time HSV analysis implementation using the HTML5 Canvas API.

## Core Architectural Pillars
1. **Determinism**: Every check-in score is calculable, explainable, and reproducible across devices.
2. **Offline-First**: User data lifecycle is independent of network availability.
3. **Hardened Economy**: Game mechanics are protected by server-side-style validation (even in a client-side environment).

---

Developed by [Your Name] | 2026
