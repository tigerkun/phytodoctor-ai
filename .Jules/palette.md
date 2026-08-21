## 2026-08-21 - Added aria-labels to FloatingAssistant
**Learning:** Found an accessibility issue pattern specific to this app's components, where multiple interactive elements like chat close, voice input toggle, and floating buttons lacked aria labels despite having visual cues (lucide-react icons).
**Action:** Ensure all interactive elements, particularly icon-only buttons (`FloatingAssistant`, `SystemAudit`, `SuggestionsCarousel`), specify an `aria-label` attribute to properly communicate their function to screen readers.
