# Scaffold flows

Use one flow only. The commands are based on the CollectUI HeroUI Pro documentation; credentials are intentionally removed.

## Shared sequence

1. Inspect the target and lockfile.
2. Create or clone the base scaffold.
3. Install dependencies and prove the credential-free base app runs before adding any Pro import.
4. Confirm the selected lockfile is tracked and create a Git checkpoint when identity/work-tree conditions allow it.
5. Run `node .agent/bin/hpsetup.mjs --channel stable --dry-run` and then `--auto`.
6. Configure styles and one representative component.
7. Run the read-only `verify-app.mjs` protocol.

Do not use `--no-cache` during normal setup. It bypasses source and CDN caches and is rate-limited.

## Web

### Fast template

Use the bundled orchestrator when the user wants the shortest non-interactive path:

```bash
node "$SKILL_DIR/scripts/setup.mjs" \
  --root "$PROJECT_ROOT" \
  --topology web \
  --scaffold fast \
  --channel stable
```

The fast flow uses the current stable `create-next-app`, the official Next.js flat ESLint config, a read-only `lint`, separate `lint:fix`, `tsc --noEmit`, and a minimal non-watch Vitest test. It does not import or depend on the authenticated Pro payload during baseline validation. The repository's scheduled CI exercises this baseline on Node.js 20 and 22 with the current stable pnpm and public HeroUI packages.

### Custom scaffold

Use the HeroUI generator when the user needs generator choices:

```bash
version="$(npm view heroui-cli dist-tags.latest)"
case "$version" in *-*) echo "heroui-cli latest is prerelease: $version"; exit 1;; esac
npx -y "heroui-cli@$version" init <project-name>
```

Prefer Next.js App Router for new Next.js applications. The Pages Router option exists for older projects.

For any stable flow, resolve npm `latest` tags before installation and stop if the resolved version contains a prerelease suffix. Use `--channel beta` only after explicit user approval.

### Global CSS

```css
@import "tailwindcss";
@import "@heroui/styles";
@import "@heroui-pro/react/css";
```

For a chart or another interactive component in Next.js App Router, put `"use client"` at the top of the component module.

Use Web Pro subpaths:

```tsx
import {Card} from "@heroui/react";
import {AreaChart} from "@heroui-pro/react/area-chart";
import {ChartTooltip} from "@heroui-pro/react/chart-tooltip";
```

## Native

Start from the HeroUI Native example. Prefer an ephemeral clone command instead of requiring the optional global `p` CLI:

```bash
npx -y degit heroui-inc/heroui-native-example <project-name>
cd <project-name>
pnpm install
pnpm approve-builds
pnpm dlx expo install react-native react-native-worklets
```

Run `pnpm run start` and verify with an Expo Go version matching the project's Expo SDK.

### Global CSS

```css
@import "tailwindcss";
@import "uniwind";
@import "heroui-native/styles";
@import "heroui-native-pro/styles";

@source "./node_modules/heroui-native/lib";
@source "./node_modules/heroui-native-pro/lib";
```

Resolve each `@source` relative to the CSS file. If the CSS file is under `app/`, adjust the path to `../node_modules/...`.

Import Native Pro from `heroui-native-pro`; the Web subpath rule does not apply to Native.

For Skia warnings, run:

```bash
npx -y expo install @shopify/react-native-skia
```

For EAS builds, use Node.js 22 when pnpm 11 requires it. Invoke `hpsetup` through `.agent/bin/hpsetup.mjs` in CI or preinstall scripts; never embed the HP Key in `package.json`.

## Web-only monorepo

Use the documented ready-made template when its stack matches the request:

```bash
npx -y degit rhywonfeong/hp-default-monorepo-template <project-name>
cd <project-name>
bun install
```

Otherwise create a Better T Stack monorepo using the user's selected stack. Run `hpsetup` once at the repository root; it detects workspaces and installs React Pro into Web workspaces.

The documented style entry is commonly:

```text
packages/ui/src/styles/globals.css
```

Keep only the three HeroUI imports shown in the Web section when removing conflicting shadcn global theming.

## Web + Native monorepo

Use the documented Better T Stack command:

```bash
pnpm create better-t-stack@latest <project-name> \
  --frontend tanstack-router native-uniwind \
  --backend none \
  --runtime none \
  --api none \
  --auth none \
  --payments none \
  --database none \
  --orm none \
  --db-setup none \
  --package-manager pnpm \
  --git \
  --web-deploy none \
  --server-deploy none \
  --install \
  --addons turborepo \
  --examples none
```

Run `hpsetup` at the root with product `both`. It should install React Pro only in Web workspaces and Native Pro only in Native workspaces.

Typical style entries:

- Web: `packages/ui/src/styles/globals.css`
- Native: `apps/native/global.css`

Apply the Web and Native CSS blocks independently.

## Existing projects

Do not scaffold. Verify that the project uses Tailwind CSS v4 on Web and a supported Expo/Uniwind setup on Native. Add only the missing Pro dependencies, style imports, and Agent configuration.

Before mutation, run the existing build and record failures. Do not attribute pre-existing failures to HeroUI Pro.

Existing projects must expose read-only `lint`, `typecheck`, `test`, `build`, and `start` or `preview` scripts before final verification. Do not silently rewrite an existing application's scripts; report the mismatch and make a reviewed project change.
