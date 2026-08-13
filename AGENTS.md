# Repository instructions

## Project overview

This repository publishes self-contained Agent Skills for installation via the open `npx skills` CLI. The CLI installs one copy into the cross-agent `.agents/skills/` directory (`~/.agents/skills/` when global), which every agent following that convention reads; `--agent <name>` adds agent-specific copies such as `.claude/skills/`.

Agents working here should:

- Treat each directory under `skills/` as an independent Skill package
- Keep user-facing docs in the root `README.md`, not inside Skill directories
- Preserve unrelated Skills when changing one Skill
- Never add credentials, downloaded licensed artifacts, `.env.local`, MCP tokens, or generated Agent installation directories

## Directory structure

```text
.
├── AGENTS.md
├── README.md
├── package.json
├── docs/                 # optional living notes (e.g. freetalk)
├── scripts/              # repo-level validation tooling only
├── skills/               # one directory per Skill
│   └── <skill-name>/
│       ├── SKILL.md      # required; frontmatter name must match directory
│       ├── agents/       # optional Codex UI metadata
│       ├── scripts/      # Skill-owned runtime
│       ├── references/
│       └── assets/
└── tests/                # Skill-focused automated checks
```

Skill runtime scripts, references, and assets must live inside that Skill directory. Installed Skills must not depend on repository-root runtime files.

## Start and stop

- Requires Node.js 18+.
- No long-running app or daemon for this repository itself; work is edit → validate → test → discover.
- There is nothing to tear down beyond ordinary local processes started during validation or Skill-specific workflows.

## Verification

Before committing Skill changes:

```bash
npm run validate
npm test
npx skills add "$PWD" --list
```

`npm run check` runs validate then test.

For installation-path changes, also exercise a project-local install in a scratch directory and confirm the Skill lands at `.agents/skills/<name>` with its references and scripts intact. Exercise `--agent claude-code` as well when a change must stay visible to Grok, which has no dedicated CLI target and reads Claude Code project Skills.

## Versioning

Use repository-level semantic-version Git tags. Document releases in GitHub release notes. Do not put custom version fields in Skill frontmatter.

## Handcraft

<!-- Human-maintained. Do not edit in agents-md skill updates. -->
