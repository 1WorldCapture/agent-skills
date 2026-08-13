# Agent Skills

Project-local Agent Skills installable from GitHub with the open `npx skills` CLI.

This repository never distributes HeroUI Pro source code, credentials, or licensed artifacts. Users must provide their own HeroUI access credentials when a skill requires them.

## Skills catalog

| Skill | Purpose |
| --- | --- |
| `agents-md` | 按原则与松散骨架创建或维护项目根目录的英文 `AGENTS.md`（含一周新鲜度与 handcraft 只读保留）。 |
| `freetalk` | 通过简短自然的自由对话梳理模糊想法，并把关键观点持续沉淀到 `docs/freetalk.md`。 |
| `light-ocr-text-extraction` | 使用 light-ocr 离线提取图片文字、置信度与坐标，并自动解码 TIFF 等格式。 |
| `mission-crew` | Captain → PM 任务编排：对齐目标、写临时 OpenSpec BRIEF、在 worktree 中只拉起 PM，并由 PM 产出 proposal。 |
| `pi-sdk` | 在 Pi Coding Agent SDK（`@earendil-works/pi-coding-agent`）上构建自定义 Agent 的参考：从跑通第一个会话，到定制行为、工具与运行时扩展。 |
| `setup-heroui-pro` | Scaffold or upgrade HeroUI Pro Web, Native, and monorepo projects through a resumable workflow with credential preflight, stable/beta enforcement, atomic project-local Skill downloads, and redacted MCP verification. |

## Install

List available skills:

```bash
npx skills add 1WorldCapture/agent-skills --list
```

The `skills` CLI installs one copy into the cross-agent directory: `.agents/skills/<name>` for a project, `~/.agents/skills/<name>` with `--global`. Every agent that follows the `.agents` convention reads that same copy, so the commands below pass no `--agent` flags. Use `--agent <name>` only to also place agent-specific copies or symlinks under directories such as `.claude/skills/`.

Install `setup-heroui-pro` into the current project:

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill setup-heroui-pro \
  --yes
```

Do not add `--global`: the HeroUI setup workflow is designed for project-local installation.

安装图片 OCR 技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill light-ocr-text-extraction \
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

安装 / 全局安装 `AGENTS.md` 维护技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill agents-md \
  --yes
```

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill agents-md \
  --global \
  --yes
```

安装 Mission Crew（Captain → PM）技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill mission-crew \
  --yes
```

也可全局安装：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill mission-crew \
  --global \
  --yes
```

安装 Pi Coding Agent SDK 学习与集成技能：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill pi-sdk \
  --yes
```

也可全局安装：

```bash
npx skills add 1WorldCapture/agent-skills \
  --skill pi-sdk \
  --global \
  --yes
```

Pi 从 `~/.agents/skills/` 和项目下受信任的 `.agents/skills/` 发现技能，所以不需要再往 `~/.pi/agent/skills/` 或 `.pi/skills/` 额外拷贝一份，也不需要 `pi --skill <path>`。

Grok has no dedicated CLI target. It reads Claude Code project Skills, so install with `--agent claude-code` when a Skill must be visible to Grok specifically.

To opt out of anonymous `skills` CLI telemetry:

```bash
DISABLE_TELEMETRY=1 npx skills add 1WorldCapture/agent-skills \
  --skill setup-heroui-pro \
  --yes
```

## Use

想用 Captain → PM 方式立项（写 BRIEF、worktree 中只起 PM、产出 OpenSpec proposal）时调用：

```text
$mission-crew
```

默认以 Captain 身份与用户对齐 high-level 目标，写入 `openspec/changes/<slug>/BRIEF.md`，再运行技能内 `scripts/kickoff-pm.sh` 将 BRIEF **移动**到新 worktree 并任命 PM。v1 停在 proposal，不自动拉起 Design/Coding/Verification。

想从一个模糊念头开始自由讨论，并把逐渐清晰的关键内容沉淀到项目文档时调用：

```text
$freetalk
```

技能默认维护当前工作区的 `docs/freetalk.md`，将它整理为当前最佳理解，而不是逐字聊天记录。每轮对话只推进一个重点，并保持简短自然。

想创建或维护项目根目录的 `AGENTS.md` 时调用：

```text
$agents-md
```

技能说明为中文，写出的 `AGENTS.md` 为英文。无文件则创建；有文件则按 git（或 mtime）判断是否超过一周再更新。一周内默认跳过，除非用户明示要求更新。更新时完整保留 `## Handcraft` 人类手写章节。

想基于 Pi 做一个自己的 Agent、把 Pi Agent 嵌入应用，或扩展与调试已有的 Pi Agent 时调用：

```text
$pi-sdk
```

`SKILL.md` 自带跑通第一个 Agent 所需的全部内容：心智模型、启动路径、核心概念表与常见故障；提示词与 Skills、工具、扩展钩子、内核改动这四类深入内容按任务从 `references/` 按需读取。本地只保留一个最小可运行示例，其余示例改为指向上游仓库 [earendil-works/pi](https://github.com/earendil-works/pi) `main` 分支的链接，避免技能内的拷贝随上游更新而过时。

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
npx skills remove setup-heroui-pro --yes
```

Add `--agent '*'` to also clear agent-specific copies created by an earlier `--agent` install.

Removal does not automatically delete project files previously generated under `.agent/`, `.agents/`, `.codex/`, `.cursor/`, `.grok/`, or `.mcp.json`. Review those files before removing them.

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
