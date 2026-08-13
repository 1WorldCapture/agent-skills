---
name: pi-sdk
description: Reference for building a custom agent on the Pi Coding Agent SDK (@earendil-works/pi-coding-agent), covering everything from a first working session to custom behavior, tools, and runtime extensions. Use when creating a new agent on Pi, embedding a Pi agent into an application, or extending and debugging an existing Pi-based agent.
---

# Pi Coding Agent SDK

Everything needed to get a first agent running is in this file. The routing table near the end indexes the deeper material under `references/`.

Official docs: https://pi.dev/docs/latest/sdk  
Upstream repo: https://github.com/earendil-works/pi  
Upstream SDK examples: https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk

## Core abstractions

```
Modes (CLI TUI / print / RPC)     ← optional UI shells
        ↓
AgentSessionRuntime               ← replace/fork/resume sessions
        ↓
AgentSession                      ← prompt / steer / events / compaction
        ↓
Agent + AgentState (pi-agent-core)← LLM loop
        ↑
ModelRuntime · SessionManager · SettingsManager · ResourceLoader
ResourceLoader → Extensions · Skills · Prompts · AGENTS.md · Themes
Tools (builtin + custom) feed Agent
```

CLI and SDK share `createAgentSession` → same provider request path. Embedding via SDK is first-class.

### Session stack

| Name | Role |
|------|------|
| **createAgentSession** | Main factory. Builds one `AgentSession` with model, tools, loaders, settings, session persistence. CLI and SDK share this path. |
| **AgentSession** | Prompt / steer / followUp, subscribe to events, compaction, model and thinking control, `dispose()`. One active conversation. |
| **AgentSessionRuntime** | Owns *replacing* the active session: new / resume / fork / import. Re-subscribe after replacement. Used by interactive, print, and RPC modes. |
| **Agent / AgentState** | Lower loop from `pi-agent-core` (package `agent`): LLM turn, tool calls, message state. Usually stay above this via `AgentSession`. |

### Managers and loaders

| Name | Role |
|------|------|
| **SessionManager** | Where session jsonl lives, or does not. Factories: `inMemory`, `create`, `continueRecent`, `open`, `list`. |
| **SettingsManager** | Merged settings. `create(cwd, agentDir?)` reads disk; `inMemory({...})` for tests and demos. |
| **ModelRuntime** | Auth and model catalog. Resolves keys, `getModel` / `getAvailable`, custom `authPath` / `modelsPath`. |
| **ResourceLoader / DefaultResourceLoader** | Supplies extensions, skills, prompt templates, themes, `AGENTS.md` and context. Overrides via `*Override` hooks and path options. |

### Capabilities loaded into the agent

| Name | Role |
|------|------|
| **Tools** | Actions the model can call. Builtins (`read`, `bash`, …) plus `defineTool` / `customTools` and extension `registerTool`. |
| **Extensions** | Default-export `(pi: ExtensionAPI) => void` modules. Hooks, custom tools, commands. See [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md). |
| **Skills** | On-demand `SKILL.md` packages (Agent Skills standard). Descriptions in prompt; full body loaded when needed. See [`docs/skills.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md). |
| **Prompt templates** | Slash-invoked snippets from `.pi/prompts/` or the agent dir, or `promptsOverride`. |
| **AGENTS.md / context files** | Project guidelines folded into system context; `agentsFilesOverride` to filter or replace. |

### Runtime behavior

| Name | Role |
|------|------|
| **Events** | `session.subscribe(listener)` streams `AgentSessionEvent`, e.g. `message_update` / `text_delta`. Extension hooks are a separate channel on `ExtensionAPI`. |
| **Compaction** | Summarize or shrink long histories. Controlled via settings and `session.compact()`. |

### Paths

| Path | Meaning |
|------|---------|
| **cwd** | Project working directory. Tools, discovery (`.pi/skills`, `.pi/extensions`, `AGENTS.md` walk), and session layout are cwd-scoped. |
| **agentDir** | User agent home, default `~/.pi/agent`. Holds `auth.json`, `models.json`, global skills, extensions, and settings. |

---

## Minimal agent

```ts
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
// Optional one-off key (not written to disk):
// await modelRuntime.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);

const [model] = await modelRuntime.getAvailable();
// Or pin one, but check the current catalog first — model ids move:
// const model = modelRuntime.getModel("anthropic", "claude-opus-4-7");

if (!model) throw new Error("No authenticated model available");

const { session } = await createAgentSession({
  model,
  thinkingLevel: "off",
  modelRuntime,
  sessionManager: SessionManager.inMemory(), // demos/tests: no jsonl on disk
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Say hi in one sentence.");
session.dispose();
```

`examples/01-minimal-agent.ts` is the runnable version of this and the only example carried locally: it selects through `getAvailable()` with an actionable error when nothing is authenticated, isolates session and settings in memory, and disposes in a `finally`. Copy that file rather than retyping the code above.

## Run it

### Install

```bash
npm install @earendil-works/pi-coding-agent
```

Node 20+ with TypeScript. The SDK ships inside the main package; there is no separate SDK install. Run TypeScript files with `npx tsx your-file.ts`.

### Auth and models

`ModelRuntime` resolves credentials in this order:

1. **Runtime overrides** — `await modelRuntime.setRuntimeApiKey(provider, key)` (not persisted)
2. **Stored credentials** — `auth.json` (API keys or OAuth)
3. **Environment variables** — e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
4. **Fallback / custom resolvers** — e.g. provider keys from `models.json`

Defaults are `~/.pi/agent/auth.json` and `~/.pi/agent/models.json`. Pass `authPath` / `modelsPath` into `ModelRuntime.create({ ... })` to relocate them, or inject a `CredentialStore` such as `InMemoryCredentialStore` from `@earendil-works/pi-ai`.

Pick a model with either:

- `modelRuntime.getModel(provider, id)` — by provider and id, including custom entries from `models.json`; resolves without requiring a key
- `await modelRuntime.getAvailable()` — only models that have valid auth configured

Omitting `model` in `createAgentSession` falls back through session restore → settings default → first available.

`thinkingLevel` accepts `"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"`; providers may support a subset.

### Defaults you get for free

- Builtin tools unless you override them: `read`, `bash`, `edit`, `write`
- `DefaultResourceLoader` discovery from `cwd` + `agentDir` (`~/.pi/agent`)
- Settings from `SettingsManager.create()` unless you pass `SettingsManager.inMemory(...)`

For a fully isolated demo, with no settings or session touching disk:

```ts
sessionManager: SessionManager.inMemory(),
settingsManager: SettingsManager.inMemory({ /* optional overrides */ }),
```

### Session and settings persistence

| `SessionManager` factory | Behavior |
|---------|----------|
| `inMemory(cwd?)` | No jsonl on disk. Best for demos and tests. |
| `create(cwd, sessionDir?)` | New persistent session file. |
| `continueRecent(cwd, sessionDir?)` | Resume the most recent, or create if none. |
| `open(path)` | Open a specific session file. |
| `list(cwd, sessionDir?)` | List sessions, then `open`. |

| `SettingsManager` API | Use |
|-----|-----|
| `create(cwd, agentDir?)` | Load merged global + project settings from disk. |
| `inMemory(overrides?)` | No file I/O; pass overrides for tests. |
| `applyOverrides` / setters + `flush()` | Mutate; `flush()` for durability; `drainErrors()` for I/O errors. |

### Checklist before moving on

- [ ] Session constructs without throw
- [ ] `prompt()` streams text via `subscribe`
- [ ] You know where auth lives (`ModelRuntime` / env / `auth.json`)

### Common failures

| Symptom | Likely cause |
|---------|----------------|
| `Model not found` / empty `getAvailable()` | Missing API key / OAuth / wrong `authPath` |
| Unexpected tools or skills | Default `DefaultResourceLoader` discovering from `cwd` + `agentDir` |
| Settings bleeding into demos | Use `SettingsManager.inMemory(...)` |
| Session files appearing | Use `SessionManager.inMemory()` |
| Stream never prints | Subscribe before `prompt`; check `message_update` + `text_delta` |
| Forgot cleanup | Always `dispose()`, preferably in `try/finally` |

## Working rules

- Deliver a single runnable file at the minimum path above before adding anything else.
- Prefer the shallowest surface that works: session options → loader overrides → tools → extensions → core fork.
- Introduce `DefaultResourceLoader` only when the system prompt, skills, or context files must change.
- Introduce Extensions only when hooks or commands are needed beyond `customTools`.
- Replacement APIs live on `AgentSessionRuntime`, not on `AgentSession`.
- Never start from a fork of the pi monorepo.
- The SDK is pre-1.0 and its surface still moves. These notes were checked against `@earendil-works/pi-coding-agent` 0.84.1; for any later version, confirm exported names against the installed types and prefer an upstream example over a snippet quoted here when the two disagree.
- Never hardcode a model id from memory. Resolve through `getAvailable()`, or check the current catalog before pinning one.

---

## Routing

Everything above covers getting a session running, looking up a name, and debugging startup. For anything further, match the task, read that one file, and stop at the shallowest entry that unblocks it.

| Task | Read |
|------|------|
| Replace or append the system prompt, load skills, inject `AGENTS.md` and context files | `references/01-prompt-and-skills.md` |
| Add or restrict actions: `defineTool`, `customTools`, tool allowlists, `excludeTools` | `references/02-tools.md` |
| Run code around the loop: `agent_start`, block a `tool_call`, mutate provider requests, `registerCommand` | `references/03-hooks-and-extensions.md` |
| Change Pi itself because no SDK or extension surface can express the need | `references/04-core-internals.md` |

## Upstream examples

Canonical, always-current source for patterns beyond the minimal agent. These links track `main`, so prefer reading one over reproducing remembered code.

| Topic | File |
|-------|------|
| Defaults only, smallest possible session | [`01-minimal.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/01-minimal.ts) |
| Model selection and `thinkingLevel` | [`02-custom-model.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts) |
| Replace or append the system prompt | [`03-custom-prompt.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/03-custom-prompt.ts) |
| Discover and override skills | [`04-skills.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts) |
| Custom tools | [`05-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts) |
| Extensions and hooks | [`06-extensions.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) |
| `AGENTS.md` and context files | [`07-context-files.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/07-context-files.ts) |
| Slash prompt templates | [`08-prompt-templates.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts) |
| API keys, OAuth, credential paths | [`09-api-keys-and-oauth.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts) |
| Settings | [`10-settings.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/10-settings.ts) |
| Session persistence and resume | [`11-sessions.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts) |
| Full control over the assembled session | [`12-full-control.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts) |
| `AgentSessionRuntime`: replace, fork, resume | [`13-session-runtime.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts) |
