#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, renameSync} from "node:fs";
import {basename, dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {atomicWriteFile, credentialStatuses} from "./_shared.mjs";
import {resolveNpmChannelVersion} from "./_npm-channel.mjs";

const PHASES = ["preflight", "scaffold", "baseline", "discovery", "configure", "credentials", "hpsetup-dry-run", "install", "skills", "verify"];
const PRODUCT_BY_TOPOLOGY = {web: "react", native: "native", "monorepo-web": "react", "monorepo-web-native": "both"};

function parseArgs(argv) {
  const args = {
    agents: "grok,codex,claude,cursor",
    channel: "stable",
    root: ".",
    scaffold: "fast",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--topology") args.topology = argv[++index];
    else if (arg === "--scaffold") args.scaffold = argv[++index];
    else if (arg === "--agents") args.agents = argv[++index];
    else if (arg === "--channel") args.channel = argv[++index];
    else if (arg === "--expect") args.expect = argv[++index];
    else if (arg === "--persist-env") args.persistEnv = true;
    else if (arg === "--verify") args.verify = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function run(command, args, options = {}) {
  const isBareCommand = !command.includes("/") && !command.includes("\\");
  const executable = process.platform === "win32" && isBareCommand && !command.endsWith(".cmd") ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    encoding: options.capture ? "utf8" : undefined,
    env: {...process.env, ...(options.env || {})},
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}.${options.capture ? `\n${result.stderr}` : ""}`);
  return result;
}

function readState(file) {
  if (!existsSync(file)) return {completed: []};
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveState(file, state) {
  atomicWriteFile(file, `${JSON.stringify(state, null, 2)}\n`);
}

function ensureLines(file, requiredLines) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = current.split(/\r?\n/).filter(Boolean);
  for (const line of requiredLines) if (!lines.includes(line)) lines.push(line);
  atomicWriteFile(file, `${lines.join("\n")}\n`);
}

function complete(file, state, phase, details = {}) {
  state.completed = [...new Set([...(state.completed || []), phase])];
  state.lastCompleted = phase;
  Object.assign(state, details);
  saveState(file, state);
  console.log(`setup-heroui-pro: completed ${phase}`);
}

function hasCompleted(state, phase) {
  return (state.completed || []).includes(phase);
}

function packageManager(root) {
  if (existsSync(resolve(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(root, "bun.lock")) || existsSync(resolve(root, "bun.lockb"))) return "bun";
  if (existsSync(resolve(root, "yarn.lock"))) return "yarn";
  return "npm";
}

function normalizeFastWeb(root) {
  const packageFile = resolve(root, "package.json");
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  packageJson.scripts = {
    ...(packageJson.scripts || {}),
    lint: "eslint .",
    "lint:fix": "eslint . --fix",
    typecheck: "tsc --noEmit",
    test: "vitest run",
  };
  atomicWriteFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  const testFile = resolve(root, "src/__tests__/baseline.test.ts");
  if (!existsSync(testFile)) {
    atomicWriteFile(testFile, 'import {describe, expect, it} from "vitest";\n\ndescribe("baseline", () => {\n  it("runs tests", () => expect(true).toBe(true));\n});\n');
  }
  const ignoreFile = resolve(root, ".gitignore");
  if (existsSync(ignoreFile)) {
    const filtered = readFileSync(ignoreFile, "utf8").split(/\r?\n/).filter((line) => !/^\/?(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(line.trim()));
    atomicWriteFile(ignoreFile, `${filtered.join("\n").replace(/\n+$/, "")}\n`);
  }
  if (!existsSync(resolve(root, "eslint.config.mjs")) && !existsSync(resolve(root, "eslint.config.js"))) {
    throw new Error("Fast Web scaffold is missing the official Next.js flat ESLint configuration.");
  }
  run("pnpm", ["add", "-D", "vitest"], {cwd: root});
}

function ensureGitCheckpoint(root, createdBySetup) {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {cwd: root, encoding: "utf8"});
  if (inside.status !== 0) run("git", ["init", "-b", "main"], {cwd: root});
  const manager = packageManager(root);
  const lockfile = {pnpm: "pnpm-lock.yaml", npm: "package-lock.json", yarn: "yarn.lock", bun: existsSync(resolve(root, "bun.lock")) ? "bun.lock" : "bun.lockb"}[manager];
  if (!existsSync(resolve(root, lockfile))) throw new Error(`Missing required ${lockfile}; reproducible setup requires the selected package manager lockfile.`);
  const ignored = spawnSync("git", ["check-ignore", "-q", lockfile], {cwd: root});
  if (ignored.status === 0) throw new Error(`${lockfile} is ignored; remove that rule before continuing.`);
  const status = run("git", ["status", "--porcelain=v1", "-uall"], {cwd: root, capture: true}).stdout;
  if (!status.trim()) return "clean";
  if (!createdBySetup) {
    console.warn("WARN: Existing project is dirty; baseline checkpoint was not created.");
    return "skipped-dirty-existing-project";
  }
  const name = spawnSync("git", ["config", "user.name"], {cwd: root, encoding: "utf8"}).stdout?.trim();
  const email = spawnSync("git", ["config", "user.email"], {cwd: root, encoding: "utf8"}).stdout?.trim();
  if (!name || !email) {
    console.warn("WARN: Git identity is missing; baseline checkpoint was not created.");
    return "skipped-missing-identity";
  }
  run("git", ["add", "-A"], {cwd: root});
  run("git", ["commit", "-m", "chore: checkpoint baseline scaffold"], {cwd: root});
  return "created";
}

function installLocalHpmcp(root) {
  if (existsSync(resolve(root, "node_modules/.bin", process.platform === "win32" ? "hpmcp.cmd" : "hpmcp"))) return;
  const version = resolveNpmChannelVersion("hpmcp", "stable");
  const manager = packageManager(root);
  if (manager === "pnpm") run("pnpm", ["add", existsSync(resolve(root, "pnpm-workspace.yaml")) ? "-Dw" : "-D", `hpmcp@${version}`], {cwd: root});
  else if (manager === "npm") run("npm", ["install", "-D", `hpmcp@${version}`], {cwd: root});
  else if (manager === "bun") run("bun", ["add", "-d", `hpmcp@${version}`], {cwd: root});
  else run("yarn", ["add", "-D", `hpmcp@${version}`], {cwd: root});
}

function hasManagedDiscovery(root) {
  const lockFile = resolve(root, "skills-lock.json");
  if (!existsSync(lockFile)) return false;
  try {
    const entry = JSON.parse(readFileSync(lockFile, "utf8")).skills?.["setup-heroui-pro"];
    if (!entry || entry.sourceType !== "github" || !String(entry.source || "").includes("1WorldCapture/agent-skills")) return false;
    return existsSync(resolve(root, ".agents/skills/setup-heroui-pro/SKILL.md"))
      && existsSync(resolve(root, ".claude/skills/setup-heroui-pro/SKILL.md"));
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node setup.mjs --root <path> --topology <web|native|monorepo-web|monorepo-web-native> [--scaffold fast|custom|existing] [--agents grok,codex,claude,cursor] [--channel stable|beta] [--persist-env] [--verify] [--expect <text>]");
    return;
  }
  if (!PRODUCT_BY_TOPOLOGY[args.topology]) throw new Error("--topology is required and must be web, native, monorepo-web, or monorepo-web-native.");
  if (!new Set(["stable", "beta"]).has(args.channel)) throw new Error("--channel must be stable or beta.");
  const root = resolve(args.root);
  const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)));
  const projectStateFile = resolve(root, ".agent/setup-state.json");
  let stateFile = existsSync(resolve(root, "package.json")) || existsSync(projectStateFile)
    ? projectStateFile
    : resolve(dirname(root), `.${basename(root)}.setup-heroui-pro-state.json`);
  mkdirSync(dirname(stateFile), {recursive: true});
  const state = readState(stateFile);
  const signature = JSON.stringify({agents: args.agents, channel: args.channel, scaffold: args.scaffold, topology: args.topology});
  if (state.signature && state.signature !== signature) throw new Error("Setup options changed since the saved run. Review or remove .agent/setup-state.json before restarting.");
  state.signature = signature;
  saveState(stateFile, state);

  if (!hasCompleted(state, "preflight")) {
    const major = Number(process.versions.node.split(".")[0]);
    if (major < 20) throw new Error("Node.js 20 or newer is required; use Node.js 22 for Native EAS builds.");
    const manager = existsSync(resolve(root, "package.json")) ? packageManager(root) : "pnpm";
    run(manager, ["--version"], {cwd: existsSync(root) ? root : dirname(root)});
    complete(stateFile, state, "preflight");
  }

  if (!hasCompleted(state, "scaffold")) {
    const alreadyExists = existsSync(resolve(root, "package.json"));
    if (!alreadyExists) {
      if (args.topology !== "web" || args.scaffold !== "fast") throw new Error("Automatic new-project scaffolding currently supports --topology web --scaffold fast; use the topology reference for custom/native scaffolds.");
      const version = resolveNpmChannelVersion("create-next-app", "stable");
      mkdirSync(dirname(root), {recursive: true});
      run("pnpm", ["dlx", `create-next-app@${version}`, basename(root), "--ts", "--tailwind", "--eslint", "--app", "--src-dir", "--import-alias", "@/*", "--use-pnpm", "--yes"], {cwd: dirname(root)});
      normalizeFastWeb(root);
      state.createdBySetup = true;
    } else {
      state.createdBySetup = false;
    }
    complete(stateFile, state, "scaffold", {createdBySetup: state.createdBySetup});
    if (stateFile !== projectStateFile) {
      mkdirSync(dirname(projectStateFile), {recursive: true});
      renameSync(stateFile, projectStateFile);
      stateFile = projectStateFile;
    }
    ensureLines(resolve(root, ".agent/.gitignore"), [".env.local", "setup-state.json", ".tmp/"]);
  }

  if (!hasCompleted(state, "baseline")) {
    run(process.execPath, [resolve(scriptDir, "verify-app.mjs"), "--root", root], {cwd: root});
    const checkpoint = ensureGitCheckpoint(root, state.createdBySetup);
    complete(stateFile, state, "baseline", {checkpoint});
  }

  if (!hasCompleted(state, "discovery")) {
    if (!hasManagedDiscovery(root)) {
      run("npx", ["-y", "skills", "add", "1WorldCapture/agent-skills", "--skill", "setup-heroui-pro", "--agent", "codex", "--agent", "cursor", "--agent", "claude-code", "--yes"], {cwd: root, env: {DISABLE_TELEMETRY: "1"}});
    }
    complete(stateFile, state, "discovery");
  }

  const configureArgs = [resolve(scriptDir, "configure-project.mjs"), "--root", root, "--product", PRODUCT_BY_TOPOLOGY[args.topology], "--agents", args.agents, "--channel", args.channel];
  if (!hasCompleted(state, "configure")) {
    run(process.execPath, args.persistEnv ? [...configureArgs, "--persist-env"] : configureArgs, {cwd: root});
    complete(stateFile, state, "configure", {persistedEnv: Boolean(args.persistEnv)});
  } else if (args.persistEnv && !state.persistedEnv) {
    run(process.execPath, [...configureArgs, "--persist-env"], {cwd: root});
    state.persistedEnv = true;
    saveState(stateFile, state);
  }

  if (!hasCompleted(state, "credentials")) {
    const statuses = credentialStatuses(root);
    for (const [key, status] of Object.entries(statuses)) console.log(`${key}=${status}`);
    if (Object.values(statuses).some((status) => status !== "available")) {
      saveState(stateFile, state);
      throw new Error("Both HeroUI credentials must be non-empty. Set them outside chat, then rerun the same setup command to resume.");
    }
    complete(stateFile, state, "credentials");
  }

  if (!hasCompleted(state, "hpsetup-dry-run")) {
    run(process.execPath, [resolve(root, ".agent/bin/hpsetup.mjs"), "--channel", args.channel, "--dry-run"], {cwd: root});
    complete(stateFile, state, "hpsetup-dry-run");
  }

  if (!hasCompleted(state, "install")) {
    run(process.execPath, [resolve(root, ".agent/bin/hpsetup.mjs"), "--channel", args.channel, "--auto"], {cwd: root});
    installLocalHpmcp(root);
    complete(stateFile, state, "install");
  }

  if (!hasCompleted(state, "skills")) {
    run(process.execPath, [resolve(scriptDir, "install-agent-skills.mjs"), "--root", root], {cwd: root});
    complete(stateFile, state, "skills");
  }

  if (!hasCompleted(state, "verify") || (args.verify && state.verificationMode !== "full")) {
    run(process.execPath, [resolve(scriptDir, "verify-project.mjs"), "--root", root], {cwd: root});
    if (args.verify) {
      const verifyArgs = [resolve(scriptDir, "verify-app.mjs"), "--root", root];
      if (args.expect) verifyArgs.push("--expect", args.expect);
      run(process.execPath, verifyArgs, {cwd: root});
      run(process.execPath, [resolve(scriptDir, "verify-agent-runtime.mjs"), "--root", root, "--agents", args.agents], {cwd: root});
    }
    complete(stateFile, state, "verify", {verificationMode: args.verify ? "full" : "project"});
  }
  console.log(`setup-heroui-pro: complete (${PHASES.join(" → ")})`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
