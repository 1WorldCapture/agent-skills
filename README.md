# Agent Skills

Project-local Agent Skills installable from GitHub with the open `npx skills` CLI.

This repository never distributes HeroUI Pro source code, credentials, or licensed artifacts. Users must provide their own HeroUI access credentials when a skill requires them.

## Skills catalog

| Skill | Purpose |
| --- | --- |
| `freetalk` | 通过简短自然的自由对话梳理模糊想法，并把关键观点持续沉淀到 `docs/freetalk.md`。 |
| `light-ocr-text-extraction` | 使用 light-ocr 离线提取图片文字、置信度与坐标，并自动解码 TIFF 等格式。 |
| `setup-heroui-pro` | Scaffold or upgrade HeroUI Pro Web, Native, and monorepo projects through a resumable workflow with credential preflight, stable/beta enforcement, atomic project-local Skill downloads, and redacted MCP verification. |

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

安装图片 OCR 技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill light-ocr-text-extraction \
  --agent codex \
  --agent cursor \
  --agent claude-code \
  --yes
```

该技能也可以全局安装：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill light-ocr-text-extraction \
  --global \
  --yes
```

全局安装自由讨论与思路沉淀技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill freetalk \
  --global \
  --yes
```

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

想从一个模糊念头开始自由讨论，并把逐渐清晰的关键内容沉淀到项目文档时调用：

```text
$freetalk
```

技能默认维护当前工作区的 `docs/freetalk.md`，将它整理为当前最佳理解，而不是逐字聊天记录。每轮对话只推进一个重点，并保持简短自然。

提取 PNG、JPEG、单页 TIFF、静态 WebP、静态 GIF 或 AVIF 图片中的文字时调用：

```text
$light-ocr-text-extraction
```

技能在本机使用 PP-OCRv6 Small，生成未经人工修改的纯文本、带坐标与置信度的 JSON，以及中文质量报告。PDF 需要先逐页渲染为图片。

After installation, invoke the Skill from a supported Agent:

```text
$setup-heroui-pro
```

The Skill runs two phases:

1. Scaffold or upgrade a Web, Native, Web monorepo, or Web+Native monorepo and install HeroUI Pro through `hpsetup`.
2. Configure project-local `hpmcp`, HeroUI Agent Skills, credentials, and MCP files for the selected Agents.

For a new setup, prefer the resumable orchestrator exposed by the installed Skill:

```bash
node .agents/skills/setup-heroui-pro/scripts/setup.mjs \
  --root . \
  --topology web \
  --scaffold fast \
  --agents grok,codex,claude,cursor \
  --channel stable
```

It stops safely when either credential is empty and resumes from `.agent/setup-state.json` after credentials are set outside chat. Use `check-credentials.mjs` to see only `available`/`empty` status, never values.

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

Use repository-level semantic versions. Validate local discovery, installation, credential gating, and safe runtime verification before creating a GitHub release.
