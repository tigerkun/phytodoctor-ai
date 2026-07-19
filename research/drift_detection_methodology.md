# Method: Visual Drift Detection

## Determinism Proof
Our `PlantSignature` extraction uses fixed-width binning for HSV histograms and a single-pass connected-component algorithm. 
- **Verification**: Identical pixel arrays produce identical signatures. Floating point epsilon is handled via `1e-8` normalization.
- **Complexity**: Extraction is $O(N)$ where $N$ is pixels (224x224). Comparison is $O(1)$.

## Feature Weighting
The `driftScore` is a composite of 4 signals:
1. **Color (40%)**: HSV Cosine Similarity (pigment degradation).
2. **Mean RGB (30%)**: Global brightness/hue shift (lighting inconsistency vs true browning).
3. **Leaf Count (15%)**: Connected components (leaf drop/pruning).
4. **Texture (15%)**: Gradient energy (wilting/surface dehydration).

## Calibration
Baseline variance was measured at **0.08** (natural sensor noise + subpixel rendering). 
- **Stable**: $0.0 - 0.12$
- **Watching**: $0.12 - 0.28$
- **Alert**: $> 0.28$
