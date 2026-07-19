# CLI Workflows Reference

Complete command reference for `@vertaaux/cli`. Install: `npm install -g @vertaaux/cli` or use `npx @vertaaux/cli`.

## Command Matrix

### Core Audit Commands

```bash
# Full UX audit — all 7 categories scored
vertaa audit <url> --wait --mode <basic|standard|deep>

# Accessibility-only — multi-engine (axe-core + AccessLint + custom)
vertaa a11y <url> --mode <basic|standard|deep>

# Scan alias (same as audit)
vertaa scan <url> --wait
```

### Baseline & Regression

```bash
# Create/update baseline from a completed audit job
vertaa baseline <job-id>
vertaa baseline --auto-update

# Compare current audit against stored baseline
vertaa diff
vertaa diff --job-a <id> --job-b <id> --format json
```

### AI Intelligence Pipeline

All AI commands accept input via: stdin pipe | `--file <path>` | `--job <job-id>`

```bash
# Natural language -> CLI command
vertaa suggest "check mobile usability on my homepage"

# AI-powered explanation of findings
vertaa explain                           # summary of all
vertaa explain <finding-id>              # evidence for one finding
vertaa explain --verbose                 # full evidence per issue

# Priority triage (P0/P1/P2 buckets with effort estimates)
vertaa triage
vertaa triage --verbose

# Structured remediation plan
vertaa fix-plan --json

# Safety review of a code diff
gh pr diff 123 | vertaa patch-review --job <audit-job-id>

# Release notes from audit diff
vertaa diff --job-a abc --job-b def --json | vertaa release-notes

# Before/after comparison narrative
vertaa compare --before baseline.json --after current.json

# Team playbook from recurring findings
vertaa doc --team "Frontend"
```

### Fix Generation

```bash
# Generate fix for specific issue
vertaa fix <job-id>

# Generate fixes for all issues
vertaa fix-all <job-id>

# Verify fix resolves the issue
vertaa verify
```

### Policy as Code

```bash
vertaa policy init          # Create policy file
vertaa policy validate      # Validate against policy
vertaa policy show          # Display current policy (yaml or json)
vertaa policy schema        # Show JSON schema for policies
```

### PR Comments

```bash
# Generate markdown PR comment from audit results
vertaa comment --input results.json --format markdown
```

### Utility

```bash
vertaa doctor               # Health check (config, auth, network)
vertaa login                # Interactive login
vertaa logout               # Clear credentials
vertaa whoami               # Show auth status
vertaa init                 # Create .vertaaux.yml
vertaa init --ci github --yes  # Quick init with CI template
vertaa status <job-id>      # Check job status
vertaa upload <file>        # Upload results to cloud
vertaa download <id>        # Download results from cloud
```

## Output Format Matrix

| Command | Formats | Default |
|---------|---------|---------|
| `audit` | human, json, sarif, junit, html | human |
| `a11y` | json, md | json |
| `comment` | json, markdown | markdown |
| `explain` | human, json | human |
| `policy show` | json, yaml | yaml |
| `diff` | human, json | human |
| `suggest` | human, json | human |
| `triage` | human, json | human |
| `fix-plan` | human, json | human |
| `patch-review` | human, json | human |
| `release-notes` | human, json, markdown | markdown |
| `compare` | human, json | human |
| `doc` | json, markdown | markdown |

## Machine-Readable Mode

`--machine` flag outputs strict JSON on stdout, diagnostics on stderr:

```json
{
  "meta": {
    "version": "0.5.0",
    "timestamp": "2026-02-08T12:00:00.000Z",
    "command": "audit",
    "args": ["https://example.com", "--format", "json"]
  },
  "data": { "scores": { "overall": 85 }, "issues": [] }
}
```

API keys and tokens are automatically filtered from the `args` field.

## Piping Patterns

```bash
# Audit -> JSON -> jq
vertaa audit https://example.com --format json | jq '.data.scores'

# Audit -> Explain
vertaa audit https://example.com --json | vertaa explain

# Audit -> Triage -> Fix Plan
vertaa audit https://example.com --json | vertaa triage --verbose
vertaa audit https://example.com --json | vertaa fix-plan --json

# Audit -> PR Comment
vertaa audit https://example.com --format json > results.json
vertaa comment --input results.json --format markdown

# Diff -> Release Notes
vertaa diff --job-a abc --job-b def --json | vertaa release-notes

# PR Diff -> Patch Review
gh pr diff 123 | vertaa patch-review --job <audit-job-id>
```

## Exit Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 0 | Success | Audit passed, no issues above threshold |
| 1 | Issues found | Issues at/above `--fail-on` severity |
| 2 | Error | Invalid input, validation errors, network |
| 3 | Threshold breach | Score below `--threshold` value |

## Severity vs Accessibility Impact

- General issue severity uses `error`, `warning`, `info`.
- Accessibility findings may also include impact levels `critical`, `serious`, `moderate`, `minor`.
- Use `--fail-on error` for severity-based CI gates.
- Use accessibility-specific options such as `--fail-on-findings` and CI-level `fail-on-critical` settings for impact-based gating.

## CI Gating Flags

```bash
# Fail if overall score < 80
vertaa audit https://example.com --threshold 80

# Fail if any error-severity issues
vertaa audit https://example.com --fail-on error

# Both combined
vertaa audit https://example.com --threshold 80 --fail-on error

# A11y specific
vertaa a11y https://example.com --fail-on-score 80 --fail-on-findings 5
```

## Comparison Modes

```bash
# Compare two saved audit outputs
vertaa compare --before baseline.json --after current.json

# Compare two live URLs directly
vertaa compare https://site-a.com https://site-b.com
```

## Advanced Audit Options

### Multi-Route Auditing

```bash
# Audit multiple routes in one command
vertaa audit https://example.com --routes /,/pricing,/docs,/login --wait

# Control parallel concurrency (1-50, default 3)
vertaa audit https://example.com --routes /,/pricing,/docs --concurrency 5
```

### Incremental Audits (CI Optimization)

```bash
# Only audit routes that changed since base branch
vertaa audit https://example.com --incremental --base-branch main --wait
```

### Monorepo Support

```bash
# Single workspace
vertaa audit https://example.com --workspace my-app --wait

# All workspaces in parallel
vertaa audit https://example.com --allWorkspaces --parallel

# Generate CI matrix config for monorepo
vertaa audit --detectMatrix
```

### Budget Mode

```bash
# Fast CI — basic mode, skip cache warming
vertaa audit https://example.com --budget quick

# Default balanced
vertaa audit https://example.com --budget standard

# Full deep analysis
vertaa audit https://example.com --budget full
```

### Artifact Capture

```bash
# Capture screenshots, HAR files, DOM snapshots
vertaa audit https://example.com --wait --screenshots --saveHar --domSnapshots

# Save execution trace
vertaa audit https://example.com --wait --saveTrace

# Artifacts saved to .vertaaux/artifacts/
```

### Interactive Mode

When run in a TTY without arguments, CLI enters interactive mode with:
- Categorized command menu
- Search bar for commands
- Recent commands history
- Live dashboard during operations

## Global Flags

| Flag | Effect |
|------|--------|
| `-q, --quiet` | Suppress banner and non-essential output |
| `--machine` | Strict JSON stdout, diagnostics to stderr |
| `--plain` | Strip color + ASCII-only (auto on non-TTY) |
| `--dry-run` | Show what would happen |
| `-y, --yes` | Auto-confirm prompts |
| `--verbose` | Extra detail |
| `--color` / `--no-color` | Color control |
| `--dashboard` / `--no-dashboard` | Live TUI dashboard control |
| `-b, --base <url>` | API base URL override |
| `-c, --config <path>` | Config file path |
| `--api-key <key>` | Override auth for this command |
