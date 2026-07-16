# Troubleshooting

## pnpm blocks build scripts

If installation reports `ERR_PNPM_IGNORED_BUILDS`, run:

```bash
pnpm approve-builds
```

Approve only the expected HeroUI/Native dependencies. `hpsetup` also updates pnpm `allowBuilds` or `onlyBuiltDependencies` when applicable.

## Yarn Berry PnP

`hpsetup` does not support Yarn Berry PnP. Set this in `.yarnrc.yml` or switch package managers:

```yaml
nodeLinker: node-modules
```

## pnpm + Vite JSX export error

For `does not provide an export named 'jsx'`, add dependency pre-bundling:

```ts
export default defineConfig({
  optimizeDeps: {
    include: ["react", "react/jsx-runtime", "@heroui-pro/react"],
  },
});
```

Continue to import actual Pro components through subpaths.

## Multiple React instances in Vite/monorepos

If React hooks resolve from multiple copies or React is `null`, add:

```ts
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
});
```

## Missing shiki, marked, or react-markdown

Replace package-root Pro imports:

```tsx
// Wrong
import {AreaChart, ChartTooltip} from "@heroui-pro/react";

// Correct
import {AreaChart} from "@heroui-pro/react/area-chart";
import {ChartTooltip} from "@heroui-pro/react/chart-tooltip";
```

## HeroUI styles look wrong in a shadcn project

Inspect global CSS for shadcn theme variables, `shadcn/tailwind.css`, `tw-animate-css`, custom `@theme`, and base-layer overrides. Prefer removing or isolating those global theme rules instead of patching individual HeroUI components.

## Native Expo compatibility

Keep Expo Go and the project Expo SDK aligned. Repair core versions with:

```bash
npx -y expo install react-native react-native-worklets
npx -y expo install @shopify/react-native-skia
```

Use the Expo installer rather than manually choosing Skia versions.

## Native styles are absent

Verify both style imports and both `@source` directives. Resolve `@source` relative to the CSS file, not the repository root.

## MCP does not start

1. Confirm `node_modules/.bin/hpmcp` exists at the project root.
2. Confirm `HEROUI_PERSONAL_TOKEN` is exported or present in `.agent/.env.local`.
3. Run `node .agent/bin/hpmcp.mjs react` or `native` directly and inspect the error.
4. Use the client's diagnostics: `grok mcp doctor`, `codex mcp list`, `claude mcp list`, or `cursor-agent mcp list`.
5. Increase startup timeout only after confirming package download/startup is the cause.

## Skills are not discovered

Run:

```bash
node .agent/skills/setup-heroui-pro/scripts/sync-skills.mjs --root .
node .agent/skills/setup-heroui-pro/scripts/verify-project.mjs --root .
```

Then restart/reopen the Agent if its top-level skill directory was created after the session started. Trust the repository where required.
