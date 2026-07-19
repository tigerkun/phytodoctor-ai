# ADR 003: Rule Engine over Pure LLM

## Context
When designing the forecasting module, we considered using Large Language Models (LLMs) like Gemini for all predictions versus a deterministic rule-based engine.

## Decision
We implemented a **Hybrid Architecture**: A deterministic **Rule Engine** as the primary observer, with a **Large Language Model (Gemini 1.5 Flash)** as a low-confidence fallback.

## Rationale
1. **Determinism**: Botanical care requires reproducibility. If a cactus has wet soil, the risk of root rot is constant. LLMs can occasionally hallucinate or provide inconsistent scores for identical inputs.
2. **Explainability**: Our users need to know *why* an alert fired. The rule engine produces human-readable tokens (e.g., "Saturation Shield Triggered") that can be mapped to specific advice.
3. **Performance**: Calculating a risk score via the rule engine takes <5ms on a mobile device. An LLM call takes 1-3 seconds and requires a stable network connection.
4. **Cost & Rate Limits**: Relying on LLMs for every check-in would be prohibitively expensive and subject to API rate limits.
5. **Cold Start**: LLMs excel at nuanced "long-tail" problems where rules become too complex. For standard cases (hydration, light), rules are more efficient.

## Consequences
- **Maintenance**: We must maintain a database of species profiles (`speciesProfiles.ts`).
- **Escalation Logic**: Added a `confidence` metric. If the rule engine doesn't have enough data (e.g., new plant, ambiguous drift), it delegates to Gemini 1.5 Flash for a "clinical second opinion."
