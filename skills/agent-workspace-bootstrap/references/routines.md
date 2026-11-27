# Reactive and proactive routines

## Two execution modes

- **Reactive**: a user asks for work and the active Harness invokes the Agent. The Agent reads the root contract and only the Skills and project files needed for that request.
- **Proactive**: a scheduler starts a dedicated run for a versioned `ROUTINES/<slug>.md`. The routine declares inputs, read/write scope, outputs, idempotency, failure behavior, and a copy-ready prompt.

Both modes use the same project root, identity, security rules, memory boundaries, and logging policy.

## Scheduling boundary

Writing a routine file does not create a scheduled task. The active Harness must create or update the actual Cursor Automation, Zcode Scheduled Task, Codex automation, loop, or workflow runner. `AUTOMATIONS.md` is a checklist and prompt bridge, not a scheduler database.

Use one dedicated session or automation run per recurring routine when the Harness supports it. Do not let multiple routines concurrently rewrite the same memory file. Prefer append-only daily logs followed by a controlled consolidation step.

## Routine evidence

Every proactive run should read `AGENTS.md`, `FILESYSTEM.md`, and the named routine first; follow its declared scope; save evidence to the declared project-relative paths; append an execution record to `LOGS/`; and return a concise summary with artifact paths and warnings.

## Board routines

The optional `ROUTINES/vercel-board-triage.md` routine reads the Board integration file and uses the Board's native grants. It may read, reply, claim, lease, label, sync, or complete work only when the active credential permits that native operation. A denied operation is reported with the missing grant; no local Observe/Progress/Worker policy is applied.
