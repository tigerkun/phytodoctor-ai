# Logic: Species-Aware Rule Engine

## Design Philosophy
Rules are modeled as "Guardians" that watch specific biological constraints. Unlike generic apps, we weight stressors based on species-specific sensitivity.

## Core Rules
1. **Saturation Shield**: If `soilType == 'well-draining'`, tolerance for 'Wet' soil is < 24 hours.
2. **Desiccation Guard**: If `soilType == 'moisture-retentive'`, tolerance for 'Dry' soil is zero. 
3. **Irradiance Protocol**: Calibrates against 7-day cumulative light exposure. 'Direct' light on 'Indirect' species for $> 3$ days triggers actionable alerts.
4. **Thermal Watch**: Thresholds based on native habitat ranges.
5. **Dormancy Logic**: Adjusts thresholds during winter months to prevent over-maintenance errors.

## Confidence Scoring
$$Confidence = (\text{DataDepth} \times 5) + (\text{SignalCount} \times 10) + 10$$
Confidence must be $> 60\%$ to bypass Gemini escalation.
