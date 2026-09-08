# 🌿 Phytodoctor AI — Architectural Walkthrough & Physical Genre Transformation

## 📜 Series Progress: Pages 1 through 9 Completed

1. **Home.tsx**: The Victorian Estate Conservatory & Potting Bench (`.skin-conservatory`)
2. **BotanicalLab.tsx**: The Expedition Naturalist's Wet Lab & Microscope Station (`.skin-lab`)
3. **Vault.tsx**: The Royal Specimen Herbarium & Climate Terrarium (`.skin-herbarium`)
4. **Clinic.tsx & CaseStudy.tsx**: The Botanical Sanatorium & Herbal Dispensary (`.skin-sanatorium`)
5. **Library.tsx**: The Ancient Guild Codex & Naturalist Folio (`.skin-codex`)
6. **Arena.tsx**: The Sun-Drenched Terra Coliseum (`.skin-coliseum`)
7. **Assistant.tsx**: The Chief Botanist's Study & Telegram Correspondence Desk (`.skin-study`)
8. **PlantDetail.tsx**: The Expeditionary Specimen Field Dossier & Botanical Binder (`.skin-specimen`)
9. **Profile.tsx**: The Guild Master's Field Passport & Fellowship Ledger (`.skin-identity`)

---

## 🏛️ Page 9: The Guild Master's Field Passport & Fellowship Ledger (`/profile`)

### 1. Architectural & Aesthetic Identity
`Profile.tsx` has been transformed from a generic card layout into a bespoke, tactile botanical guild credentials booklet and consular ledger issued under the authority of the *Herbarium Societas Botanica (District IV)*.

### 2. Key Deliverables & Physical Artifact Breakdown

#### A. Field Passport Booklet Cover & Foliation (`.passport-buckram-booklet`)
- **Buckram Texture & Stitched Edge**: Deep botanical green cloth cover with fine woven texture created via mathematical CSS repeating linear and radial gradients (`.passport-buckram-booklet`, `.passport-stitch-border`).
- **Cloth Spine Binding Tape**: Heavy canvas spine tape reinforcement with brass trim (`.passport-spine-tape`).
- **Debossed Gold Foil Insignia**: Debossed typography and emblem crest with inset highlight and drop-shadow (`.gold-foil-debossed`).
- **Security Banknote Guilloche Pages**: Cream security vellum pages with mathematical geometric cross-hatch watermark lines and corner borders (`.passport-visa-folio`, `.guilloche-frame`). Full `:root[data-theme="night"]` night mode support.

#### B. Tintype Member Locket & Official Visa Stamp
- **Oval Brass Bezel Locket (`.tintype-locket`)**: Framed member portrait in an oval brass locket with brass hinge (`.tintype-hinge`), multi-layer metallic bevel, and daguerreotype/tintype tone grading.
- **100% Offline Victorian Engraved Monogram Medallion**: Pure CSS/SVG offline monogram medallion with naturalist initials and sanctuary master inscription, completely eliminating external `dicebear` image requests to preserve strict zero external assets discipline.
- **Jeweler's Adjustment Key**: Interactive brass key toggle (`<Edit2 />`) to engrave and update call sign, avatar URL, honorific title, experience tier, and cultivation habitat.
- **Consular Inked Visa Stamp (`.consular-visa-stamp`)**: Tilted (-6°) circular consular ink seal:
  `★ ROYAL FELLOWSHIP ACCREDITATION · SANCTUARY MASTER · REG. FOLIO-xxxx-GM ★`

#### C. Stamped Consular Ledger & Canopy Vigilance
- **Vigilance Franking Stamp**: Double-ring circular ink franking stamp showing active streak days, harvest seed multiplier, personal best streak record, and monthly streak freeze allowance stamp.
- **Mastery Accreditation**: Calibrated XP progress bar, current guild level tier title (Sprout, Germinator, Leaf-Bearer, etc.), milestone unlock, and dedicated Max Level cap handling ("Highest Fellowship Order · Eternal Bloom", "Guild Master Prestige").

#### D. Guild Membership Plinth & Seed Vault
- **Engraved Copper Credentials Plate (`.copper-plate`)**: Metallic polished copper plinth with 4 corner brass rivets (`.copper-rivet`), displaying fellowship grade (`PRO COMMISSION` vs `APPRENTICE CANDIDATE`).
- **One-Click Commission Upgrade**: Tactile action button on the plinth to upgrade fellowship tier and claim 1,000 bonus seeds via `GameService.upgradeToPro()`.
- **Circular Franking Seals**: 4 circular consular stat stamps displaying Seed Treasury balance, Living Herbarium count, Mythic Accessions, and Vigilance Days.

#### E. Consular Distinctions & Fellowship Seals (Badges)
- **Metallic Guild Seals (`.consular-seal-badge`)**: Embossed medallion style badges with scalloped concentric borders, metallic gold/bronze luster when unlocked, and weathered archival slate when locked:
  - *Week One Vigil* (7-day surveillance)
  - *Herbarium Collector* (5+ specimens)
  - *Guild Scholar* (Pro commission)
  - *Grand Advancer* (1,000+ total XP)
  - *Centurion Scout* (100+ total XP)
  - *Mythic Custodian* (1+ mythic specimen)

#### F. Consular Seed Treasury & Diurnal Care Check-In Visas (`.seed-treasury-ledger`)
- **Dual Consular Folio Tabs**: Seamlessly switch between the *Consular Seed Treasury Ledger* and *Diurnal Care & Check-In Visas*.
- **Diurnal Check-In Visa Franking**: Stamped entries recording specimen names, inspection timestamps, observed changes, and inked health score visa seals (`★ FRANK: XX% HEALTH`).
- **Apothecary Link**: Direct tactile navigation to *The Sunday Heirloom Bazaar & Open-Air Apothecary Stall* (`/market`).

#### G. Consular Field Instruments & Dispatch Settings
- **Antique Mechanical Brass Switches (`.passport-toggle-switch`)**:
  - **Acoustic Harmonic Resonance**: Audio sound effects toggle with sample chime preview (stored in `botanical_audio_enabled`).
  - **Tactile Seal Impressions**: Haptic vibration feedback toggle with test pulse (stored in `botanical_haptic_enabled`).
  - **Consular Daily Telegrams**: Dispatch notifications toggle (stored in `botanical_notifications_enabled`).
  - **Passport Surrender (Sign Out)**: Safe confirmation dialogue that flushes auth credentials and redirects to `/auth`.

---

## 🧪 Test Matrix & Verification Record

### 1. Assert-Based Self-Check (`src/services/profileService.check.ts`)
Run via `npx tsx src/services/profileService.check.ts`:
- ✅ **Test 1: XP-to-Level Progression Curve & Boundaries**:
  - 0 XP → Level 1 ("Sprout", 0% progress, 100 XP to next, `isMaxLevel: false`)
  - 50 XP → Level 1 ("Sprout", 50% progress, 50 XP to next)
  - 100 XP → Level 2 ("Germinator", 0% progress)
  - 175 XP → Level 2 ("Germinator", 50% progress, 75 XP to next)
  - 700 XP → Level 5 ("Leaf-Bearer")
  - 43,000 XP → Level 25 ("Eternal Bloom", 100% progress, 0 XP to next, `isMaxLevel: true`)
  - 65,000 XP → Level 25 ("Eternal Bloom", 100% progress, 0 XP to next, `isMaxLevel: true`, next title: "Guild Master Supreme")
  - Negative XP (-250) → Clamped safely to Level 1 (0 XP)
  - NaN XP → Clamped safely to Level 1 (0 XP)
- ✅ **Test 2: Badge Unlocking Criteria & Strict Boundaries**:
  - Novice criteria correctly computes 0 unlocked badges.
  - Boundary: streak 6d, 4 cards, 99 XP → all locked.
  - Boundary: streak 7d, 5 cards, pro tier, 100 XP, 1 mythic → unlocks respective badges.
  - Veteran criteria correctly computes all 6 badges unlocked.
- ✅ **Test 3: Passport Visa & Streak Multipliers**:
  - Negative days (-5) / NaN → 1.0x fallback.
  - 0d / 3d / 6d → 1.0x
  - 7d / 10d / 13d → 2.0x
  - 14d / 29d → 2.5x
  - 30d / 59d → 3.0x
  - 60d / 65d / 99d → 3.5x
  - 100d / 105d → 5.0x
- ✅ **Test 4: Deterministic Folio Serial**:
  - Format `FOLIO-xxxx-GM` is stable and reproducible for any user ID.
  - Empty string and null fallback gracefully to default hash.
- ✅ **Test 5: Settings Toggle Parser**:
  - Correctly serializes and deserializes boolean settings with defaults for null, undefined, 'true', 'false', and unknown inputs.

### 2. Root Cause Bug Fixes
- **Issue 1 (`RewardService.updateLevel`)**: `LEVEL_TIERS.find(t => t.xpRequired <= newXP)` previously evaluated against ascending tiers starting from Level 1 (`xpRequired: 0`), resulting in Level 1 being permanently selected regardless of accumulated XP. Fixed with reversed scan and relative interval math.
- **Issue 2 (`Profile.tsx` Live Query DB Mutation Loop)**: `RewardService.ensureLevelProgress` and `ensureStreakRecord` perform DB writes via `db.put()`. Invoking them directly inside `useLiveQuery` triggered reactive write cycles. Moved initializations into `useEffect` and converted `useLiveQuery` calls to pure indexed reads with explicit `[userId]` dependencies.
- **Issue 3 (External DiceBear Dependency)**: Removed external image fetching (`https://api.dicebear.com/...`) in favor of a 100% offline, zero-network SVG/CSS engraved monogram tintype medallion.
- **Issue 4 (Missing Check-in History in Folio 3)**: Added dual-tab consular ledger showing both seed transactions and diurnal care check-in visas with franking stamps.

### 3. Static Type Check (`npm run lint`)
- Command: `tsc --noEmit`
- Result: **0 errors** (Exit code 0).

### 4. Production Build (`npm run build`)
- Command: `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
- Result: **0 errors** (Exit code 0).
- Pure client-side bundle: `dist/assets/index-D7U5R784.js` (no `node:assert` browser bundle pollution).
