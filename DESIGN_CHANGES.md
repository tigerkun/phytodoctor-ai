# PhytoDoctor AI — Design & Thematic Overhaul Documentation

This document provides a comprehensive record of the design overhaul implemented across the **PhytoDoctor AI** application.

---

## 1. Executive Summary & Design Vision

### The Problem
Previously, the application relied on a uniform digital interface: identical flat dark/light backgrounds, translucent glass cards (`backdrop-blur`), and standard dashboard typography across every page. This created visual monotony where a diagnostic clinic, an ancient botanical library, a marketplace, and a laboratory all looked indistinguishable.

### The Solution: Thematic "Physical Spaces" Skinning
Every primary route in the application has been redesigned into a **distinct physical environment** with bespoke textures, color gradients, tactile borders, and custom typography accents. A new stylesheet (`src/styles/page-skins.css`) introduces 12 curated visual skins, transforming the web app from a standard software dashboard into an immersive, tangible botanical world.

---

## 2. Core Architecture & Global Styles

### A. New Stylesheet: `src/styles/page-skins.css`
Contains standalone, low-specificity CSS classes that inject subtle backgrounds, grids, gradients, and custom chrome into each route without breaking Tailwind or existing utility classes.

### B. Global Integration: `src/index.css`
Imported `@import "./styles/page-skins.css";` directly alongside Tailwind and design tokens, ensuring zero runtime overhead and instant styling availability across all components.

### C. App Shell & Layout: `src/components/Layout.tsx`
- Refined container padding and removed conflicting outer boundary backgrounds so that individual page skins can extend edge-to-edge seamlessly.
- Maintained strict authentication guard protection while allowing background ambiances to render cleanly.

---

## 3. The 12 Page Skins & Visual Motifs

| Skin Class | Target Route | Motif & Atmosphere | Visual Characteristics |
| :--- | :--- | :--- | :--- |
| **`.bazaar-mast` / `.awning`** | `/market` | Old-world bazaar & rustic trading stall | Striped tricolor awning (`#c17f59`, `#f4e4c1`, `#5a7d5a`), wooden crate cards, ask-price tags, tabbed parchment headers. |
| **`.skin-lab`** | `/lab` | Instrument bench & telemetry grid | Subtle double graph-paper grid lines (`rgba(61, 107, 74, 0.07)`), sage base (`#e8eee8`), monospace diagnostic kicker labels (`#3d6b4a`). |
| **`.skin-library`** | `/library` | Ancient herbarium reading room | Split dark-to-parchment background (`#1a1510` to `#f3ead9`), emerald radial glow, bound botanical plates (`.lib-plate`), gold and moss typography. |
| **`.skin-arena`** | `/arena` | Care-off coliseum night | Deep obsidian-to-earth gradient (`#120e0b` to `#efe6d4`), gold trim (`#d4af37`), sharp geometric counter boxes (`.arena-stat`). |
| **`.skin-consult`** | `/assistant` | Botanist desk blotter | Lined notebook paper repeat grid, structured cream container (`#f7f4ee`) with retro offset hard shadow (`8px 8px 0 #3d4a3d`). |
| **`.skin-clinic`** | `/clinic` | Sterile diagnostic ward | Cool mint-tinted medical backdrop (`#f4f7f4` to `#eef2ee`) with soft radial vignette (`rgba(90, 125, 90, 0.14)`). |
| **`.skin-vault`** | `/vault` | Archival dossier & simulation desk | Aged manila paper tones (`#f7f2e6` to `#efe6d2`) with warm amber radial backlight (`rgba(196, 160, 53, 0.12)`). |
| **`.skin-identity`** | `/profile` | Diplomatic botanical passport | Diagonal security hatching (-32deg fine gradient), grounded beige tones (`#e9e2d2` to `#f6f1e6`). |
| **`.skin-exchange`** | `/shop` | Victorian greenhouse glass | Vertical mullion glass panel stripes (`rgba(90, 125, 90, 0.08)`), conservatory gradient (`#c5d9c4` to `#f7f4ee`). |
| **`.skin-specimen`** | `/plants/:id` | Specimen herbarium mounting board | Deep espresso top banner (`#2a1f16`) transitioning into an ivory display sheet (`#f4eee3`). |
| **`.skin-lineage`** | `/pedigree/:id` | Ancestral golden pedigree | Radiant overhead gold halo (`rgba(212, 175, 55, 0.22)`) on parchment (`#f4ead4`). |
| **`.skin-lost`** | `404 / NotFound` | Deep overgrown wilderness | Dark nocturnal forest gradient (`#121812` to `#1c2418`), luminescent moss backlight, and glowing compass indicator. |

---

## 4. Navigation & Header Enhancements

### `src/components/home/NavigationBar.tsx`
- **Streamlined Route Hierarchy**:
  - Renamed *"Botanical Lab"* to **"Lab"** for a cleaner desktop footprint.
  - Promoted **"Arena"** directly into the primary top navigation for instant care-off access.
  - Links: `Home`, `Lab`, `Market`, `Library`, `Arena`.
- **Refined Active Indicators**:
  - Replaced thick indicator blocks with a precise `0.5` line underline (`h-0.5`) in theme accent.
  - Replaced heavy multi-property transitions with high-performance, smooth transitions (`background 0.6s ease, border-color 0.6s ease`).
- **Polished Wallet Display**:
  - Redesigned the seed balance pill with subtle semi-transparent borders (`rgba(90,122,90,0.18)` day, `rgba(255,255,255,0.1)` night), improving contrast without glass distortion.
- **Avatar Profile Trigger**:
  - Cleaned up borders and hover physics for a more tactile button click feel.

### `src/components/home/MobileBottomNav.tsx`
- Adjusted mobile sheet background blur to `rgba(..., 0.88)` for crisper legibility over scrolling content.
- Removed redundant drop shadows and normalized border opacities for smoother scrolling on mobile GPUs.

---

## 5. Detailed Page-by-Page Breakdown

### 1. Market (`src/pages/Market.tsx`) — *Major Feature & UI Upgrade*
- **Visual Overhaul**:
  - Tricolor striped awning banner (`.awning`).
  - Products presented as rustic market crates with ask-price badges (`rotate-6 bg-[#fff8e8] border border-[#c4a574]`).
  - Authentic market tabs (`.bazaar-tab`) with active ink stamp styling (`.bazaar-tab.is-on`).
- **Interactive & Functional Upgrades**:
  - **Local Storage Persistence**: Cart (`phyto_stall_cart`), Wishlist (`phyto_stall_wish`), and Vouchers (`phyto_stall_tickets`) now automatically persist across browser refreshes.
  - **Crate Pinning / Wishlist**: Every product card features a bookmark button to pin items directly to a new **"Saved"** tab.
  - **Quantity Controls**: Added `+` and `−` steppers inside the cart drawer.
  - **Ticket Voucher System**: Applied discount vouchers now calculate real price deductions during checkout.

### 2. Botanical Library (`src/pages/Library.tsx`)
- **Herbarium Aesthetic**: Rebranded from a generic list into *"Field notes & pathology"*.
- **Bound Plates (`.lib-plate`)**: Plant and pathology cards now resemble archival herbarium sheets with vintage cream surfaces (`#f8f1e4`) and border accents (`#c9b896`).
- **Search Header**: Restyled search bar using warm parchment background (`#f4e4c1`) with dark ink text (`#2c2419`) and subtle focus ring.

### 3. Care-Off Arena (`src/pages/Arena.tsx`)
- **Coliseum Theme**: Features a top gold-striped divider and deep shadow banner (`#1a1410` to `#3d2a1c`).
- **Stat Plates (`.arena-stat`)**: Replaced standard glass cards with obsidian and gold-bordered stat boxes highlighting specimen count and streak counters.
- **Header**: Refined badge to *"Care-Off Coliseum"* with gold italics.

### 4. Botanical AI Specialist (`src/pages/Assistant.tsx`)
- **Consultation Blotter**: Replaced floating glass bubble with a physical desk blotter motif (`.skin-consult`).
- **Desk Container**: Off-white paper enclosure (`#f7f4ee`) bordered with deep forest slate (`#3d4a3d`) and an 8px solid offset shadow (`shadow-[8px_8px_0_#3d4a3d]`).
- **Header**: Added *"Consultation desk · Master botanist"* label with green accent rules.

### 5. Botanical Lab (`src/pages/BotanicalLab.tsx`)
- **Telemetry & Bench**: Wrapped with `.skin-lab`, introducing the 24px laboratory graph grid.
- **Monospace Kicker**: Added `.lab-kicker` label (*"Specimen bench · index & telemetry"*).

### 6. Plant Detail, Pedigree & Profile
- **`src/pages/PlantDetail.tsx`**: Wrapped in `.skin-specimen` for a mounted archival specimen look.
- **`src/pages/Pedigree.tsx`**: Wrapped in `.skin-lineage` with radial gold warmth highlighting generation trees.
- **`src/pages/Profile.tsx`**: Wrapped in `.skin-identity` for a tactile passport aesthetic.
- **`src/pages/Shop.tsx`**: Wrapped in `.skin-exchange` greenhouse glass aesthetic.
- **`src/pages/Vault.tsx`**: Wrapped in `.skin-vault` archival dossier look.
- **`src/pages/NotFound.tsx`**: Wrapped in `.skin-lost` dark overgrown forest theme with luminous 404 compass.

---

## 6. Summary of Changed Files

| File | Type | Primary Purpose |
| :--- | :--- | :--- |
| `src/styles/page-skins.css` | **New File** | Contains all 12 thematic page skins, awnings, plates, and textures. |
| `src/index.css` | Modification | Imports `page-skins.css`. |
| `src/components/Layout.tsx` | Modification | Shell layout padding & full-bleed skin integration. |
| `src/components/home/NavigationBar.tsx` | Modification | Top navigation cleanup, Arena shortcut, cleaner indicator & wallet pill. |
| `src/components/home/MobileBottomNav.tsx` | Modification | Mobile navigation contrast and blur optimization. |
| `src/pages/Market.tsx` | Modification | Complete bazaar transformation + cart persistence + wishlist + vouchers. |
| `src/pages/Library.tsx` | Modification | Herbarium reading room + bound plate cards + parchment search bar. |
| `src/pages/Arena.tsx` | Modification | Coliseum night theme + gold borders + `.arena-stat` counters. |
| `src/pages/Assistant.tsx` | Modification | Master botanist consultation desk blotter + offset hard shadow container. |
| `src/pages/BotanicalLab.tsx` | Modification | Telemetry bench graph-paper grid + `.lab-kicker` metadata. |
| `src/pages/Clinic.tsx` | Modification | Sterile diagnostic ward skin. |
| `src/pages/Profile.tsx` | Modification | Physical passport/identity skin. |
| `src/pages/Shop.tsx` | Modification | Greenhouse glass exchange skin. |
| `src/pages/Vault.tsx` | Modification | Archival dossier skin for placement simulations. |
| `src/pages/PlantDetail.tsx` | Modification | Mounted specimen board skin. |
| `src/pages/Pedigree.tsx` | Modification | Golden lineage tree skin. |
| `src/pages/NotFound.tsx` | Modification | Overgrown forest wilderness 404 skin. |
