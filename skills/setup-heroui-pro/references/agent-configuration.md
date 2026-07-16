# Project-local Agent configuration

## Canonical layout

The setup stores HeroUI vendor Skills and a reviewable mirror of the setup Skill under `.agent/`:

```text
.agent/
├── .env.example
├── .env.local              # optional, mode 0600, gitignored
├── .gitignore
├── config.json
├── bin/
│   ├── hpmcp.mjs
│   └── hpsetup.mjs
└── skills/
    ├── setup-heroui-pro/
    ├── heroui-react-pro/           # React or both
    ├── heroui-native-pro/          # Native or both
    └── heroui-pro-design-taste/
```

Generated discovery/configuration paths:

| Agent | Skills | MCP |
| --- | --- | --- |
| Codex | `.agents/skills/` | `.codex/config.toml` |
| Cursor | `.agents/skills/` | `.cursor/mcp.json` |
| Claude Code | `.claude/skills/` | `.mcp.json` |
| Grok | Claude-compatible `.claude/skills/` | `.grok/config.toml` |

Grok officially reads Claude Code project skills. Reusing `.claude/skills/` avoids loading the same skill twice from `.claude` and `.grok` when both Agents are enabled.

`npx skills` manages the discoverable `setup-heroui-pro` copies and `skills-lock.json`. The setup mirrors its current files into `.agent/skills/setup-heroui-pro` for local audit/offline use but never synchronizes that mirror back over the npx-managed installation. HeroUI vendor Skills are canonical under `.agent/skills/` and are copied to Agent discovery directories by `sync-skills.mjs`.

## Credentials

Use two distinct variables:

```dotenv
HEROUI_KEY=
HEROUI_PERSONAL_TOKEN=
```

- `HEROUI_KEY` authenticates `hpsetup` downloads.
- `HEROUI_PERSONAL_TOKEN` authenticates `hpmcp` and HeroUI skill downloads.

Prefer exporting them in the shell or injecting them from CI secrets. If local persistence is required, use `.agent/.env.local`, mode `0600`. The file is ignored by `.agent/.gitignore`.

The MCP runner must pass the Personal Token as an `hpmcp` process argument because that is the documented `hpmcp` interface. The token is not stored in MCP JSON/TOML or shell history, but it may be briefly visible to local process-inspection tools while the MCP process starts.

## Local MCP dependency

Install `hpmcp` into the project root:

```bash
# pnpm project
pnpm add -D hpmcp@latest

# pnpm workspace root
pnpm add -Dw hpmcp@latest

# npm
npm install -D hpmcp@latest

# Bun
bun add -d hpmcp@latest

# Yarn Classic
yarn add -D hpmcp@latest
```

The generated `.agent/bin/hpmcp.mjs` refuses to fall back to global packages or `npx`. If `node_modules/.bin/hpmcp` is absent, it exits with an installation command.

React projects configure an MCP named `heroui-pro`. Native projects configure `heroui-native-pro`. Mixed monorepos configure both.

## HeroUI Agent Skills

The installer uses the documented custom destination variable:

```text
HEROUI_PRO_SKILLS_DIR=<project>/.agent/skills
```

Product mapping:

| Product | Installed skills |
| --- | --- |
| React | `heroui-react-pro`, `heroui-pro-design-taste` |
| Native | `heroui-native-pro`, `heroui-pro-design-taste` |
| Both | all three |

After installation, synchronization copies every canonical skill containing `SKILL.md` into the discovery directories required by the selected Agents.

## Generated MCP behavior

All four clients run:

```text
node .agent/bin/hpmcp.mjs <react|native>
```

with `CACHE_TTL=1800` by default. The runner resolves the repository root from its own location, loads `.agent/.env.local` if present, and executes the project-local `hpmcp` binary.

The setup merges its servers into existing JSON configs and uses managed marker blocks in Grok/Codex TOML files. Re-running setup updates only the managed HeroUI block.

## Updates

1. Run `node .agent/bin/hpsetup.mjs --dry-run` on a branch.
2. Run `node .agent/bin/hpsetup.mjs --auto` and test the application.
3. Update `hpmcp` through the current package manager.
4. Update this setup Skill with `npx skills update setup-heroui-pro --project -y`, then invoke it to refresh the `.agent` mirror.
5. Re-run `install-agent-skills.mjs` to refresh canonical HeroUI vendor Skills.
6. Re-run the currently installed Skill's `sync-skills.mjs` and `verify-project.mjs`.
7. Review and commit code/config changes, never `.agent/.env.local`.

## Source notes

- Codex project skills: `.agents/skills`; project MCP: `.codex/config.toml` in trusted repositories.
- Claude Code project skills: `.claude/skills`; project MCP: `.mcp.json` with workspace approval.
- Cursor project MCP: `.cursor/mcp.json`; Cursor supports the shared `.agents/skills` standard.
- Grok project MCP: `.grok/config.toml`; Grok reads Claude Code skills and MCPs for compatibility.
