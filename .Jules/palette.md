## 2024-03-22 - Icon-only Buttons Need Labels and Focus Styles
**Learning:** Icon-only buttons lack context for screen readers and can be difficult to navigate via keyboard if they don't have proper focus indicators.
**Action:** Always add an `aria-label` to buttons that only contain an icon (and no text). Also, ensure they have `focus-visible` styles (like `focus-visible:ring-2`) and sufficient hit area (e.g. using `p-1 -m-1`) for accessible interaction.
