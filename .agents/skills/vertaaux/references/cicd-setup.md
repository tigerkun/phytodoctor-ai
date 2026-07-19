# CI/CD Setup Reference

Integrate VertaaUX into CI pipelines for automated quality gating.

## Severity vs Accessibility Impact

VertaaUX exposes two related but different dimensions:

- `severity`: `error`, `warning`, `info`
- accessibility `impact`: `critical`, `serious`, `moderate`, `minor`

Use `--fail-on error` style flags for general issue severity. Use `fail-on-critical` and `critical-count` style CI settings only for accessibility-impact gating.

## GitHub Actions (Recommended)

### Using the Official GitHub Action

```yaml
# .github/workflows/ux-audit.yml
name: UX Audit
on:
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run VertaaUX Audit
        uses: vertaaux/action@v1
        id: audit
        with:
          url: https://staging.example.com
          api-key: ${{ secrets.VERTAAUX_API_KEY }}
          mode: standard
          threshold: 80
          fail-on-critical: true
          comment-on-pr: true
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check scores
        run: |
          echo "Overall: ${{ steps.audit.outputs.overall-score }}"
          echo "Accessibility: ${{ steps.audit.outputs.accessibility-score }}"
          echo "Issues: ${{ steps.audit.outputs.issues-count }}"
          echo "Report: ${{ steps.audit.outputs.report-url }}"
```

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | yes | - | URL to audit |
| `api-key` | yes | - | VertaaUX API key |
| `github-token` | no | `${{ github.token }}` | For PR comments |
| `mode` | no | `basic` | `basic\|standard\|deep` |
| `wait` | no | `true` | Wait for completion |
| `timeout` | no | `120000` | Timeout in ms |
| `threshold` | no | - | Overall score threshold |
| `thresholds` | no | - | Per-category YAML: `usability: 70, accessibility: 80` |
| `fail-on-critical` | no | `true` | Fail on accessibility findings with `critical` impact |
| `fail-on-regression` | no | `false` | Fail on score regression |
| `comment-on-pr` | no | `true` | Post PR comment |
| `update-baseline` | no | `false` | Update baseline file |
| `baseline-file` | no | - | Path to baseline JSON |
| `config-file` | no | - | Path to .vertaaux.yml |

### Action Outputs

| Output | Description |
|--------|-------------|
| `overall-score` | Overall score 0-100 |
| `usability-score` | Usability score |
| `clarity-score` | Clarity score |
| `accessibility-score` | Accessibility score |
| `issues-count` | Total issues found |
| `critical-count` | Accessibility findings with `critical` impact |
| `report-url` | Full report URL |
| `job-id` | Audit job ID |
| `result-json` | Full JSON result |
| `regression-detected` | Whether regression detected |
| `baseline-comparison` | JSON comparison to baseline |

### Using CLI Directly in GitHub Actions

```yaml
- name: Run UX audit via CLI
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli audit https://staging.example.com \
      --mode standard \
      --wait \
      --threshold 80 \
      --fail-on error \
      --format sarif > results.sarif

- name: Upload SARIF to GitHub Security
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

### Baseline Regression Detection

```yaml
# On PRs: compare against baseline
- name: Check for regressions
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli audit https://staging.example.com \
      --wait --format json > current.json
    npx @vertaaux/cli diff

# On main merge: update baseline
- name: Update baseline
  if: github.ref == 'refs/heads/main'
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    JOB_ID=$(npx @vertaaux/cli audit https://example.com --wait --format json | jq -r '.data.job_id')
    npx @vertaaux/cli baseline $JOB_ID
    git add .vertaaux/baseline.json
    git commit -m "chore: update vertaaux baseline"
    git push
```

### Per-Category Thresholds

```yaml
- uses: vertaaux/action@v1
  with:
    url: https://staging.example.com
    api-key: ${{ secrets.VERTAAUX_API_KEY }}
    thresholds: |
      usability: 75
      accessibility: 85
      clarity: 70
      conversion: 60
```

## GitLab CI

```yaml
# .gitlab-ci.yml
ux-audit:
  image: node:20
  stage: test
  script:
    - npx @vertaaux/cli audit $CI_ENVIRONMENT_URL
        --mode standard
        --wait
        --threshold 80
        --fail-on error
        --format json > audit-results.json
    - npx @vertaaux/cli comment --input audit-results.json --format markdown > comment.md
  artifacts:
    paths:
      - audit-results.json
    reports:
      junit: audit-results-junit.xml
  variables:
    VERTAAUX_API_KEY: $VERTAAUX_API_KEY
```

## Generic CI (Any Platform)

```bash
#!/bin/bash
# ci-audit.sh — works in any CI system
set -euo pipefail

URL="${AUDIT_URL:-https://staging.example.com}"
THRESHOLD="${AUDIT_THRESHOLD:-80}"

# Run audit
npx @vertaaux/cli audit "$URL" \
  --mode standard \
  --wait \
  --threshold "$THRESHOLD" \
  --fail-on error \
  --format json > results.json

# Exit code 0 = pass, 1 = issues, 3 = threshold breach
EXIT_CODE=$?

# Generate human-readable summary
npx @vertaaux/cli explain --file results.json

exit $EXIT_CODE
```

## Accessibility-Only CI Gate

```yaml
# Focused a11y check — faster, stricter
- name: Accessibility gate
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli a11y https://staging.example.com \
      --mode deep \
      --fail-on-score 80 \
      --fail-on-findings 3 \
      --format md > a11y-report.md
```

## PR Comment Workflow

```yaml
# Audit + post rich PR comment
- name: Audit and comment
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli audit $DEPLOY_URL --wait --format json > results.json
    COMMENT=$(npx @vertaaux/cli comment --input results.json --format markdown)
    gh pr comment ${{ github.event.pull_request.number }} --body "$COMMENT"
```

## Configuration File for CI

```yaml
# .vertaaux.yml — commit to repo root
$schema: https://vertaaux.ai/schemas/config.json

mode: standard
threshold: 80
failOn: error

output:
  format: auto
  groupBy: severity

baseline:
  path: .vertaaux/baseline.json
  autoUpdate: false

ci:
  template: github

timeout: 60000
interval: 5000
```

Quick init: `vertaa init --ci github --yes`

## Policy-as-Code for CI

Advanced quality gating with branch overrides and bypass labels:

```yaml
# vertaa.policy.yml
$schema: https://vertaaux.ai/schemas/policy.json
version: "1"
name: "Production Quality Gate"

assertions:
  fail_on: error
  overall_score: 70
  max_new_errors: 0
  max_new_warnings: 5
  max_categories:
    accessibility: 3
    performance: 2

branches:
  main:
    pattern: "^main$|^master$"
    assertions:
      overall_score: 80
      max_new_errors: 0

bypass_labels:
  - "release-hotfix"
  - "critical-security-fix"

rule_overrides:
  - rule_id: "a11y/wcag-heading-hierarchy"
    enabled: false
    reason: "Not applicable to SPA"
```

```bash
# Initialize policy
vertaa policy init --template strict

# Validate policy syntax
vertaa policy validate

# Show effective policy (with branch overrides applied)
vertaa policy show
```

## Monorepo CI

```yaml
- name: Detect workspaces
  run: |
    # Generate CI matrix from monorepo
    npx @vertaaux/cli audit --detectMatrix > matrix.json

- name: Audit all workspaces
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli audit $DEPLOY_URL \
      --allWorkspaces --parallel --threshold 80
```

## Incremental CI (Only Changed Routes)

```yaml
- name: Incremental audit
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    npx @vertaaux/cli audit $DEPLOY_URL \
      --incremental --base-branch main \
      --wait --threshold 80
```

## Multi-URL CI Audit

```yaml
- name: Audit critical pages
  env:
    VERTAAUX_API_KEY: ${{ secrets.VERTAAUX_API_KEY }}
  run: |
    URLS=(
      "https://staging.example.com"
      "https://staging.example.com/pricing"
      "https://staging.example.com/signup"
    )
    FAILED=0
    for url in "${URLS[@]}"; do
      echo "Auditing $url..."
      npx @vertaaux/cli audit "$url" --wait --threshold 80 --fail-on error || FAILED=1
    done
    exit $FAILED
```
