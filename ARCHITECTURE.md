# Systems Architecture: Botanical Guardian

## 1. Data Integrity Layer (IndexedDB)
The application uses **Dexie.js** as a non-volatile local storage engine.
- **Specimens (`plants`)**: Global IDs, species keys, and `baselineSignature` blobs.
- **Logs (`checkins`)**: Sequential telemetry data + binary photo blobs.
- **Predictions**: Historical risk assessments with `triggeredAlert` flags.
- **Persistence**: Data survives tab closure and offline sessions. Sync status is tracked per-record.

## 2. Computer Vision Pipeline (On-Device)
Visual analysis occurs entirely in the browser thread using the **Canvas API**.
1. **Normalization**: Image is resized to 224x224px.
2. **Feature Extraction**:
   - **48-bin HSV Histogram**: Captures color distribution (pigment shifts).
   - **Connected-Component Analysis**: Estimates leaf count/structure markers.
   - **Gradient Magintude**: Measures texture energy (structural integrity).
3. **Deterministic Comparison**: Cosine similarity + Weighted Euclidean distance calculates `driftScore` (0.0 - 1.0).

## 3. Hybrid Forecasting Engine
A tiered logic stack determines patient risk:
- **Level 1: Botanical Rule Engine**: Evaluates current conditions vs. species-specific profiles (temperature, light, water frequency).
- **Level 2: Visual Drift**: Identifies non-linear changes (e.g., subtle yellowing or drooping).
- **Level 3: LLM Refinement (Gemini 1.5 Flash)**: Escalates to Gemini only when rule confidence is low (<60%), passing recent history and sensor trajectory for "clinical consultation."

## 4. Hardware Abstraction (SensorProvider)
The app uses a bridge pattern to interface with environment sensors:
- **Geolocation**: Real browser API (W3C) → Open-Meteo Weather API.
- **Ambient Light**: W3C `AmbientLightSensor` (if enabled) → falls back to UX exposure sliders.
- **Unit Testing**: Mock-free environment except for specifically tagged simulated test cases.

## 5. Security & Privacy
- **Client-Side AI**: Visual analysis is on-device.
- **Proxied API**: Gemini interactions are handled via a secured backend proxy, preventing API key exposure.
- **No Tracking**: Privacy-first design; images remain in user-controlled IndexedDB.
