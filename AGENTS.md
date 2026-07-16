# Repository instructions

## Scope

This repository contains self-contained Agent Skills distributed through `npx skills`.

## Adding or changing a Skill

- Store every Skill at `skills/<skill-name>/`.
- Match the lowercase hyphenated directory name to the `name` in `SKILL.md` frontmatter.
- Keep runtime scripts, references, and assets inside the Skill directory. Do not make installed Skills depend on repository-root runtime files.
- Keep user-facing repository documentation in the root `README.md`; do not add README or changelog files inside individual Skills.
- Never add credentials, downloaded licensed artifacts, `.env.local`, MCP tokens, or generated Agent installation directories.
- Preserve unrelated Skills when changing one Skill.

## Validation

Run before committing:

```bash
npm run validate
npm test
npx skills add "$PWD" --list
```

For installation changes, also test project-local installation into `codex`, `cursor`, and `claude-code`. Grok compatibility is supplied through the Claude Code project Skill path.

## Versioning

Use repository-level semantic-version Git tags. Document release behavior in GitHub release notes; avoid custom version fields in Skill frontmatter.
