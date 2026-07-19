# ADR 001: Classical CV vs. TFLite for MVP

## Context
When implementing visual health monitoring (drift detection), we considered using TensorFlow Lite (TFLite) for neural-network-based disease classification versus classical computer vision (CV) using the browser's Canvas API.

## Decision
We chose **Classical Computer Vision** (HSV Histograms + Connected-Component Analysis) as the primary engine for the v1.0 release.

## Rationale
1. **Determinism**: Neural networks can have floating-point variance across different JS engines. Classical CV algorithms are bit-identical, ensuring consistent health scores for the same photo.
2. **Explainability**: Users can see their HSV histogram and contour count. We can explain *why* a score is high (e.g., "pigment shift in the green spectrum").
3. **Payload Size**: TFLite requires a ~15MB binary download plus model weights. Classical CV is built into the browser, resulting in a significantly faster Initial Page Load.
4. **Main Thread Performance**: Canvas-based pixel manipulation is highly optimized in modern browsers, often beating WASM-based neural inference for simple tasks like histogram binning.
5. **No Training Data Needed**: We don't need a labeled dataset of millions of plants to measure "drift" from a known healthy baseline.

## Consequences
- **Capability Gap**: Classical CV is poor at identifying *specific* diseases (e.g., powdery mildew vs. spider mites) without manual feature engineering.
- **Hybrid Roadmap**: We plan to introduce TFLite in v2.0 for pre-symptomatic pattern matching, keeping Classical CV as the "deterministic baseline."
