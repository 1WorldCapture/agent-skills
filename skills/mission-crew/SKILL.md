---
name: mission-crew
description: >
  Coordinate a Captain → PM → Design/Impl/QA mission workflow over OpenSpec:
  clarify a high-level goal with the user, write a temporary OpenSpec BRIEF,
  kick off an isolated worktree with a PM agent, and let PM drive the pipeline
  (explore → propose → apply → verify) inside the worktree. Use when the user mentions mission-crew, Captain/PM, multi-agent
  task kickoff, OpenSpec proposal from a brief, worktree mission isolation, or
  wants to run a feature change through a small agent crew.
---

# Mission Crew

Two-level mission orchestration. The user appoints **Captain**. Captain appoints
**PM** through an inline prompt. PM appoints **Design**, **Impl**, and **QA**
the same way, one at a time, inside the mission worktree.

## Role routing

1. Read the appointment in your current prompt (or the user's request).
2. Resolve the role file **relative to this `SKILL.md`** (not relative to your cwd):
   - Captain → `roles/captain.md`
   - PM → `roles/pm.md`
   - Design → `roles/design.md`
   - Impl → `roles/impl.md`
   - QA → `roles/qa.md`
3. Follow that role file for duties and workflow. Keep this `SKILL.md` as the
   shared contract (artifacts, appointment rules, scope limits).
4. If the user is starting a mission and has not appointed another role, act as
   **Captain** (user appointment).
5. Do not invent a role. If the appointment is missing or unknown, ask.

## Appointment chain

| Who | Appointed by | How | Agent kind (default) |
| --- | --- | --- | --- |
| Captain | User | User asks to run `mission-crew` / act as Captain | — |
| PM | Captain | Inline prompt from `scripts/kickoff-pm.sh` | cursor |
| Design | PM | Inline prompt from `scripts/kickoff-worker.sh` | codex (gpt-5.6-sol, high effort) |
| Impl | PM | Inline prompt from `scripts/kickoff-worker.sh` | grok |
| QA | PM | Inline prompt from `scripts/kickoff-worker.sh` | codex (gpt-5.6-sol, high effort) |

Every appointment prompt must include:

- Role id (`captain`, `pm`, …)
- Skill name `mission-crew`
- Mission `slug` and relevant paths

Appointed agents apply this skill and then follow the role file next to this
`SKILL.md` for the appointed role.

## Shared artifact contract

| Artifact | Path | Lifetime |
| --- | --- | --- |
| Brief (temporary) | `openspec/changes/<slug>/BRIEF.md` | Written in the main checkout, **moved** into the worktree at kickoff, refined by PM during explore, deleted by Design after aligned propose artifacts exist |
| Proposal / design / specs / tasks | `openspec/changes/<slug>/proposal.md`, `design.md`, `specs/`, `tasks.md` | Created by Design via the OpenSpec propose skill, faithful to the BRIEF |
| Implementation | worktree diff | Written by Impl via the OpenSpec apply-change skill; verified and fixed by QA |

## Completion signals

| Signal | Emitted by | Watched by | Meaning |
| --- | --- | --- | --- |
| `DESIGN_DONE slug=<slug>` | Design | PM | proposal.md, design.md, specs, tasks.md ready and aligned; BRIEF deleted |
| `IMPL_DONE slug=<slug>` | Impl | PM | tasks.md implemented in the worktree |
| `QA_DONE slug=<slug>` | QA | PM | implementation verified and issues fixed |
| `PM_DONE slug=<slug>` | PM | Captain | whole pipeline finished (only after QA_DONE) |

Watch a worker's signal with an anchored `pane wait-output` regex
(`^[^[:alnum:]]{0,3}DESIGN_DONE ` etc.) on `recent-unwrapped`, never
`agent wait` — the appointment prompt echo contains the marker text, agents
render final messages with different prefixes (cursor two-space indent, codex
a `• ` bullet), and agent status events can miss transitions on background
panes. Keep each wait at ~5 minutes and repeat on timeout.

Rules:

- Prefer **move** (`mv`) for BRIEF. Do not leave a main-checkout copy after kickoff.
- After move, remove an empty `openspec/changes/<slug>/` directory from the main checkout.
- OpenSpec **project init** (the `openspec/` base) belongs in the main checkout so
  future worktrees can inherit committed structure. Init with
  `openspec init --tools claude,codex,cursor` so the per-tool propose/apply
  skills and slash commands (`.claude/`, `.codex/`, `.cursor/`) exist for PM and
  later crew agents. For grok CLI agents, bridge the same skills via symlinks
  under `.grok/skills/` (OpenSpec has no `grok` tool; grok discovers repo
  skills there). BRIEF still moves explicitly because it may be uncommitted.
- A git worktree only materializes committed files. If Captain created or
  refreshed the OpenSpec base, Captain must commit the relevant `openspec/`
  additions **and** the tool dirs (`.claude/`, `.codex/`, `.cursor/`, `.grok/`) —
  or clearly record that the user declined — before kickoff; otherwise the
  worktree will not inherit the base.
- `slug` must be a safe directory/agent suffix: start with `[a-z]`, then
  `[a-z0-9_-]`, keep it short so `pm-<slug>` fits live agent name limits
  (`[a-z][a-z0-9_-]{0,31}`).

## BRIEF minimum fields

```markdown
# Brief: <slug>

## Goal

## Success criteria

## Non-goals

## Constraints

## Mission type

feature | bugfix | architecture
```

`Mission type` is optional. Only `feature` runs the full pipeline today;
`bugfix` and `architecture` stop after the proposal stage (see
`roles/pm.md`). Empty optional sections may be omitted.

## Current scope

**In scope (feature pipeline)**

- Captain clarifies high-level intent with the user
- Captain ensures OpenSpec (base + agent tool skills) is initialized in the main checkout
- Captain writes BRIEF, runs `scripts/kickoff-pm.sh`, appoints PM only
- PM reads BRIEF and runs the OpenSpec **explore** flow: investigate the
  codebase, refine BRIEF (no scope growth)
- PM kicks off Design → Impl → QA sequentially via `scripts/kickoff-worker.sh`,
  waits for each `*_DONE`, then emits `PM_DONE`
- Design runs the OpenSpec **propose** flow (proposal + design + specs +
  tasks), self-checks against BRIEF, deletes BRIEF
- Impl runs the OpenSpec **apply-change** flow; QA verifies and fixes
- Captain watches the PM pane for `PM_DONE` and verifies the artifacts exist

**Out of scope (do not do)**

- `bugfix` and `architecture` mission types (reserved team shapes:
  bugfix = PM → Design&Impl → QA, architecture = PM → Design → QA)
- Parallel crew agents (the pipeline is strictly sequential)
- `openspec archive`, committing, merging, or opening PRs for the mission
- Any agent starting agents other than the appointments above

## Tooling notes

- Kickoff uses a terminal agent runtime CLI (`herdr`) for worktree + agent start.
  Role files describe the commands; do not brand the skill around that runtime.
- OpenSpec CLI: install with `npm install -g @fission-ai/openspec@latest` only
  after user approval when missing. Init non-interactively with
  `openspec init --tools claude,codex,cursor`. OpenSpec supports no `grok`
  tool (through 1.7.0); for grok CLI agents, symlink the four
  `.claude/skills/openspec-*` dirs into `.grok/skills/` (see
  `roles/captain.md` step 3). Grok repo skills respect `.gitignore`, so commit
  `.grok/skills`.
- Kickoff script path (from this skill root): `scripts/kickoff-pm.sh`.
