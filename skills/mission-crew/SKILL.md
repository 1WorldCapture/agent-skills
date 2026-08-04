---
name: mission-crew
description: >
  Coordinate a Captain → PM mission workflow: clarify a high-level goal with the
  user, write a temporary OpenSpec BRIEF, kick off an isolated worktree with only
  a PM agent, and have the PM turn that BRIEF into an OpenSpec proposal. Use when
  the user mentions mission-crew, Captain/PM, multi-agent task kickoff, OpenSpec
  proposal from a brief, worktree mission isolation, or wants to start a crew for
  a change without implementing the full design/coding/verification pipeline yet.
---

# Mission Crew

Two-level mission orchestration. The user appoints **Captain**. Captain appoints
**PM** through an inline prompt. Later, PM will appoint other agents the same way;
that team dispatch is **not** in v1.

## Role routing

1. Read the appointment in your current prompt (or the user's request).
2. Resolve the role file **relative to this `SKILL.md`** (not relative to your cwd):
   - Captain → `roles/captain.md`
   - PM → `roles/pm.md`
3. Follow that role file for duties and workflow. Keep this `SKILL.md` as the
   shared contract (artifacts, appointment rules, v1 limits).
4. If the user is starting a mission and has not appointed another role, act as
   **Captain** (user appointment).
5. Do not invent a role. If the appointment is missing or unknown, ask.

## Appointment chain

| Who | Appointed by | How |
| --- | --- | --- |
| Captain | User | User asks to run `mission-crew` / act as Captain |
| PM | Captain | Inline prompt from kickoff |
| Other agents | PM | Inline prompt — **not in v1** |

Every appointment prompt must include:

- Role id (`captain`, `pm`, …)
- Skill name `mission-crew`
- Mission `slug` and relevant paths

Appointed agents apply this skill and then follow the role file next to this
`SKILL.md` for the appointed role.

## Shared artifact contract

| Artifact | Path | Lifetime |
| --- | --- | --- |
| Brief (temporary) | `openspec/changes/<slug>/BRIEF.md` | Written in the main checkout, **moved** into the worktree at kickoff, deleted by PM after an aligned proposal exists |
| Proposal | `openspec/changes/<slug>/proposal.md` | Created by PM inside the worktree; remains as the handoff |

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

`Mission type` is optional in v1 (reserved for later team shapes). Empty optional
sections may be omitted.

## v1 scope

**In scope**

- Captain clarifies high-level intent with the user
- Captain ensures OpenSpec (base + agent tool skills) is initialized in the main checkout
- Captain writes BRIEF, runs `scripts/kickoff-pm.sh`, appoints PM only
- PM reads BRIEF, creates the proposal via the OpenSpec propose skill,
  self-checks alignment, deletes BRIEF
- Captain polls the PM pane for `PM_DONE` and verifies the proposal exists

**Out of scope (do not do in v1)**

- PM kicking off Design / Coding / Verification agents
- Writing `design.md`, delta specs, or `tasks.md` as part of this skill's required flow
- Implementing product code for the mission

Reserved team shapes for a later version:

- feature: PM → Design → Coding → Verification
- bugfix: PM → Design&Coding → Verification
- architecture: PM → Design → Verification

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
