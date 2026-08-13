# Core internals (last resort)

Change Pi itself only when the extension/SDK surface cannot express the need. Docs: https://pi.dev/docs/latest/sdk · repo https://github.com/earendil-works/pi.

## Monorepo packages (high level)

| Package | Role |
|---------|------|
| `coding-agent` | CLI + SDK (`createAgentSession`), tools, loaders, sessions, modes |
| `agent` | Agent loop / AgentState (pi-agent-core) |
| `ai` | Providers, models, credentials, streaming |
| `tui` | Terminal UI primitives |
| `client` / `server` / `protocol` | Remote / RPC-style pieces |
| `session-backends` | Session storage backends |
| `telemetry` | Telemetry helpers |
| `evals` | Evaluation harness |

CLI modes (interactive TUI, print, RPC) wrap the same **`createAgentSession`** / **`AgentSessionRuntime`** stack you embed. Fix behavior at that boundary before diving inward.

## When you actually need core changes

| Need | Prefer |
|------|--------|
| Custom tool, command, hook, prompt, skill | Extension / ResourceLoader |
| Different auth path or model list | `ModelRuntime` options / `models.json` |
| New UI shell | Subscribe to `AgentSession` events; optional run-mode helpers |
| New provider transport or agent-loop semantics | Core packages (`ai`, `agent`, …) |
| Bug in shared session/tool path | Fix in `coding-agent` with tests |

## How to navigate

1. Read root [`AGENTS.md`](https://github.com/earendil-works/pi/blob/main/AGENTS.md) (dev rules, check commands, git hygiene).
2. Start in [`packages/coding-agent/src/core`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core) for session/runtime wiring.
3. Follow imports into [`packages/agent`](https://github.com/earendil-works/pi/tree/main/packages/agent) (loop) and [`packages/ai`](https://github.com/earendil-works/pi/tree/main/packages/ai) (providers).
4. Mirror patterns in https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk.
5. Contribution process: [`CONTRIBUTING.md`](https://github.com/earendil-works/pi/blob/main/CONTRIBUTING.md) (issues/PRs, quality bar).

## Reminder

Embedding apps should almost always stay on the public SDK + extensions. Forking core couples you to internal refactors; upstream will keep expanding the extension surface instead—use that first.
