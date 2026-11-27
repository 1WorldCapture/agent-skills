# Filesystem contract reference

The bootstrap script creates a portable project-local Agent Home. These are ordinary files and directories; Harnesses must load them through the root `AGENTS.md` protocol rather than assuming every file is automatically injected.

## Generated paths

```text
AGENTS.md                 durable instruction entry point
FILESYSTEM.md             auditable layout and startup contract
SOUL.md                   Agent principles and editable style
IDENTITY.md               Agent identity and mission
USER.md                   explicit user context only
TOOLS.md                  capability index without credentials
SECURITY.md               boundary, secret, and mutation rules
agent.yaml                machine-readable project manifest
AUTOMATIONS.md            bridge from routines to Harness schedulers
.agents/bootstrap-state.yaml
.agents/skills/README.md  portable Skill index
PROJECTS/                 business material and source data
MEMORY/                   daily, observational, and curated memory
ROUTINES/                 proactive job contracts and prompts
LOGS/                     append-only execution evidence
ARTIFACTS/                reports and other deliverables
```

Optional Cursor and Zcode adapters are thin pointers or local Skill indexes. They must not become a second source of truth.

## Startup order

Read `FILESYSTEM.md` when the task needs the layout contract, then `AGENTS.md`. Load identity files and recent daily memory only when needed. Use `.agents/skills/README.md` as an index and open only the specific Skill required for the current task. Load project, routine, observation, learned-memory, and artifact directories on demand.

## Write rules

Keep the project-relative boundary. Append execution evidence to `LOGS/`, put deliverables under `ARTIFACTS/`, and keep durable business knowledge under `MEMORY/learned/`. Never store API keys, cookies, OAuth tokens, passwords, private keys, or signed URLs in this tree.

The script creates missing paths and preserves existing files. A user file at a generated path is a conflict and is never overwritten automatically.
