# Four-Harness mapping

Use this reference when installing the same Agent workspace in Zcode, Cursor, Codex, and Google Antigravity.

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
| Zcode | `.zcode/skills/<name>/` | `~/.zcode/skills/<name>/` | `$name` or `/name`; automatic matching may also apply. |
| Cursor | `.agents/skills/<name>/` or `.cursor/skills/<name>/` | `~/.agents/skills/<name>/` or `~/.cursor/skills/<name>/` | `/name` or automatic matching. |
| Codex | `.agents/skills/<name>/` | `~/.agents/skills/<name>/` | Explicit skill invocation or automatic matching, depending on the client. |
| Antigravity | `.agents/skills/<name>/` | Antigravity global skill directory | `/name` or automatic matching. |

The canonical project package for Cursor, Codex, and Antigravity is `.agents/skills/<name>/`. Zcode's explicit native path is `.zcode/skills/<name>/`, so install or import the same package there when Zcode does not discover `.agents/skills` in the current build. Do not claim that one physical directory is automatically discovered by all four tools.

## Non-portable surfaces

Do not put required behavior in these paths:

- `.agents/commands/`
- `.agents/rules/`
- `.agents/workflows/`
- `.cursor/rules/`
- `.codex/` configuration

These can be useful adapters, but their file formats, trigger rules, and discovery behavior differ. Keep the core behavior in `AGENTS.md` and a normal `SKILL.md` package.

## Scheduled work

`ROUTINES/` stores versioned intent, inputs, outputs, write scope, idempotency, and failure behavior. The active Harness's scheduler, loop command, or automation UI stores the actual timing and execution metadata. A routine file never creates the external schedule by itself.

## Official references

- Zcode: https://zcode.z.ai/en/docs/agents and https://zcode.z.ai/en/docs/skill
- Cursor: https://cursor.com/docs/skills and https://cursor.com/docs/rules
- Codex: https://developers.openai.com/api/docs/guides/tools-skills
- Antigravity: https://antigravity.google/docs/skills and https://antigravity.google/docs/rules/
