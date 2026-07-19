# Skill Composition Contracts (VertaaUX convention)

**Scope:** This is a VertaaUX-team convention for skills inside `.claude/skills/vertaaux/` and the supporting skills it composes with (`a11y-review`, `create-analyzer`, `architecture-review`). It is **not** a general rule imposed on every skill in this repo — Anthropic-owned skills (e.g., `skill-creator`) are out of scope.

**Status:** Convention-based, documentation-only. No runtime validation. The value is making composition explicit and discoverable so Claude can chain skills reliably without guessing what one skill expects from another.

## Why contracts

The VertaaUX skill can surface findings that naturally hand off to other skills — e.g., a low accessibility score that deserves an `a11y-review` pass, or a gap in analyzer coverage that should trigger `create-analyzer`. Without explicit contracts, every handoff is a guess about what the next skill needs, which is exactly the kind of drift Phase 2 ("Drift Prevention") is meant to kill.

Contracts answer three questions for any skill:

1. **Inputs** — what does the skill need to start?
2. **Outputs** — what does it produce that a downstream skill can consume?
3. **Composes** — which other skills does it hand off to, and under what conditions?

When two skills' contracts line up (the output of one matches the input of another), Claude can chain them deterministically.

## Contract shape

Add a `contracts:` block to the skill's YAML frontmatter. Keep it short — the body of the skill is still the authoritative source of truth for behavior.

```yaml
---
name: my-skill
description: ...
contracts:
  inputs:
    - name: url
      type: string
      required: true
      description: Target URL to audit
    - name: profile
      type: enum
      values: [wcag-aa, conversion-focus, quick-ux, ci-gate, compliance]
      required: false
  outputs:
    - name: audit-result
      type: json
      description: Full audit result with scores and issues
    - name: exit-code
      type: integer
      values: [0, 1, 2, 3]
  composes:
    - skill: a11y-review
      when: "accessibility score < 70 or user mentions deep accessibility review"
    - skill: create-analyzer
      when: "findings indicate missing analyzer coverage for a category"
---
```

### Field rules

- **`inputs`** — each entry has `name`, `type`, `required`, optional `description` and `values` (for enums). Types: `string`, `integer`, `boolean`, `enum`, `json`, `path`.
- **`outputs`** — same shape, minus `required`. Describe what a downstream skill can rely on.
- **`composes`** — each entry names a target `skill` and a `when` condition (plain English, trigger-phrase-friendly). The target skill SHOULD declare matching inputs in its own contract.

### Things contracts do NOT do

- No runtime validation — Claude reads the contract, not a parser.
- No versioning — if a skill's contract changes, update all composers in the same PR.
- No enforcement that all skill authors add contracts — this is a VertaaUX-scoped convention.

## Composition rules (for the composing skill)

When declaring `composes:`, follow these rules so handoffs stay deterministic:

1. **`when` conditions MUST be evaluable from outputs.** Don't reference state the composing skill doesn't produce. "When the user is frustrated" is not evaluable. "When accessibility score < 70" is.
2. **Target skills MUST exist and be discoverable.** Don't reference a skill that isn't installed, and don't rename a skill without updating every composer.
3. **One handoff per composition rule.** Chain rules are fine (A → B → C), but each step is a single `when`.
4. **Composition is a suggestion, not a jump.** Claude surfaces the handoff to the user; the user decides.

## Rules for the composed (target) skill

When another skill declares you as a target in `composes:`, your contract SHOULD:

1. **Declare inputs that match the upstream skill's outputs** — if `vertaaux` hands off `audit-result` (json), `a11y-review`'s inputs should accept a json audit result.
2. **Not assume the user re-describes the problem.** The composing skill already narrowed the scope; act on what was passed, don't re-interview.
3. **Produce outputs the user can act on** — fixed issues, a decision, a diff — not another handoff into the void.

## Verification

After adding or updating a contract:

1. **Syntax check** — the frontmatter must still be valid YAML. `grep -A 20 "^contracts:" <file>` and eyeball the indentation.
2. **Input/output matching** — for every `composes:` entry, open the target skill and confirm its `inputs` accept what you produce.
3. **Sanity trigger** — ask Claude to run a scenario that should trip the `when` condition and verify it suggests the target skill.

## Relationship to other Phase 2/3 infrastructure

- **Decision tree (SKILL.md Phase 2A)** routes the initial user request to the right skill.
- **Drift prevention (SKILL.md Phase 2C)** keeps a skill from hallucinating flags or features.
- **Contracts (this doc)** govern what happens *after* a skill runs — which other skill the output flows into.
- **Task recipes (`references/use-cases.md` Phase 2D)** are deterministic step sequences. A recipe MAY internally invoke a contract handoff when a step produces output that triggers a `when` condition.

Contracts are the handoff protocol between recipes. A recipe ends; its output matches the next skill's input contract; Claude surfaces the composition.
