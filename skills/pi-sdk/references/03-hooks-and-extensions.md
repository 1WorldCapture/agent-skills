# Hooks and extensions

Customize the agent loop without forking core. Upstream: [`06-extensions.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts). Docs: https://pi.dev/docs/latest/sdk · [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

## What an extension is

A TypeScript module that **default-exports** a function:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // register hooks, tools, commands, …
}
```

## Discovery paths

`DefaultResourceLoader` loads extensions from:

- `~/.pi/agent/extensions/`
- `<cwd>/.pi/extensions/`
- Paths in settings.json `"extensions"` array
- Plus loader options below

## Wiring via DefaultResourceLoader

```ts
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  additionalExtensionPaths: ["./my-logging-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[Inline Extension] Agent starting");
      });
    },
  ],
});
await resourceLoader.reload();

const { session } = await createAgentSession({ resourceLoader, /* … */ });
```

- **additionalExtensionPaths** — load specific files
- **extensionFactories** — inline `(pi) => void` without a file

## Key hooks (examples)

| Hook | Typical use |
|------|-------------|
| `agent_start` / `agent_end` | Logging, metrics, setup/teardown |
| `tool_call` | Observe or **block** (`return { block: true, reason: "…" }`) |
| `before_provider_headers` | Mutate outbound headers |
| `before_provider_request` | Inspect/adjust provider request payload |
| `context` | Influence assembled context |

Exact event names and payloads: [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

## session.subscribe vs extension hooks

| Channel | Best for |
|---------|----------|
| `session.subscribe` | App UI: stream tokens, show tool results, drive your own renderer |
| Extension `pi.on(...)` | Policy inside the agent runtime: block tools, register tools/commands, provider plumbing |

Subscriptions attach to one `AgentSession`. After `AgentSessionRuntime` replace/fork/resume, **re-subscribe** and re-`bindExtensions` as documented in the SDK guide.

## registerTool / registerCommand

```ts
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({ input: Type.String() }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `Processed: ${params.input}` }],
    details: {},
  }),
});

pi.registerCommand("mycommand", {
  description: "Do something",
  handler: async (args, ctx) => {
    ctx.ui.notify(`Command executed with: ${args}`);
  },
});
```

`customTools` (`02-tools.md`) and `registerTool` combine; if you use a `tools` allowlist, include the registered names.

## EventBus note

You can pass an `eventBus` into `DefaultResourceLoader` so extensions and your host app share typed cross-talk (`eventBus.on("my-extension:status", …)`). See sdk.md Extensions section.

## Do not fork core for hookable behavior

If the behavior is “run code around turns/tools/requests”, it belongs in an **extension**. Forking the monorepo is for missing primitives, not for logging, allowlists, or custom tools.

## Pointers

- [`docs/extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [`06-extensions.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts)
- [`13-session-runtime.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts) — re-subscribing after replace / fork / resume
