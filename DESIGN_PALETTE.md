# PhytoDoctor AI — Conclusive Design Palette & Genre Architecture Commentary

> **Audit Source:** Extracted directly and comprehensively from [`src/styles/page-skins.css`](file:///d:/phytodoctor-ai/src/styles/page-skins.css) and [`src/styles/tokens.css`](file:///d:/phytodoctor-ai/src/styles/tokens.css).
> **Scope:** 14 dedicated genre skins, component class accents, texture mechanics, temperature cluster analysis, and actionable widening recommendations.

---

## 1. Master Skin Registry & Background Color Spectrum

PhytoDoctor AI employs a named skin architecture where each core route possesses a dedicated CSS class root that overrides backgrounds, textures, borders, and tactile accents:

| # | Skin Class | Route / Page | Victorian / Botanical Archetype | Light Base Palette (Primary Hex) | Dark Base Palette (Primary Hex) |
|---|---|---|---|---|---|
| 1 | `.skin-conservatory` | Home (`/`) | Victorian Estate Conservatory & Oiled Teak Potting Bench | `var(--bg-primary)` (`#FAF7F2`) | `var(--bg-primary)` (`#0F1419`) |
| 2 | `.skin-library` | Library (`/library`) | Ancient Guild Codex & Naturalist Folio | `#F7F2E7` & `#F5EFE3` → `#F4EDE1` | `#16120E` & `#181410` → `#120E0A` |
| 3 | `.skin-arena` | Arena (`/arena`) | Sun-Drenched Terra Coliseum & Tournament Grounds | `#F6EFE2` / Header `#231911` | `#14100C` / Header `#0E0A07` |
| 4 | `.skin-lab` | Botanical Lab (`/lab`) | Instrument Wet Bench & Coordinate Graph Paper | `#E8EEE8` & `#D5E2D6` | `#111613` & `#0D120F` |
| 5 | `.skin-consult` | Assistant (`/consult`) | Chief Botanist's Study & Telegram Correspondence Desk | `#F3EFE6` & `#EAE3D2` → `#E8E0CE` | `#121613` & `#101511` → `#0D120E` |
| 6 | `.skin-clinic` | Clinic (`/clinic`) | Botanical Sanatorium & Herbal Dispensary | `#F8F5EE` → `#EDE6D6` | `#181512` → `#110E0C` |
| 7 | `.skin-vault` | Collection (`/vault`) | Royal Specimen Herbarium & Hermetic Climate Terrarium | `#F8F3E8` → `#EEE4CF` | `#181410` → `#100D0A` |
| 8 | `.skin-identity` | Profile (`/profile`) | Guild Master's Field Passport & Fellowship Ledger | `#F2ECE1` & `#EDE6D6` → `#EEE6D8` | `#15120E` & `#181410` → `#16120E` |
| 9 | `.skin-exchange` | Shop (`/shop`) | Greenhouse Glass (Seed Exchange) | `#C5D9C4` (Mint) → `#EEF5EE` → `#F7F4EE` | *Inherits single-mode glass tint* |
| 10 | `.skin-bazaar` | Market (`/market`) | Sunday Bazaar Outdoor Stall & Spice Crates | `#F5EAD6` & `#F0DFC4` → `#E8D5B0` (Terracotta) | `#181210` & `#14100C` → `#120E0A` |
| 11 | `.skin-specimen` | Plant Detail (`/plant/:id`) | Expeditionary Specimen Field Dossier | `#231A12` (0–160px header) / `#F4EEE3` (body) | `#120E0A` (header) / `#16120E` (body) |
| 12 | `.skin-lineage` | Pedigree (`/lineage`) | Royal Genealogist's Family Tree Scroll | `#F3E9D2` (Aged parchment gold) | `#18130E` (Dark vellum) |
| 13 | `.skin-gatekeeper` | Auth (`/auth`) | Gatekeeper Guest Ledger & Entry Folio | `#FAF6EE` → `#F4EEE1` | `#181411` → `#100D0B` |
| 14 | `.skin-lost` | 404 (`*`) | Nocturnal Forest (Lost in the Overgrowth) | `#121812` → `#1C2418` (Always Night) | `#121812` → `#1C2418` (Inherently Dark) |

---

## 2. In-Depth Genre Breakdown & Micro-Component Classes

Each genre defines specific tactile and historical artifacts using dedicated CSS component classes:

### 1. Conservatory (Home)
- **Concept:** Greenhouse ironwork, teak plant stands, slate stakes.
- **Micro-Components:**
  - `.leaded-transom`: Geometric greenhouse transom lines using `#3C4B3C` (`rgba(60, 75, 60, 0.4)`) and diagonal mullions `#5A7D5A` (`rgba(90, 125, 90, 0.15)`).
  - `.oiled-teak-frame`: Dual-tone borders `rgba(120, 80, 50, 0.28)` over parchment `#FDFBF7`.
  - `.brass-bezel`: Radial metallic sheen `#FFFBF0` (0%) → `#FAECD0` (65%) → `#E0C285` (100%) with gold edge `#C5A059`.
  - `.zinc-stake` / `.slate-stake`: Deep geological accents (`#4B5563` → `#1F2937` and `#334155` → `#1E293B`).

### 2. Library (The Ancient Guild Codex)
- **Concept:** Open folio crease, vellum leaves, illuminated drop caps.
- **Micro-Components:**
  - **Spine Crease:** Center debossed leather shadow at `50%` with opacity graduation from `rgba(40, 25, 12, 0.03)` up to `rgba(15, 8, 3, 0.15)`.
  - `.illuminated-drop-cap`: Multi-stop gold leaf gradient (`#B8860B` → `#D4AF37` → `#8A5A12` → `#D4AF37`).
  - `.ribbon-bookmark`: Vermilion silk (`#D32F2F` → `#B71C1C` → `#7F0000`) with gold star bookmark tack `#FFF9C4`.
  - `.ink-cancellation-stamp`: Archival red ink cancellation mark `rgba(175, 45, 35, 0.65)` (`#AF2D23`).

### 3. Arena (The Sun-Drenched Coliseum)
- **Concept:** Roman travertine ashlar masonry courses, chiseled numerals, clay prize tokens.
- **Micro-Components:**
  - **Masonry Grid:** Horizontal ashlar courses spaced at `54px/56px` (`rgba(160, 120, 80, 0.07)`).
  - `.sandstone-banner`: High contrast header `#362618` to `#22160D` with antique brass border `#9E7A46`.
  - `.clay-token`: Terracotta baked discs (`#E67D4D` → `#C45727` → `#8F3411`), pro gold token (`#F7D468` → `#D4AF37`), and spent token (`#8C786C` → `#42352E`).
  - `.bronze-laurel-disc`: Deep warm metallic radial (`#F3C27E` → `#C48738` → `#8C5218` → `#5A2E0A`).

### 4. Lab (Instrument Bench & Graph Paper)
- **Concept:** Cool precision, millimeter dissection grids, brass lens bezels, chemical litmus scales.
- **Micro-Components:**
  - **Graph Substrate:** Cartesian coordinate grid `24px x 24px` in green ink `rgba(61, 107, 74, 0.07)`.
  - `.dissection-board`: Dual 1mm/5mm graph grids over `#F7FAF6`.
  - `.brass-eyepiece`: Concentric milled rings (`#E8D39C`, `#B89552`, `#7A602F`).
  - `.litmus-paper-track`: Continuous chemical reaction gradient: `#D97736` (Acidic) → `#E3A847` (Neutral) → `#8FA352` (Alkaline) → `#2D6A4F` (Basic Pine).

### 5. Consult (Chief Botanist's Study)
- **Concept:** Dark green desk blotters, telegram slips, brass telegraph keys.
- **Micro-Components:**
  - `.desk-blotter`: Deep hunter-green leather (`#1C3324` → `#223C2C` → `#101E15`) with gold saddle-stitch border `rgba(212, 175, 55, 0.45)`.
  - `.tactile-postal-stamp`: Franking postal stamp with purple postal ink border `#BA93F5` and background `#8E44AD` (`rgba(142, 68, 173, 0.12)`).
  - `.telegraph-key-send`: Turned brass key button (`#FFF0B8` → `#D4AF37` → `#8C6A1E` → `#5A4210`).

### 6. Clinic (The Botanical Sanatorium)
- **Concept:** Masonite clipboards, apothecary prescription slips, red quarantine ribbons.
- **Micro-Components:**
  - `.masonite-clipboard`: Pressed fiberboard gradient (`#D2B38C` → `#BF9E74` → `#AB8B62`) with stamped border `#7D5934`.
  - `.tactile-clipboard-clip`: Polished steel clamp with spring highlights (`#E2E8F0` → `#64748B` → `#334155`).
  - `.quarantine-ribbon`: Hazard diagonal caution tape (`#DC2626` and `#18181B`).
  - `.brass-scale-gauge`: Analytical balance face (`#FCF8EC` → `#F4EBD2` → `#E2D1A8`).

### 7. Vault (Royal Specimen Herbarium)
- **Concept:** Dark walnut specimen drawers, brass cup pulls, stamped red wax seals.
- **Micro-Components:**
  - `.walnut-drawer`: Dark wood grain (`#3D271A` → `#26170E`) with brass rim `#CDA85C`.
  - `.brass-cup-pull`: Stamped drawer handle (`#E0BD60` → `#9E7B25`).
  - `.tactile-wax-seal`: Glossy stamp wax in imperial crimson (`#CB3224` → `#A21C12` → `#6A0E07`).
  - `.sepia-accession-mark`: Archival museum accession numbering in brown iron gall ink (`#8C552D`).

### 8. Identity (Guild Master's Passport)
- **Concept:** Bound buckram passport, tintype portrait lockets, consular visa stamps.
- **Micro-Components:**
  - `.passport-buckram-booklet`: Forest buckram cloth (`#1C2B20` → `#223628` → `#18261C`) with gold dashed stitch (`#D4AF37`).
  - `.tintype-locket`: Metal bezel locket (`#FFF4CF` → `#C59F48` → `#6A4F1D`) housing the user avatar.
  - `.consular-visa-stamp`: Stamped consulate endorsements in Terra Rust (`#8B2500`), Indigo Maritime (`#1E3A5F`), and Forest (`#244B2F`).

### 9. Exchange & Bazaar (Commerce & Stalls)
- **Shop (`.skin-exchange`):** Cold greenhouse morning mist (`#C5D9C4` → `#EEF5EE` → `#F7F4EE`) evoking glass panes and seedlings.
- **Market (`.skin-bazaar`):**
  - Background: Warm sun-baked terracotta (`#F0DFC4` → `#F5EAD6` → `#E8D5B0`) with radial spice aura `rgba(193, 127, 89, 0.18)` and woven crate lattice lines.
  - `.awning`: Tri-color striped market stall canopy (`#C17F59` terracotta, `#F4E4C1` warm linen, `#5A7D5A` moss green).
  - `.bazaar-tab.is-on`: Charcoal leather tab `#3D2A1C` with warm parchment lettering `#F4E4C1`.

### 10. Specimen (Field Dossier)
- **Concept:** Dual-surface field notebook — dark leather header with cream specimen cards.
- **Micro-Components:**
  - Top 160px: Near-black expeditionary calfskin (`#231A12`) grounding botanical photography.
  - Bottom: Light botanical mat `#FDFBF7` with genuine photo corner mounts (`#5A4531`).
  - `.dossier-notebook-ruled`: Red ledger margin rule `rgba(200, 70, 70, 0.15)` (`#C84646`).

### 11. Lineage (Royal Genealogist's Scroll)
- **Concept:** Continuous parchment scroll rolled over wooden spindles with brass finials.
- **Micro-Components:**
  - `.spindle-dowel`: Lathe-turned wood roller (`#6E4E32` → `#442F1D` → `#281B10`).
  - Brass Finials: Turned brass caps (`#F0D68A` → `#C5A059` → `#7E5E26`).
  - Ground: Deep honey vellum `#F3E9D2` with 25% gold ambient illumination.

### 12. Gatekeeper (Auth Registry)
- **Concept:** Heavy brass-bound guest book on an entrance lectern.
- **Micro-Components:**
  - Heavy leather outer border: `#5A3D28` with inner gold perimeter `rgba(197, 160, 89, 0.35)`.
  - `.ledger-seal-button` (Login): Deep guild green (`#2E4A34` → `#1C3322`) with gold border `#C5A059`.
  - `.ledger-inscribe-button` (Signup): Polished gold ingot (`#C5A059` → `#A47F3B`) with dark spruce typography `#1E2B1E`.

---

## 3. The "Temperature Cluster" Analysis

An analytical scan of the light-mode background color temperatures reveals two distinct behavioral patterns:

### The "Cream/Beige" Core Cluster
Many pages share background values that fall within a narrow luminous range:
- **Conservatory (Home):** `#FAF7F2` (L: 97%, Warm Eggshell)
- **Clinic:** `#F8F5EE` → `#EDE6D6` (L: 96% → 89%, Bone Chalk)
- **Library:** `#F7F2E7` (L: 94%, Pale Vellum)
- **Arena:** `#F6EFE2` (L: 93%, Sandstone White)
- **Vault:** `#F8F3E8` → `#EEE4CF` (L: 94% → 87%, Pale Oat)
- **Consult:** `#F3EFE6` (L: 93%, Light Driftwood)
- **Identity:** `#F2ECE1` (L: 92%, Soft Flax)
- **Gatekeeper:** `#FAF6EE` → `#F4EEE1` (L: 96% → 92%, Cream Linen)

*Diagnostic Observation:* While their decorative overlays (grids, leather spine shadows, and transom lines) are distinct, their base tonal temperatures sit close together on initial render.

### The Contrast Breakers
Currently, six genres deliberately break out of the beige cluster:
1. **Specimen (`.skin-specimen`):** Uses an authoritative `#231A12` dark leather header contrasting against `#F4EEE3` paper.
2. **Lab (`.skin-lab`):** Switches temperature to cool sage/mint `#E8EEE8` and graph-paper `#D5E2D6`.
3. **Exchange (`.skin-exchange`):** Employs an ethereal, pale greenhouse glass tint `#C5D9C4` and `#EEF5EE`.
4. **Bazaar (`.skin-bazaar`):** Injects a warm sun-baked terracotta spice tone `#F0DFC4` → `#E8D5B0` with `#C17F59` accents.
5. **Lineage (`.skin-lineage`):** Enriched honey-gold parchment `#F3E9D2` with 25% amber radiants.
6. **Lost (`.skin-lost`):** Deep charcoal night forest (`#121812` → `#1C2418`).

---

## 4. Conclusive Recommendations for Widening Base-Tone Variation

To make every transition feel like stepping into a distinct architectural space, consider these targeted base-tone adjustments:

1. **Library (`/library`): Widen toward warm antiquarian paper**
   - *Current:* `#F7F2E7`
   - *Recommendation:* Shift slightly warmer toward aged foxed rag paper (`#F2E7D0` to `#EADBBE`), increasing the vellum glow intensity to evoke candlelit stacks.
2. **Arena (`/arena`): Shift toward warm limestone & sunbaked brick**
   - *Current:* `#F6EFE2`
   - *Recommendation:* Ground the bottom area with sun-baked terra cotta dust (`#EFE0CE` → `#E4CFB8`), accentuating the contrast against the `#231911` coliseum header.
3. **Vault (`/vault`): Introduce cool metallic archival hues**
   - *Current:* `#F8F3E8`
   - *Recommendation:* Shift toward leaded glass and cool stone vaulting (`#EDECE8` with subtle pewter tint `rgba(100, 115, 120, 0.04)`), emphasizing hermetic preservation.
4. **Consult (`/consult`): Enrich the botanist's study ambiance**
   - *Current:* `#F3EFE6`
   - *Recommendation:* Let the hunter green of the `.desk-blotter` (`#1C3324`) inform subtle ambient perimeter vignettes, creating the feel of private study lamplight.

---

*Authored and verified directly against PhytoDoctor AI's production stylesheets.*
