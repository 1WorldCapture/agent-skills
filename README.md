# Agent Skills

Project-local Agent Skills installable from GitHub with the open `npx skills` CLI.

This repository never distributes HeroUI Pro source code, credentials, or licensed artifacts. Users must provide their own HeroUI access credentials when a skill requires them.

## Skills catalog

| Skill | Purpose |
| --- | --- |
| `setup-heroui-pro` | Scaffold or upgrade HeroUI Pro Web, Native, and monorepo projects, then configure project-local MCP and Skills for Codex, Cursor, Claude Code, and Grok. |

## Install

List available skills:

```bash
npx skills add 1WorldCapture/agent-skills --list
```

Install `setup-heroui-pro` into the current project:

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill setup-heroui-pro \
  --agent codex \
  --agent cursor \
  --agent claude-code \
  --yes
```

Do not add `--global`: the HeroUI setup workflow is designed for project-local installation.

The current `skills` CLI has explicit targets for Codex, Cursor, and Claude Code but not Grok. Grok officially reads Claude Code project Skills, so the `claude-code` installation supplies Grok compatibility through `.claude/skills/`.

To opt out of anonymous `skills` CLI telemetry:

```bash
DISABLE_TELEMETRY=1 npx skills add 1WorldCapture/agent-skills \
  --skill setup-heroui-pro \
  --agent codex \
  --agent cursor \
  --agent claude-code \
  --yes
```

## Use

After installation, invoke the Skill from a supported Agent:

```text
$setup-heroui-pro
```

The Skill runs two phases:

1. Scaffold or upgrade a Web, Native, Web monorepo, or Web+Native monorepo and install HeroUI Pro through `hpsetup`.
2. Configure project-local `hpmcp`, HeroUI Agent Skills, credentials, and MCP files for the selected Agents.

The setup Skill itself remains managed by `npx skills`. Downloaded HeroUI vendor Skills and a reviewable mirror of the setup Skill live under the target project's `.agent/` directory.

## Credentials

Never pass credentials in a URL, commit, MCP file, or chat message. The generated project reads:

```dotenv
HEROUI_KEY=
HEROUI_PERSONAL_TOKEN=
```

from the process environment or the gitignored `.agent/.env.local` file. Local credential files are written with mode `0600` on POSIX systems.

## Update

Update a project installation after the source has been published to GitHub:

```bash
npx skills update setup-heroui-pro --project --yes
```

Invoke `$setup-heroui-pro` once after updating so the Skill refreshes its `.agent/skills/setup-heroui-pro` mirror without overwriting the npx-managed discovery copy.

The CLI may list but not update installations whose recorded source is a local filesystem path. Use local sources for development tests and GitHub sources for update verification.

## Remove

```bash
npx skills remove setup-heroui-pro \
  --agent codex \
  --agent cursor \
  --agent claude-code \
  --yes
```

Removal does not automatically delete project files previously generated under `.agent/`, `.codex/`, `.cursor/`, `.grok/`, or `.mcp.json`. Review those files before removing them.

## Private repository

Use an SSH URL when the repository is private:

```bash
npx skills add git@github.com:1WorldCapture/agent-skills.git --list
```

## Develop

Requirements: Node.js 18 or newer.

```bash
npm run validate
npm test
npx skills add "$PWD" --list
```

Each directory under `skills/` must be self-contained. Runtime scripts and references needed by a Skill must live inside that Skill's directory; repository-level scripts are validation tooling only.

## Release

Use repository-level semantic versions. The initial release is intended to be `v0.1.0`. Validate local discovery and installation before creating a GitHub release.
