## 2024-05-23 - Add ARIA labels to icon-only buttons
**Learning:** Found a recurring pattern where interactive icon-only buttons (like theme toggles, close buttons, edit buttons, and assistant toggles) lacked `aria-label`s, preventing screen readers from announcing their purpose.
**Action:** Added descriptive `aria-label` attributes to these buttons to ensure proper screen reader accessibility across key components (StickyHeader, HeroSection, Toast, FloatingAssistant).
