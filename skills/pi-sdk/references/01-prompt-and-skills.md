# Prompt, skills, and context

Shape behavior without writing tools or forking core. Upstream examples are linked at the bottom of this file. Docs: https://pi.dev/docs/latest/sdk · [`docs/skills.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

## System prompt overrides

Use `DefaultResourceLoader` options (call `await loader.reload()` before `createAgentSession`):

### Replace entirely — `systemPromptOverride`

```ts
const loader = new DefaultResourceLoader({
  cwd,
  agentDir,
  systemPromptOverride: () => "You are a concise assistant.",
  // Avoid DefaultResourceLoader still appending APPEND_SYSTEM.md from ~/.pi/agent or <cwd>/.pi
  appendSystemPromptOverride: () => [],
});
```

### Append — `appendSystemPromptOverride`

Pi may load `APPEND_SYSTEM.md` from agent/project dirs into the append list. Override to extend or clear:

```ts
appendSystemPromptOverride: (base) => [
  ...base,
  "## Extra\n- Prefer bullet points",
],
```

## Context files (AGENTS.md) — `agentsFilesOverride`

```ts
agentsFilesOverride: (current) => ({
  agentsFiles: [
    ...current.agentsFiles,
    { path: "/virtual/AGENTS.md", content: "# Guidelines\n\n- Be concise" },
  ],
}),
```

Return `{ agentsFiles: [] }` to disable discovered context files.

## Skills discovery paths

Pi discovers skills from (see [`docs/skills.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)):

| Scope | Paths |
|-------|-------|
| Global | `~/.pi/agent/skills/`, `~/.agents/skills/` |
| Project (trusted) | `.pi/skills/`, `.agents/skills/` (ancestors) |
| Packages / settings | package `skills/` or `pi.skills`; settings `skills` array |
| CLI | `--skill <path>` (repeatable) |

The `.agents/skills/` pair is the cross-agent convention and is where the `npx skills` CLI installs, so a skill placed there works in Pi and other agents at once. The `.pi/` paths are Pi-only; prefer them for skills that should not leak into other agents.

Directories with `SKILL.md` are discovered recursively. Progressive disclosure: names/descriptions in the system prompt; full `SKILL.md` loaded on demand (`read` or `/skill:name`).

## Skill object + `skillsOverride`

Upstream [`04-skills.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts) shows a `Skill` object (name, description, filePath, baseDir, sourceInfo via `createSyntheticSourceInfo`, `disableModelInvocation`) and `skillsOverride: (current) => ({ skills: [...], diagnostics })` on `DefaultResourceLoader`.

## Skill authoring tips

- Keep **SKILL.md** short: frontmatter `name` + `description`, then routing to deeper files by task.
- Put deep dives under **`references/`**; point the agent to `read` them only when needed.
- Ship small **`examples/`** the agent can copy.
- Description should say *when* to use the skill (triggers).

## Prompt templates (brief)

File-based slash commands under `.pi/prompts/` / `~/.pi/agent/prompts/`, or `promptsOverride` on the loader. Invoked as `/templatename`. See [`08-prompt-templates.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts) and [`docs/prompt-templates.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md).

## Practical order

1. Decide personality: replace vs append system prompt (clear `APPEND_SYSTEM.md` if replacing).
2. Add project rules via AGENTS.md / `agentsFilesOverride`.
3. Package repeatable workflows as skills (not a giant system prompt).
4. Add slash prompt templates for human-triggered snippets.
5. Only then add tools (`02-tools.md`) if the agent needs new actions.

## Upstream

- [`03-custom-prompt.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/03-custom-prompt.ts) — replace / append
- [`04-skills.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts) — discover + override
- [`07-context-files.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/07-context-files.ts) — AGENTS.md
- [`08-prompt-templates.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts) — slash templates
