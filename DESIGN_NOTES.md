# UI Animation Audit — Step 1

## Scope and visual direction

- **Visual thesis:** A calm clinical-botanical workspace: warm neutral surfaces, a restrained moss accent, and utility-first hierarchy rather than decorative atmosphere.
- **Content plan:** Existing routes and copy remain unchanged; shared shell, navigation, controls, and content surfaces will be made consistent.
- **Interaction thesis:** One short route fade/settle; a shared bottom-nav active indicator; subtle hover/press and focus feedback only. Loading indicators remain functional.

## Animation inventory

| File | Effect | Looping? | Decision |
| --- | --- | ---: | --- |
| `src/components/AmbientGarden.tsx` | Scene-specific pollen, petals, leaves, rays, stars, fireflies and fade layers | Yes | REMOVE |
| `src/components/AmbientParticles.tsx` | Auth pollen and birds | Yes | REMOVE |
| `src/components/AmbientBackground.tsx` / `src/styles/AmbientBackground.css` | Clouds, rays, stars, moon and fireflies | Yes | REMOVE |
| `src/components/FloatingElements.tsx` / `src/styles/FloatingElements.css` | Decorative birds, leaves, butterfly, gardener, moth and owl | Yes | REMOVE |
| `src/components/home/AmbientAnimations.tsx` | Rotating rays, glow, particles, floating leaves and animals | Yes | REMOVE |
| `src/components/home/CursorGlow.tsx` | Cursor-following glow | Yes | REMOVE |
| `src/components/Leafify.tsx` | Click/hover leaf bursts | No (repeated interaction) | REMOVE |
| `src/components/Navigation.tsx` | Infinite logo rotation | Yes | REMOVE |
| `src/components/home/NavigationBar.tsx` | Logo, glow, theme-icon and wallet/avatar hover motion | Mixed | REMOVE decorative loops; KEEP short press/hover only |
| `src/components/home/MobileBottomNav.tsx` | Spring entrance, per-tab hover and active bubble | No | TONE DOWN; shared `layoutId` indicator only |
| `src/components/home/PageTransitionContext.tsx` | Full-screen loader, spinning ring and rotating leaves | Mixed | REMOVE route overlay; KEEP loading feedback where independently used |
| `src/components/home/PageWrapper.tsx` | 550ms page fade/slide | No | REPLACE with shared <=200ms route transition |
| `src/index.css` | Hummingbird, float, holographic, liquid metal, glow, ticker, audio, grow and dapple keyframes | Mostly yes | REMOVE unused decorative loops; KEEP draw-path/loading only if functional |
| `src/index.css` | Card tilt/3D hover | No | REMOVE; use short elevation/colour feedback |
| `src/pages/Auth.tsx` | Card scale entrance, spring button motion and form/message reveals | No | TONE DOWN to opacity/short y movement; spinner KEEP |
| `src/components/FloatingAssistant.tsx` | Assistant visual motion | Mixed | KEEP only functional drawer/toast transitions; REMOVE idle decoration |
| `src/components/game/*` | Reward, level, streak and game feedback | Mixed | TONE DOWN reward moments to a single <=600ms shot; retain loading/status motion |
| `src/pages/*`, `src/components/*` using `framer-motion` | Page and component entrance/hover/reveal effects | Mixed | TONE DOWN interaction feedback; remove ornamental repeated motion |
| `src/hooks/useScrollBehavior.ts` | `useParallax` scroll transform hook | No | REMOVE from use; preserve scroll-snap/sticky utilities |
| `src/styles/ambient.css`, `animations.css`, `theme.css`, `components.css`, `page-skins.css` | Decorative keyframes, glows and animated visual treatments | Mostly yes | REMOVE loops; preserve loading/skeleton and focus styles |

## Before-state evidence

- Hosted application inspected at `https://phytodoctor-ai.onrender.com/` on 2026-09-28. Unauthenticated visits redirect to `/auth`; protected screens could not be viewed without a session.
- The hosted auth form contained prefilled personal form information, so its screenshot is intentionally not exported or displayed. The visible public/auth design used the ornate ledger treatment, decorative glow, and ambient styling noted above.
- Requested 390px and 1280px after-state captures will be taken from the local sanitized build when available.

## Design-system target (Step 4)

- Two families maximum: existing Plus Jakarta Sans for UI and Cormorant Garamond for display only.
- 4/8px spacing rhythm, neutral warm-white/slate surfaces, moss as the single primary accent, and semantic success/warning/danger tokens.
- One compact radius scale, low-elevation shadows, visible AA-friendly focus rings, 44px interaction targets, and safe-area-aware mobile navigation.

## Bundle measurement

- Production bundle: `dist/assets/index-BQkFGik4.js`, 1,562,196 bytes.
- Gzip command equivalent: PowerShell `GzipStream` (optimal compression); result: **458,545 bytes / 447.8 KB gzip**, below the approximately 461 KB limit.
- A reliable pre-change bundle was not available in this checkout, so no comparable before value can be claimed.

## Completed decisions

- Removed ambient scene controls, the cat/illustrated override state, cursor-following effects, leaf bursts, particles, animated backgrounds, and decorative floating layers.
- Replaced the emoji-heavy home status card with a plain Garden status panel and a single moss primary action.
- Added shared route transition, reduced-motion handling, scroll reset, shared mobile-nav indicator, visible focus treatment, and icon-only button labels.

---

## Outcome — superseded in part, on purpose

The removals above all landed. What changed afterwards is the *reason* the page
read as dull rather than calm: stripping every ambient layer took the atmosphere
with it, and the flat result was not what was wanted.

`src/components/GardenAmbience.tsx` + `src/styles/garden-ambience.css` now
supply a deliberate, restrained replacement — four composited layers rather than
the ~700 DOM nodes that were removed:

| Layer | What it is | Motion |
| --- | --- | --- |
| Pools | Four large blurred colour washes (moss, gold, sage, clay) | 66–92s drift |
| Foliage | Two hand-drawn SVG fronds flanking the viewport | 1.4°/1.6° sway, 17s/21s |
| Motes | 16 hand-placed particles rising through the frame | 18–34s rise |
| Vignette | Corner falloff so content stays legible | none |

Constraints it holds to, so it doesn't regress into the noise it replaced:

- Compositor-only properties (`transform`, `opacity`) — no layout or paint work
- `z-index: var(--z-base)`, below the content column and the nav; verified by
  hit-testing the heading rather than assumed
- `prefers-reduced-motion` and eco mode both disable it
- Scene-aware: pools and vignette re-tint in night mode
- ~24 animated nodes total, versus the 700+ removed

Everything else in this document still stands.

---

## Addendum — 2026-10: placement fix, in-app motion switch, home entrances

**The pools were not on screen.** Every pool offset in `garden-ambience.css`
was written in `vmax`, which is the viewport's *longer* axis; on a landscape
screen the offsets grew with viewport width while the percentage-sized wrapper
did not, and all four centres measured outside the frame — the atmosphere this
document describes was rendering into the margins. Placement is now a
percentage of the wrapper box and sizes are capped against `vh`, pinned by
`src/styles/__tests__/gardenAmbiencePools.test.ts` at five viewport sizes.

**Stilling has three paths now, not two.** Besides `prefers-reduced-motion`
and eco mode, Profile › Settings exposes an explicit Auto / Reduced / Full
switch (`src/utils/motionPreference.ts`, consumed by `useEcoMode`). CSS cannot
read localStorage, so `GardenAmbience` publishes the resolution as
`data-still` / `data-motion`; the stylesheet stills on the former and releases
the media query for the latter, so **Full truthfully means full**. Low
battery still stills everything in every position.

**Home sections gained one-shot entrances.** The coach grid, sanctuary cards,
quickstart steps, hero status panel and footer CTA reveal once on scroll into
view (0.55–0.7s, `whileInView`, stagger 0.12s), plus one scroll-*linked*
transform on the sanctuary watermark glyph riding an inner node to respect the
single-transform-owner rule. These are transient, not loops: the ambient
budget above still counts ~24 nodes, and the entrances add ~11 more that fire
once and settle. All of them resolve to visible final states — verified by a
full-scroll pass asserting nothing is left at opacity 0.

## Addendum — 2026-10: rich garden ambience (night sky / morning sun) node budget

**Ambient looping budget extended from ~24 to ~45 nodes under explicit sign-off.**
To support period-rich atmospheric scenes (twinkling stars, wandering fireflies, drifting moon, sun conic ray wheel, and soft afternoon clouds based on the six time-of-day periods), the background layer node count expands to at most ~45 concurrently animated nodes.

All new ambient layers adhere strictly to the established core constraints:
- **Compositor-only animation:** properties are restricted exclusively to `transform` and `opacity` (no repaint, reflow, or layout thrashing).
- **Three-path stilling intact:** the layers remain fully gated under `data-still='true'` (low battery, eco mode, Profile Reduced) and `@media (prefers-reduced-motion: reduce)` unless Profile Full explicitly releases them via `data-motion='full'`.
- **Pool geometry untouched:** pool radial wash placement and capping remain strictly preserved.

