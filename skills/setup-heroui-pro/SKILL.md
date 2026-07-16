---
name: setup-heroui-pro
description: Scaffold or upgrade HeroUI Pro projects and configure project-local HeroUI MCP and Agent Skills. Use for new or existing Web, HeroUI Native, Web-only monorepo, or Web+Native monorepo projects; for hpsetup installation; or when wiring HeroUI Pro into Grok, Codex, Claude Code, and Cursor without global MCP or skill installation.
---

# Set Up HeroUI Pro

Build the application scaffold first, then configure project-local AI tooling. Keep HeroUI vendor Skills, a mirror of this setup Skill, and credentials under `.agent/`. Let `npx skills` manage the discoverable `setup-heroui-pro` installation so project updates remain reliable.

## Non-negotiable rules

- Never install HeroUI MCP or HeroUI Skills globally.
- Never put an HP Key or Personal Token in a URL, command argument, committed file, `package.json`, MCP config, or generated documentation.
- Read credentials only from the current process environment or the gitignored `.agent/.env.local` file.
- Use `HEROUI_KEY` for `hpsetup` and `HEROUI_PERSONAL_TOKEN` for `hpmcp` and skill downloads. Never interchange them.
- Default to stable `latest`; use beta only when the user explicitly requests it.
- Run `hpsetup --dry-run` before installation or update.
- Preserve existing project files and unrelated MCP servers. Merge configuration rather than replacing it.
- Never overwrite the `npx skills`-managed discovery copy of `setup-heroui-pro`; synchronize only downloaded HeroUI vendor Skills.
- Use Pro subpath imports on Web: `@heroui-pro/react/<component>`. Do not import Pro components from the package root.

## Determine the target

Inspect the repository before asking questions. Determine whether it is new or existing, its package manager, workspace layout, framework, and installed HeroUI packages.

If the answer remains material, ask only for:

1. Topology: `web`, `native`, `monorepo-web`, or `monorepo-web-native`.
2. New project name/path or confirmation that the current project is the target.
3. Scaffold preference when relevant: fast template or custom generator.

Default to pnpm and enable all four Agents: `grok,codex,claude,cursor`.

Map topology to product:

| Topology | Product |
| --- | --- |
| `web` | `react` |
| `native` | `native` |
| `monorepo-web` | `react` |
| `monorepo-web-native` | `both` |

## Phase 1: Scaffold and install HeroUI Pro

Read [references/scaffold-flows.md](references/scaffold-flows.md) for the chosen topology and follow only that section.

1. Verify Node.js 18+ and the selected package manager. Use Node.js 22 for Native EAS builds using pnpm 11.
2. Create the scaffold only when the target is new. Do not replace an existing application.
3. Install dependencies and run the untouched scaffold once. Fix baseline failures before adding Pro.
4. Create a git checkpoint when the repository is clean enough to do so.
5. Create the project-local Agent layout before authenticated steps:

Resolve `SKILL_DIR` to the absolute directory containing this `SKILL.md`, and resolve `PROJECT_ROOT` to the target repository root. Do not assume either shell variable already exists; substitute the resolved absolute paths when running the command.

```bash
node "$SKILL_DIR/scripts/configure-project.mjs" \
  --root "$PROJECT_ROOT" \
  --product react \
  --agents grok,codex,claude,cursor
```

Replace `react` with `native` or `both`. Add `--persist-env` only when both credentials already exist in the process environment and the user wants them stored in `.agent/.env.local`.

6. If `HEROUI_KEY` is unavailable, complete all non-authenticated setup and ask the user to set it outside chat. Do not ask the user to paste it into the conversation.
7. Preview and install through the generated runner so the key is never a command argument:

```bash
node .agent/bin/hpsetup.mjs --dry-run
node .agent/bin/hpsetup.mjs --auto
```

8. Add the required global CSS imports and Native `@source` paths from the topology reference.
9. Add a minimal representative component, using compound component syntax and Web subpath imports.
10. Run the project's lint, typecheck, build, and the smallest relevant preview or test.

## Phase 2: Configure project-local Agents

Read [references/agent-configuration.md](references/agent-configuration.md) before this phase.

1. Install `hpmcp@latest` as a development dependency at the project or workspace root. Do not use a global package:

```bash
pnpm add -D hpmcp@latest
```

Use `-Dw` at a pnpm workspace root. Use the equivalent local development-dependency command for npm, Bun, or Yarn.

2. If `HEROUI_PERSONAL_TOKEN` is unavailable, leave the generated configuration in place and ask the user to set the variable outside chat. Do not fall back to embedding it in MCP JSON/TOML.
3. Install canonical HeroUI skills into `.agent/skills/`:

```bash
node "$SKILL_DIR/scripts/install-agent-skills.mjs" --root "$PROJECT_ROOT"
```

The script reads the product from `.agent/config.json`, downloads only the needed React/Native skill plus `heroui-pro-design-taste`, and synchronizes Agent discovery copies.

4. Re-run synchronization after updating canonical HeroUI vendor Skills. Use the currently invoked Skill directory, not a possibly stale mirror:

```bash
node "$SKILL_DIR/scripts/sync-skills.mjs" --root "$PROJECT_ROOT"
```

5. Verify the complete installation:

```bash
node "$SKILL_DIR/scripts/verify-project.mjs" --root "$PROJECT_ROOT"
```

6. When the corresponding CLI is installed, verify runtime discovery:

- Grok: `grok inspect` and `grok mcp doctor heroui-pro`
- Codex: trust the repository, restart if needed, then run `codex mcp list`
- Claude Code: trust the repository, approve the project MCP, then run `claude mcp list`
- Cursor: reopen the workspace if needed, then run `cursor-agent mcp list`

Do not fail the setup solely because one of these four client CLIs is absent.

## Update this setup Skill

Update the project installation through `npx skills`, then invoke this Skill once so `configure-project.mjs` refreshes its `.agent/skills/setup-heroui-pro` mirror:

```bash
npx skills update setup-heroui-pro --project --yes
```

Do not update the `.agent` mirror directly and do not use its scripts as the source for an update.

## Implementation conventions

- For Web, use Tailwind CSS v4 and CSS order: Tailwind, `@heroui/styles`, then `@heroui-pro/react/css`.
- Use HeroUI v3 compound APIs such as `Card.Header` and `Switch.Control`.
- Use `onPress`, semantic variants, semantic design tokens, and accessible labels/tooltips.
- Prefer HeroUI components over custom versions of standard controls.
- Avoid mixing shadcn theme CSS with HeroUI theme CSS. If an existing app mixes them, isolate or remove conflicting shadcn global tokens before debugging individual components.
- Treat updates as controlled dependency changes because the Pro payload is delivered dynamically. Test upgrades in a branch and promote verified build artifacts.

## References

- Read [references/scaffold-flows.md](references/scaffold-flows.md) for scaffold commands, style paths, and topology-specific validation.
- Read [references/agent-configuration.md](references/agent-configuration.md) for the `.agent` layout, four-Agent discovery mapping, MCP generation, credentials, and update flow.
- Read [references/troubleshooting.md](references/troubleshooting.md) only when installation, bundling, styling, or Native dependency checks fail.
