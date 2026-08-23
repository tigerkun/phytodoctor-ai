## 2024-08-23 - Accessibility of Icon-Only Buttons
**Learning:** Found multiple instances where interactive elements like toggle buttons and modal close controls were missing accessible text descriptions.
**Action:** When creating icon-only interactive controls (e.g., `<X />`, `<Mic />`, `<Send />`, theme toggles), explicitly add a descriptive `aria-label` attribute to ensure they are perceivable to screen-reader users, providing context on their purpose.
