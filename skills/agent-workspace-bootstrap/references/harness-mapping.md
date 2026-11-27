# Multi-Harness mapping

Use this reference when installing or adapting the same Agent workspace across Cursor, Zcode, Codex, Google Antigravity, and future Harnesses.

## Shared core

| Portable concept | Shared path | Rule |
|---|---|---|
| Project instructions | Root `AGENTS.md` | Keep the portable contract here. Do not depend on nested files because Zcode only loads the global file and workspace-root file. |
| Reusable skill | `.agents/skills/<name>/SKILL.md` | Use only `name` and `description` frontmatter in the cross-Harness core. |
| Skill resources | Beside `SKILL.md` | `scripts/`, `references/`, and `assets/` are optional and portable. |
| Durable Agent state | `MEMORY/`, `PROJECTS/`, `ROUTINES/`, `LOGS/`, `ARTIFACTS/` | These are ordinary project files. Load them explicitly through `AGENTS.md` or a skill. |

## Installation paths

| Harness | Project-local skill path | User/global path | Invocation |
|---|---|---|---|
| Cursor | `.cursor/skills/<name>/` or `.agents/skills/<name>/` | `~/.cursor/skills/<name>/` or `~/.agents/skills/<name>/` | `/name` or automatic matching. |
| Zcode | `.zcode/skills/<name>/` | `~/.zcode/skills/<name>/` | `$name` or `/name`; automatic matching may also apply. |
| Codex | `.agents/skills/<name>/` | `~/.agents/skills/<name>/` | Explicit skill invocation or automatic matching, depending on the client. |
| Antigravity | `.agents/skills/<name>/` | `~/.gemini/config/skills/<name>/` | `/name` or automatic matching. |

### Keeping Cursor and Zcode isolated from `~/.agents/skills/`

`npx skills` (`skills` CLI) classifies **Cursor** as a universal agent (`skillsDir: ".agents/skills"`, `globalReadsCanonical: true`). Because of that, `npx skills add ... --global --agent cursor` — even with `--copy` — writes the package into `~/.agents/skills/` rather than `~/.cursor/skills/`.

- To install **only** into `~/.cursor/skills/<name>/` (or `<project>/.cursor/skills/<name>/`) without creating a copy in `~/.agents/skills/`, copy or extract the skill folder directly into `~/.cursor/skills/<name>/` (or `.cursor/skills/<name>/`).
- To install **only** into `~/.zcode/skills/<name>/` (or `<project>/.zcode/skills/<name>/`) without creating a symlink source in `~/.agents/skills/`, pass `--agent zcode --copy --yes` to `npx skills add`.

Do not claim that one physical directory is automatically discovered by all tools in every environment.

## Cursor adapter details (`--harness cursor`)

When `--harness cursor` is selected, `bootstrap.py` adds a minimal Cursor adapter without duplicating core instructions:

- `.cursor/rules/agent-workspace.mdc`: uses `alwaysApply: true` YAML frontmatter as a thin pointer directing Cursor to read the root `AGENTS.md` and `FILESYSTEM.md` as the single source of truth.
- `.cursor/skills/README.md`: establishes `.cursor/skills/` for Cursor-specific or isolated compatibility copies while keeping canonical portable skills in `.agents/skills/`.
- **Cursor Automations / Cloud Agents**: Cursor background and scheduled automations should point to `ROUTINES/<slug>.md` and `AUTOMATIONS.md`, keeping all business state in project-relative files.

## Non-portable surfaces

Do not put required behavior in these paths:

- `.agents/commands/`
- `.agents/rules/`
- `.agents/workflows/`
- `.cursor/rules/` (other than a thin pointer adapter to `AGENTS.md`)
- `.codex/` configuration

These can be useful adapters, but their file formats, trigger rules, and discovery behavior differ. Keep the core behavior in `AGENTS.md` and a normal `SKILL.md` package.

## Adding a new Harness adapter

When extending `bootstrap.py` for another Harness in the future:

1. Keep the portable baseline (`AGENTS.md`, `FILESYSTEM.md`, `.agents/skills/`, `MEMORY/`, `ROUTINES/`, `LOGS/`, `ARTIFACTS/`) unchanged as the single source of truth.
2. Add the new Harness name to `SUPPORTED_HARNESSES` and opt-in scaffolding to `render_adapters()` so users opt in via `--harness <name>` without affecting `--harness portable`.
3. Keep generated adapter files thin — point back to `AGENTS.md` and `FILESYSTEM.md` rather than duplicating policy rules.
4. Update `validate()` and `status()` to verify adapter health and report presence cleanly.

## Scheduled work

`ROUTINES/` stores versioned intent, inputs, outputs, write scope, idempotency, and failure behavior. The active Harness's scheduler (Cursor Automations, Zcode Scheduled Tasks, Codex automations, loop commands, or workflow runners) stores the actual timing and execution metadata. A routine file never creates the external schedule by itself.

## Official references

- Cursor: https://cursor.com/docs/skills and https://cursor.com/docs/rules
- Zcode: https://zcode.z.ai/en/docs/agents and https://zcode.z.ai/en/docs/skill
- Codex: https://developers.openai.com/api/docs/guides/tools-skills
- Antigravity: https://antigravity.google/docs/skills and https://antigravity.google/docs/rules/
