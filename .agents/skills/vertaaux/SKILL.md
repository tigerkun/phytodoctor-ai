---
name: vertaaux
description: Run and operationalize VertaaUX UX, accessibility, and conversion audits across CLI, CI/CD, SDK, API, and MCP. Use when the user needs to audit a URL, investigate WCAG issues, set quality gates, compare audit runs, select an audit profile, or generate remediation plans from VertaaUX results.
license: MIT
metadata:
  author: vertaaux
  version: "1.3.0"
---

# VertaaUX

Use VertaaUX to audit live experiences, explain findings, and turn results into CI gates or fix plans.

## When to Use

- Run a full UX audit for a live URL
- Run or interpret accessibility and WCAG-focused scans
- Set up VertaaUX in CI/CD or PR quality gates
- Compare audit runs, baselines, or regressions
- Generate triage, fix plans, or patch reviews from audit output
- Integrate VertaaUX through the SDK, API, or MCP server
- Pick the right audit profile for the task at hand

## Fast Path

| Goal | Surface | Command |
|------|---------|---------|
| Full audit | CLI | `vertaa audit <url> --profile quick-ux --wait` |
| Accessibility scan | CLI | `vertaa a11y <url> --mode deep --profile wcag-aa` |
| PR or CI gate | GitHub Action / CI | See [CI/CD setup](references/cicd-setup.md) |
| Programmatic workflow | JS or Python SDK | See [SDK & API](references/sdk-api.md) |
| Agent integration | MCP Server | See [SDK & API](references/sdk-api.md#mcp-server) |

## Quick Example

```bash
# Authenticate once
vertaa login

# Run an audit and inspect the result
vertaa audit https://example.com --wait --format json > audit.json
cat audit.json | vertaa explain
cat audit.json | vertaa triage
```

## Audit Profiles

Profiles bundle category selection, weight overrides, score thresholds, and mode into a single `--profile` flag. Prefer profiles over ad-hoc flag combinations — they are reusable, documented, and consistent across surfaces.

| Profile | Use for | Mode |
|---------|---------|------|
| `wcag-aa` | WCAG 2.2 AA compliance, accessibility-focused deep scan | deep |
| `conversion-focus` | CTA, funnel, UX friction (Pro tier) | standard |
| `quick-ux` | Fast dev-time sanity check across all categories | basic |
| `ci-gate` | PR quality gate with strict thresholds | standard |
| `compliance` | Regulated industries (healthcare, finance, government) | deep |

Precedence: CLI flag > config file > profile > default. So `--profile ci-gate --threshold 95` still uses 95 as the overall threshold.

Custom profiles can be defined in `.vertaaux.yml` under a `profiles:` key. See [Audit Profiles](references/audit-profiles.md) for the full schema, a profile selection decision tree, and a current limitation: profile category filtering currently applies to scoring and quality gate evaluation, but does not yet skip auditors at the worker level.

## Recommended Workflow

1. Pick the lightest surface that fits the task.
   Use the CLI for one-off audits, CI for gates, and SDK/API or MCP only when the workflow needs automation.
2. Authenticate before deeper work.
   Use `vertaa login` or set `VERTAAUX_API_KEY` before running commands that need cloud access.
3. Run the smallest audit that answers the question.
   Pick a profile that matches the goal: `wcag-aa` for accessibility, `quick-ux` for general dev-time checks, `ci-gate` for PR gates, `conversion-focus` for funnel work, `compliance` for regulated audits. Default to `quick-ux` if no other profile fits.
4. Convert results into action.
   Pipe results into `vertaa explain`, `vertaa triage`, `vertaa fix-plan`, `vertaa compare`, or `vertaa patch-review` depending on whether the user needs diagnosis, prioritization, or remediation.
5. Verify before claiming completion.
   See "Verification — Closing the Loop" below. Re-run the audit after any fix.
6. Load deeper references only when the task actually needs them.
   Use the matching reference below instead of inlining every edge case into the main skill.

## Audit Model

| Category | Weight | Focus |
|----------|--------|-------|
| `accessibility` | 20% | WCAG 2.2, ARIA, contrast, labels, focus |
| `conversion` | 20% | CTA strength, funnel gaps, trust, friction |
| `usability` | 20% | Heuristics, responsiveness, cognitive load |
| `clarity` | 15% | Messaging, hierarchy, scannability |
| `ia` | 10% | Navigation, grouping, findability |
| `semantic` | 8% | Landmarks, headings, structured markup |
| `keyboard` | 7% | Focus order, traps, skip links |

Notes:

- Free tier nulls `conversion`, `semantic`, and `keyboard`; Pro unlocks all categories.
- Findings are ordered by severity: `error`, `warning`, `info`.
- Accessibility impact levels are `critical`, `serious`, `moderate`, `minor`.
- Severity and accessibility impact are different fields. Commands such as `--fail-on error` use severity, while `fail-on-critical` style CI options refer to accessibility impact.
- Fixability values are `mechanical`, `contextual`, and `visual`.

## AI Follow-up Commands

All of these accept stdin, `--file`, or `--job`. See [CLI Workflows](references/cli-workflows.md) for complete usage.

| Command | Purpose |
|---------|---------|
| `suggest <intent>` | Natural language to CLI command |
| `explain` | Explain findings or surface evidence |
| `triage` | Bucket work into priorities with effort |
| `fix-plan` | Build an ordered remediation plan |
| `patch-review` | Review a diff against audit findings |
| `compare` | Describe before/after deltas |
| `release-notes` | Turn audit diffs into dev or PM notes |
| `doc` | Build a repeatable team playbook |

Comparison notes:

- Use `vertaa compare --before <file> --after <file>` for saved audit outputs.
- Use `vertaa compare <url-a> <url-b>` when comparing live URLs directly.

## Verification — Closing the Loop

After applying any fix, always re-verify objective outcomes before claiming the issue is resolved.

**Auto-verify (close the loop):** WCAG contrast, missing alt text, broken links, schema markup presence, threshold gates. Re-run the same audit on the same URL and confirm the specific finding's `id` no longer appears in `issues[]`.

**Human-verify (leave open):** CTA wording, brand voice, visual hierarchy, conversion copy. Surface to the user — do not auto-resolve.

**Hard rule:** After `vertaa fix` or `vertaa fix-all`, the next action is always re-running the same audit. No exceptions.

## Drift Prevention

Prevent fabrication and stale guidance. Apply before answering, not after.

1. **Never invent flags or commands.** If unsure whether `vertaa <command> --some-flag` exists, read [CLI Workflows](references/cli-workflows.md) before suggesting it.
2. **Never invent API parameters.** Read [SDK & API](references/sdk-api.md) first.
3. **Always pipe in machine format.** Use `--format json` or `--machine` when chaining commands. Never parse human-readable output — it changes between releases.
4. **Prefer skill references over general knowledge.** WCAG and UX heuristics vary by source. The references are aligned with what the runtime checks.
5. **Profile names are fixed.** Built-in: `wcag-aa`, `conversion-focus`, `quick-ux`, `ci-gate`, `compliance`. Any other name must come from the user's `.vertaaux.yml`.

## References

Load only the reference that matches the active task:

- [Audit Profiles](references/audit-profiles.md) for built-in profile definitions, custom profile schema, decision tree, and current limitations
- [CLI Workflows](references/cli-workflows.md) for command syntax, formats, piping, and advanced options
- [CI/CD Setup](references/cicd-setup.md) for GitHub Actions, baselines, thresholds, and regression gates
- [SDK & API](references/sdk-api.md) for JS/Python SDK usage, REST API calls, webhooks, and MCP setup
- [Use Case Playbooks](references/use-cases.md) for task recipes (deterministic step sequences) and step-by-step workflows such as accessibility audits, monitoring, competitive analysis, and remediation
- [Skill Composition Contracts](references/skill-contracts.md) for the VertaaUX-team convention on inputs/outputs/composes handoffs between this skill and `a11y-review`, `create-analyzer`, and `architecture-review`
