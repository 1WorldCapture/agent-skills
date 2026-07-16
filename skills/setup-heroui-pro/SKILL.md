---
name: setup-heroui-pro
description: Scaffold or upgrade HeroUI Pro projects with resumable project-local setup, credential preflight, stable/beta channel enforcement, safe MCP verification, and atomic HeroUI Skill downloads. Use for new or existing Web, HeroUI Native, Web-only monorepo, or Web+Native monorepo projects; for hpsetup installation; or when wiring HeroUI Pro into Grok, Codex, Claude Code, and Cursor without global MCP or vendor Skill installation.
---

# Set Up HeroUI Pro

Use the deterministic scripts for fragile operations. Keep credentials, MCP, downloaded HeroUI vendor Skills, and setup state project-local.

## Non-negotiable rules

- Never install HeroUI MCP or HeroUI vendor Skills globally.
- Never print, paste, persist in Git, or place credentials in URLs, command arguments, MCP config, or `package.json`.
- Require non-empty `HEROUI_KEY` and `HEROUI_PERSONAL_TOKEN` before any authenticated phase.
- Default to `--channel stable`; use beta only when the user explicitly requests it. Stop if the selected npm tag contradicts the channel.
- Run the `hpsetup` dry-run phase before installation.
- Merge existing config and environment files; never replace unrelated settings.
- Never run `claude mcp list`, `codex mcp list`, or another Agent diagnostic directly. Use `verify-agent-runtime.mjs` so output is captured and redacted.
- Never overwrite the `npx skills`-managed `setup-heroui-pro` discovery copy. Synchronize only project-local HeroUI vendor Skills.
- Use Web Pro subpath imports such as `@heroui-pro/react/area-chart`; never import Web Pro components from the package root.
- Keep the selected package-manager lockfile tracked. Validation commands must not modify the Git work tree.

## Determine the target

Inspect the repository first. Determine its topology, package manager, workspace layout, framework, existing failures, and HeroUI packages. Ask only when the answer remains material:

1. Topology: `web`, `native`, `monorepo-web`, or `monorepo-web-native`.
2. New project path or confirmation that the current project is the target.
3. `fast`, `custom`, or existing-project flow.

Default to pnpm, stable, and `grok,codex,claude,cursor`. Use Node.js 20 or newer; use Node.js 22 for Native EAS builds.

## Install the project discovery copy first

Run this from the target project before `configure-project.mjs` or the orchestrator:

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill setup-heroui-pro \
  --agent codex \
  --agent cursor \
  --agent claude-code \
  --yes
```

This creates `skills-lock.json`; Grok reads the Claude-compatible project Skill. Do not use `--global` for a project setup.

## Preferred resumable workflow

Resolve `SKILL_DIR` to the directory containing this `SKILL.md` and `PROJECT_ROOT` to the target repository. Do not assume shell variables already exist.

```bash
node "$SKILL_DIR/scripts/setup.mjs" \
  --root "$PROJECT_ROOT" \
  --topology web \
  --scaffold fast \
  --agents grok,codex,claude,cursor \
  --channel stable
```

The stateful phases are:

```text
preflight → scaffold → baseline → discovery → configure → credentials
→ hpsetup-dry-run → install → skills → verify
```

If credentials are empty, the command stops safely. Set both outside chat, then rerun the identical command; completed phases are not repeated. Add `--persist-env` only when both values are already non-empty and the user wants them stored in `.agent/.env.local`.

For a final read-only app and runtime check, add a representative Pro component using Web subpath imports or the Native package import, then rerun:

```bash
node "$SKILL_DIR/scripts/setup.mjs" \
  --root "$PROJECT_ROOT" \
  --topology web \
  --scaffold fast \
  --agents grok,codex,claude,cursor \
  --channel stable \
  --verify \
  --expect "HeroUI Pro"
```

Read [references/scaffold-flows.md](references/scaffold-flows.md) for topology-specific styles and scaffold choices. Automatic fast scaffolding applies to a new Web project; use the documented custom flow for Native and monorepos.

## Manual checkpoints

Use these when resuming or diagnosing one phase:

```bash
node "$SKILL_DIR/scripts/check-credentials.mjs" --root "$PROJECT_ROOT"
node "$SKILL_DIR/scripts/configure-project.mjs" --root "$PROJECT_ROOT" --product react --channel stable
node .agent/bin/hpsetup.mjs --channel stable --dry-run
node .agent/bin/hpsetup.mjs --channel stable --auto
node "$SKILL_DIR/scripts/install-agent-skills.mjs" --root "$PROJECT_ROOT"
node "$SKILL_DIR/scripts/verify-project.mjs" --root "$PROJECT_ROOT"
node "$SKILL_DIR/scripts/verify-app.mjs" --root "$PROJECT_ROOT" --expect "HeroUI Pro"
node "$SKILL_DIR/scripts/verify-agent-runtime.mjs" --root "$PROJECT_ROOT"
```

`install-agent-skills.mjs` downloads authenticated tarballs with an HTTP header, rejects unsafe archive entries, stages them under `.agent/.tmp`, and atomically replaces only `.agent/skills/<skill>`. It never executes a remote shell installer or writes user-level directories.

`verify-agent-runtime.mjs` redacts tokens, UUIDs, authorization headers, and URLs. It reports same-name user/project MCP conflicts by scope only and never deletes user configuration.

## Git and validation

- Initialize new repositories with `git init -b main` when the scaffold did not do so.
- Keep `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, or `bun.lock` tracked.
- Create a baseline checkpoint only when Git identity and work-tree conditions permit it. Report a skipped checkpoint without swallowing the error or treating it as a successful commit.
- Require `lint`, `typecheck`, `test`, `build`, and `start` or `preview` scripts. Keep `lint` read-only and put fixes in `lint:fix`; require TypeScript `--noEmit` and non-watch tests.
- Use `verify-app.mjs` for lint, typecheck, tests, build, HTTP 200/content checks, and proof that validation did not change the work tree.

## Update

Update the project discovery copy, then invoke this Skill so `configure-project.mjs` refreshes the reviewable `.agent` mirror:

```bash
npx skills update setup-heroui-pro --project --yes
```

Do not update the `.agent` mirror directly.

## Implementation conventions

- Use Tailwind CSS v4 and CSS order: Tailwind, `@heroui/styles`, then `@heroui-pro/react/css`.
- Use HeroUI v3 compound APIs, `onPress`, semantic variants/tokens, and accessible labels or tooltips.
- Prefer HeroUI components over custom standard controls.
- Isolate conflicting shadcn global tokens instead of patching individual HeroUI components.
- Treat Pro updates as controlled dependency changes and test them on a branch.

## References

- Read [references/scaffold-flows.md](references/scaffold-flows.md) for the selected topology.
- Read [references/agent-configuration.md](references/agent-configuration.md) for project paths, discovery ownership, credentials, and updates.
- Read [references/troubleshooting.md](references/troubleshooting.md) only for a matching failure.
