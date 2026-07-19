# Audit Profiles

Named presets that bundle category selection, weight overrides, score thresholds, mode, and quality gate assertions into a single `--profile` flag.

## When to use a profile

- **Use a profile when** you want a reusable, named audit configuration that bundles depth, category focus, and thresholds — the common case for CI gates, compliance scans, and team workflows.
- **Skip profiles when** you need a one-off audit with custom flags that don't match any preset.

Profile values are lower precedence than explicit CLI flags, so `--profile ci-gate --threshold 95` still uses 95 as the overall threshold.

**Precedence:** CLI flag > config file > profile > default

## Built-in profiles

### `wcag-aa`

WCAG 2.2 AA compliance audit — accessibility-focused deep scan.

| Field | Value |
|-------|-------|
| Categories | `accessibility`, `keyboard`, `semantic` |
| Weights | accessibility: 0.55, keyboard: 0.25, semantic: 0.20 |
| Thresholds | accessibility: 85 |
| Mode | `deep` |
| Fail on | `warning` |
| Max new errors | 0 |

**Use when:** Running a WCAG compliance audit, preparing for accessibility certification, or gating PRs on a11y regressions.

```bash
vertaa audit https://example.com --profile wcag-aa --wait
vertaa a11y https://example.com --profile wcag-aa
```

### `conversion-focus`

Conversion optimization audit — CTA, funnel, and UX friction analysis.

| Field | Value |
|-------|-------|
| Categories | `conversion`, `usability`, `clarity` |
| Weights | conversion: 0.45, usability: 0.30, clarity: 0.25 |
| Thresholds | conversion: 75 |
| Mode | `standard` |
| Fail on | `error` |

**Use when:** Optimizing landing pages, checkout flows, or any page with a primary conversion goal. Pro tier only (conversion is gated).

```bash
vertaa audit https://example.com --profile conversion-focus --wait
```

### `quick-ux`

Fast UX scan across all categories — speed over depth.

| Field | Value |
|-------|-------|
| Categories | all |
| Weights | default |
| Thresholds | none |
| Mode | `basic` |
| Fail on | `error` |

**Use when:** Running a quick sanity check during development, iterating on design, or needing sub-30s feedback.

```bash
vertaa audit https://example.com --profile quick-ux --wait
```

### `ci-gate`

CI/CD quality gate — strict thresholds for PR blocking.

| Field | Value |
|-------|-------|
| Categories | all |
| Weights | default |
| Thresholds | overall: 80 |
| Mode | `standard` |
| Fail on | `warning` |
| Max new errors | 0 |
| Max new warnings | 0 |

**Use when:** Gating PRs in GitHub Actions, GitLab CI, or any pipeline that should block regressions.

```bash
vertaa audit https://example.com --profile ci-gate --wait
```

### `compliance`

Full compliance audit — strict a11y for regulated industries.

| Field | Value |
|-------|-------|
| Categories | `accessibility`, `semantic`, `keyboard` |
| Weights | accessibility: 0.55, semantic: 0.25, keyboard: 0.20 |
| Thresholds | overall: 85, accessibility: 90 |
| Mode | `deep` |
| Fail on | `warning` |
| Max new errors | 0 |
| Max new warnings | 0 |

**Use when:** Working in regulated industries (healthcare, finance, government) where WCAG compliance is legally required.

```bash
vertaa audit https://example.com --profile compliance --wait
```

## Profile decision tree

```
Does the audit need to pass/fail in CI?
├─ YES → Is it WCAG compliance-focused?
│        ├─ YES → --profile wcag-aa (or compliance for stricter)
│        └─ NO  → --profile ci-gate
└─ NO  → Is it conversion-focused?
         ├─ YES → --profile conversion-focus
         └─ NO  → --profile quick-ux
```

## Custom profiles

Define custom profiles in `.vertaaux.yml`:

```yaml
profiles:
  my-team-gate:
    name: my-team-gate
    description: Frontend team's PR gate
    categories: [accessibility, usability, clarity]
    thresholds:
      accessibility: 90
      overall: 80
    mode: standard
    assertions:
      fail_on: warning
      max_new_errors: 0

# Set as default for this project
profile: my-team-gate
```

Use the custom profile:

```bash
vertaa audit https://example.com --profile my-team-gate --wait
```

Custom profiles take precedence over built-ins with the same name, so you can override `wcag-aa` for team-specific tuning.

## Profile vs policy vs config

VertaaUX has three overlapping configuration layers. Here's when to use each:

| Layer | What it does | When to use |
|-------|-------------|-------------|
| **Profile** (`--profile`) | Bundles categories, weights, thresholds, mode for a specific audit intent | Team workflows, named presets, most common case |
| **Policy** (`vertaa.policy.yml`) | Org-wide quality gates with branch-specific overrides and rule severity | Enforcing org standards across all repos |
| **Config** (`.vertaaux.yml`) | Per-project defaults for mode, output, baseline | Project-level defaults that don't need profile semantics |

Profiles are the right default for most users. Use policy files when you need branch-specific rules or org-wide governance.

## Known Limitation: Worker-Side Category Filtering

**As of the initial profile release**, the `categories` field on a profile affects scoring and quality gate evaluation but does **not** yet skip auditors in the cloud worker.

**What works today:**
- Weight overrides — `computeWeightedOverall()` accepts the profile's weights and recomputes the overall score accordingly
- Threshold overrides — quality gate uses the profile's thresholds via `buildQualityGateConfig()`
- Mode override — `--profile wcag-aa` automatically uses `mode: deep` unless `--mode` is passed
- Assertion overrides — `fail_on`, `max_new_errors`, etc. flow through to the gate

**What does NOT work yet:**
- The cloud worker still runs all 7 auditors regardless of `profile.categories`. So `--profile wcag-aa` does NOT save audit time today — it filters/reweights post-run.
- Findings from excluded categories are still in `result.issues[]`. Use `--category` to filter at output time as a workaround:

```bash
# Workaround: filter to only profile categories at the CLI
vertaa audit <url> --profile wcag-aa --category accessibility,keyboard,semantic --wait
```

**When this will be fixed:** Phase 1.5 in the skill evolution plan threads `categories` through the SDK → API → worker → engine boundary. This requires SDK contract changes and is tracked separately.

## Verification

After running an audit with a profile, verify:

1. The expected categories ran (check `skipped` in JSON output — categories not in the profile will be listed)
2. The overall score uses the profile's weights (if weight overrides applied)
3. The quality gate fails/passes according to the profile's thresholds

```bash
# Verify categories ran
vertaa audit https://example.com --profile wcag-aa --format json | jq '.scores'

# Verify skipped categories (conversion, usability, clarity, ia should be absent)
vertaa audit https://example.com --profile wcag-aa --format json | jq '.metadata.skipped'
```
