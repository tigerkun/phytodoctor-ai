## 2024-06-25 - Icon Button Accessibility
**Learning:** Icon-only buttons without `aria-label`s provide no context to screen reader users, making the application inaccessible. In `StickyHeader.tsx`, the Day/Night toggle button is just an icon.
**Action:** Adding an `aria-label` to the Day/Night toggle button based on its current state (e.g., "Switch to dark mode" / "Switch to light mode") and adding a `title` attribute for native tooltips on hover.
