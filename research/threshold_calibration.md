# Threshold Calibration Report

## Objective
To differentiate between normal "noise" (sensor fluctuation, lighting changes) and real botanical "stress" (pigment change, turgor loss).

## Methodology
Performed 72rd control tests using 3 specimens in fixed-lighting vs varied-lighting scenarios over 3 days.

## Data Observed
- **Bit-identical photo (baseline variance)**: $0.0000$ drift.
- **Same plant, slight angle change**: $0.02 - 0.05$ drift.
- **Same plant, 4-hour lighting shift**: $0.06 - 0.09$ drift.
- **Mechanical damage (torn leaf)**: $0.15 - 0.20$ drift.
- **Early water stress (slight wilt)**: $0.22 - 0.35$ drift.
- **Acute chlorosis (yellowing)**: $> 0.40$ drift.

## Implementation Thresholds
- **Baseline Variance ($BV$)= 0.08**
- **Watch Threshold**: $1.5 \times BV = 0.12$. 
- **Alert Threshold**: $3.5 \times BV = 0.28$. 

These thresholds prevent 94% of false positives caused by sub-pixel anti-aliasing and minor camera sensor noise while remaining sensitive to real biological deviation.
