# Tools

Give the agent actions. Upstream: [`05-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts) and the status-tool pattern in [`docs/sdk.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) (“Complete Example”). Docs: https://pi.dev/docs/latest/sdk

## Builtin tool names

| Name | Typical use |
|------|-------------|
| `read` | Read files |
| `bash` | Shell |
| `edit` | Patch existing files (`details.diff` / `details.patch`) |
| `write` | Create/overwrite files |
| `grep` | Search content |
| `find` | Find paths |
| `ls` | List directories |

**Default built-ins** (if you do not pass `tools`): `read`, `bash`, `edit`, `write`.

## Allowlist, exclude, none

```ts
// Allowlist (built-in, extension, and custom names)
tools: ["read", "bash", "grep"],

// After allowlist (or defaults), drop specific names
excludeTools: ["bash"],

// noTools: "all"     → disable all tools
// noTools: "builtin" → disable default built-ins; keep extension/custom tools
```

If you pass `tools`, **include every custom/extension tool name** you want enabled, e.g. `tools: ["read", "bash", "status"]`.

## defineTool + customTools

Parameter schemas use `typebox` (v1, package name `typebox`, not `@sinclair/typebox`). Install it explicitly; it reaches you only as a transitive dependency of the SDK.

```ts
import { Type } from "typebox";
import {
  createAgentSession,
  defineTool,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const statusTool = defineTool({
  name: "status",
  label: "Status",
  description: "Get system status",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `Uptime: ${process.uptime()}s` }],
    details: {},
  }),
});

const { session } = await createAgentSession({
  tools: ["read", "status"],
  customTools: [statusTool],
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory({}),
});
```

Use `defineTool()` for standalone definitions and `customTools: [...]`. Extension `pi.registerTool({ ... })` is the alternative when you already need hooks or commands (`03-hooks-and-extensions.md`).

For a runnable version, start from `../examples/01-minimal-agent.ts` and add the `tools` / `customTools` fields shown above, or read the current upstream [`05-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts).

## Safe read-only starter

```ts
tools: ["read", "grep", "find", "ls"],
```

No `edit` / `write` / `bash` — good for Q&A over a tree.

## cwd note

When you pass a custom `cwd`, `createAgentSession()` builds selected built-ins for that cwd. Keep `SessionManager.inMemory(cwd)` (or create/open under the same cwd) aligned:

```ts
const cwd = "/path/to/project";
await createAgentSession({
  cwd,
  tools: ["read", "bash", "edit", "write"],
  sessionManager: SessionManager.inMemory(cwd),
});
```

## When to move to extensions

Stay with `customTools` unless you need:

- Lifecycle hooks (`agent_start`, `tool_call` block, provider request mutation, …)
- `registerCommand` / shared EventBus
- Loading tools from discovered extension files

Then read `03-hooks-and-extensions.md` and upstream [`06-extensions.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts).
