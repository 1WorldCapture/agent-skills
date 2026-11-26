---
name: zcode-agent-bootstrap
description: Bootstrap, repair, validate, or inspect a portable Agent workspace that works across Zcode, Cursor, Codex, and Google Antigravity. Use when a project needs a root AGENTS.md, a shared .agents/skills skill root, identity and behavior files, auditable memory, routines, logs, artifacts, and safe idempotent re-runs.
---

# Cross-Harness Agent Bootstrap

Use this skill from the root of a project that should behave as one persistent Agent workspace. The project root is the Agent home, ordinary conversations are reactive runs, and each Harness may provide its own scheduler for proactive routines.

## Portable baseline

The cross-Harness minimum is deliberately small:

```text
AGENTS.md
.agents/
└── skills/
    └── <skill-name>/
        ├── SKILL.md
        ├── scripts/       (optional)
        ├── references/    (optional)
        └── assets/        (optional)
```

The same skill package can be installed in the following places:

- Cursor, Codex, and Antigravity: project `.agents/skills/<name>/`.
- Zcode: project `.zcode/skills/<name>/` or user `~/.zcode/skills/<name>/`. Zcode also accepts the `.agents/skills` convention in current versions, but use `.zcode/skills` as the explicit fallback when discovery is uncertain.

Do not make `.agents/commands`, `.agents/rules`, `.agents/workflows`, `.cursor/rules`, or `.codex/` part of the required baseline. Their formats and discovery behavior are platform-specific. Add them only as optional adapters after confirming the active Harness.

Use the root `AGENTS.md` as the only shared instruction entry point. Cursor and Codex can merge more specific instructions, while Zcode does not recursively load nested `AGENTS.md`; therefore the portable contract must work with the root file alone.

## Operating contract

- Operate only inside the current project root. Do not inspect or modify parent directories, other projects, credentials, or unrelated user files.
- Keep one logical Agent per project. Put business material under `PROJECTS/` and keep the portable skill root under `.agents/skills/`.
- Make initialization idempotent. Create missing paths, skip existing files, and report conflicts. Never overwrite existing `AGENTS.md`, identity files, memory, routines, or user project files without an explicit request.
- Keep secrets out of Markdown, YAML, memory, logs, prompts, and reports. Refer to Harness-managed credentials by name only.
- Treat `FILESYSTEM.md` as an auditable contract, not as a runtime object automatically understood by every Harness.
- Treat `MEMORY/` as versionable Agent memory. Any Harness-native memory feature is an optional cache and should not be the only copy of important facts.
- Treat `ROUTINES/` as versioned proactive intent. Writing a routine file does not create a scheduler entry.

## Choose the mode

Resolve `scripts/bootstrap.py` relative to this `SKILL.md`, then run it from the project root:

```bash
python3 <skill-directory>/scripts/bootstrap.py --root "$PWD" --mode bootstrap
```

Supported modes:

- `bootstrap`: create the complete cross-Harness baseline and state file.
- `repair`: create only missing baseline paths and preserve existing content.
- `validate`: read only and report missing paths, unresolved placeholders, malformed metadata, and secret-like values.
- `status`: read only and summarize the baseline, legacy paths, and bootstrap state.
- `board-init`: opt in to the Vercel Board integration for this project. It never runs as part of `bootstrap`.

Run Board initialization only after the baseline exists:

```bash
python3 <skill-directory>/scripts/bootstrap.py --root "$PWD" --mode board-init
```

This mode asks for the Board URL (blank uses the linked/default team Board), the stable Agent profile used with `--as`, optional channels, and an initial `observe`, `progress`, or `worker` policy. It runs the project-scoped `npx skills add vercel/board --skill board --yes`, which never prompts for the target agents, then creates `INTEGRATIONS/VERCEL_BOARD.md` and `ROUTINES/vercel-board-triage.md`. It does not create a Zcode Scheduled Task, store credentials, or overwrite existing project files. For automation, pass `--non-interactive --board-profile <profile>` and the other `--board-*` options explicitly.

When this skill is invoked from a conversational Harness, ask the user for the missing non-secret values in chat, then call the script with `--non-interactive`; do not ask the user to paste a token or cookie. A direct terminal invocation can use the interactive prompts.

Use `--dry-run` for a preview. Pass only facts supplied by the user or visible in the project:

```text
--agent-id <lowercase-id>
--name <display name>
--role <role>
--mission <one-sentence mission>
--language <locale>
--timezone <IANA timezone>
--model <model label, if specified>
--tools <comma-separated capabilities>
--skills <comma-separated domain skills>
```

If identity or mission details are missing, use conservative defaults and mark editable fields as `TODO`. Never invent permissions, credentials, or personal facts.

## Workflow

1. **Orient.** Confirm the current directory is the intended project root. Inspect only the root and known baseline paths. Detect existing `AGENTS.md`, `.agents/`, `FILESYSTEM.md`, and bootstrap state before writing.
2. **Plan.** Run `--dry-run` when the project is non-empty. Present created, skipped, and conflicting paths before a non-trivial repair.
3. **Scaffold.** Run `bootstrap` for a new project or `repair` for an existing one. The script creates missing paths and preserves user content.
4. **Inspect the contract.** Read `FILESYSTEM.md` and the root `AGENTS.md`. Confirm that the startup protocol loads recent memory and the `.agents/skills/README.md` index on demand, rather than assuming every Harness loads every file automatically.
5. **Customize deliberately.** Complete `SOUL.md`, `IDENTITY.md`, `USER.md`, `TOOLS.md`, `SECURITY.md`, and the mission section of `AGENTS.md` only after showing the generated placeholders. Preserve the portable file map and safety rules.
6. **Use portable skills.** Put each reusable domain capability in `.agents/skills/<name>/SKILL.md`. Keep frontmatter to the common `name` and `description` fields. Put scripts, references, and assets beside that `SKILL.md`. Do not create a second root `SKILLS/` directory.
7. **Define proactive work.** If the user supplies a recurring job, create a concrete `ROUTINES/<slug>.md` and append a concrete, placeholder-free task prompt to `ROUTINES/task-prompts.md`. Then create the actual Scheduled Task, loop, or workflow in the active Harness UI or CLI. Do not pretend that a routine file schedules itself.
8. **Integrate Board only when requested.** Run `board-init` explicitly. Keep the vendor Board Skill under the project skill root and keep project-specific routing and policy in `INTEGRATIONS/VERCEL_BOARD.md`; do not put `BOARD_TOKEN`, cookies, OIDC tokens, or signed URLs in the project.
9. **Validate.** Run `validate` after customization. If an existing user-owned `AGENTS.md` conflicts with the generated portable protocol, do not overwrite it; show the missing rules and ask for a manual merge.
10. **Report.** Return created, skipped, conflicts, warnings, and errors, followed by the platform-specific installation step for the active Harness.

## Generated baseline

The script creates these paths when absent:

```text
FILESYSTEM.md
AGENTS.md
SOUL.md
IDENTITY.md
USER.md
TOOLS.md
SECURITY.md
agent.yaml
AUTOMATIONS.md
.agents/bootstrap-state.yaml
.agents/skills/README.md
PROJECTS/
MEMORY/daily/
MEMORY/observations/
MEMORY/learned/
ROUTINES/
LOGS/
ARTIFACTS/
```

The old root `SKILLS/` and `.agent/` paths are not created by this version. If they already exist, preserve them and report them as legacy paths; do not silently delete or move user data.

## Harness installation notes

Use the same skill folder for all four tools, but install it where the active tool discovers it:

- **Zcode:** import the folder into user Skills or copy it to `~/.zcode/skills/zcode-agent-bootstrap/`; for a project-local install use `<project>/.zcode/skills/zcode-agent-bootstrap/`. If the current Zcode build is configured to discover `.agents/skills`, the canonical package can be used there as well.
- **Cursor:** place it under `.agents/skills/zcode-agent-bootstrap/` or `.cursor/skills/zcode-agent-bootstrap/`. Invoke it with `/zcode-agent-bootstrap` or let the agent match its description.
- **Codex:** place it under `.agents/skills/zcode-agent-bootstrap/` for a repository-local skill, or `~/.agents/skills/zcode-agent-bootstrap/` for a user skill. Keep project instructions in the root `AGENTS.md`.
- **Antigravity:** place it under `.agents/skills/zcode-agent-bootstrap/` for a workspace skill, or the Antigravity global skill directory. Invoke it with `/zcode-agent-bootstrap` or let the agent select it.

Do not add Cursor rules, Codex-specific config, Antigravity trigger rules, or Zcode commands to the core package. If one is needed, create it as a separate adapter and document its scope.

## Startup and memory rules

Keep the root AGENTS.md short enough to be useful as an always-loaded entry point. It should direct the Agent to read FILESYSTEM.md when the filesystem contract matters, load identity files only when needed, read today's and yesterday's MEMORY/daily entries for recent context, use .agents/skills/README.md as an index, and open only the specific skill required. Load PROJECTS/, ROUTINES/, MEMORY/observations/, MEMORY/learned/, and ARTIFACTS/ only when the task needs them.

Do not assume that the presence of a file means every Harness will inject it automatically. Root AGENTS.md is the shared contract; deeper files are explicit, on-demand context.

## Proactive routine rules

Use one dedicated, non-archived session per recurring routine when the Harness supports sessions. The task prompt should tell the Agent to read AGENTS.md, FILESYSTEM.md, and the named ROUTINES/<slug>.md, then write evidence to the declared project-relative paths and return a concise summary with artifact paths.

Do not use a routine file to emulate an event bus, daemon, or external webhook listener. Do not let multiple routines concurrently rewrite the same memory file. Prefer append-only daily logs and separate output files, followed by a controlled memory-consolidation step.

## If the script cannot run

Follow the same contract manually: create the baseline layout, preserve existing files, use TODO for unknown editable fields, and finish with a read-only validation pass. Never replace a failed script run with an unreviewed overwrite of the project.

## Bundled resources

- scripts/bootstrap.py: deterministic scaffold, repair, status, validation, and opt-in Board initialization implementation.
- references/zcode-mapping.md: four-Harness path mapping and adapter boundaries.
- references/vercel-board.md: Board integration boundary, credential rules, and routine model.
