#!/usr/bin/env node

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {atomicWriteFile, CREDENTIAL_KEYS, mergeEnvText, readEnvFile} from "./_shared.mjs";
import {syncSkills} from "./sync-skills.mjs";

const VALID_PRODUCTS = new Set(["react", "native", "both"]);
const VALID_AGENTS = new Set(["grok", "codex", "claude", "cursor"]);
const VALID_CHANNELS = new Set(["stable", "beta"]);
const START_MARKER = "# BEGIN setup-heroui-pro managed MCP";
const END_MARKER = "# END setup-heroui-pro managed MCP";

function parseArgs(argv) {
  const args = {agents: "grok,codex,claude,cursor", channel: "stable", root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--product") args.product = argv[++index];
    else if (arg === "--agents") args.agents = argv[++index];
    else if (arg === "--channel") args.channel = argv[++index];
    else if (arg === "--persist-env") args.persistEnv = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot merge invalid JSON at ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureLines(file, requiredLines) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = current.split(/\r?\n/).filter(Boolean);
  for (const line of requiredLines) if (!lines.includes(line)) lines.push(line);
  atomicWriteFile(file, `${lines.join("\n")}\n`);
}

function mergeMcpJson(file, servers) {
  const config = readJson(file, {});
  config.mcpServers = {...(config.mcpServers || {}), ...servers};
  writeJson(file, config);
}

function upsertTomlBlock(file, block) {
  mkdirSync(dirname(file), {recursive: true});
  let current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, "g");
  current = current.replace(pattern, "").trimEnd();
  const separator = current ? "\n\n" : "";
  atomicWriteFile(file, `${current}${separator}${START_MARKER}\n${block.trim()}\n${END_MARKER}\n`);
}

function productsFor(product) {
  if (product === "react") return [{name: "heroui-pro", target: "react"}];
  if (product === "native") return [{name: "heroui-native-pro", target: "native"}];
  return [
    {name: "heroui-pro", target: "react"},
    {name: "heroui-native-pro", target: "native"},
  ];
}

function jsonServers(products) {
  return Object.fromEntries(products.map(({name, target}) => [
    name,
    {
      type: "stdio",
      command: "node",
      args: [".agent/bin/hpmcp.mjs", target],
      env: {CACHE_TTL: "1800"},
    },
  ]));
}

function tomlServers(products, includeCwd) {
  return products.map(({name, target}) => {
    const lines = [
      `[mcp_servers.${JSON.stringify(name)}]`,
      'command = "node"',
      `args = [".agent/bin/hpmcp.mjs", ${JSON.stringify(target)}]`,
      'env = { CACHE_TTL = "1800" }',
    ];
    if (includeCwd) lines.splice(3, 0, 'cwd = "."');
    return lines.join("\n");
  }).join("\n\n");
}

function copySelf(skillRoot, target) {
  if (resolve(skillRoot) === resolve(target)) return;
  rmSync(target, {recursive: true, force: true});
  cpSync(skillRoot, target, {
    recursive: true,
    filter: (entry) => !entry.endsWith("/.DS_Store") && !entry.endsWith("\\.DS_Store"),
  });
}

function persistEnvironment(root) {
  const file = resolve(root, ".agent/.env.local");
  const values = Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, process.env[key] ?? ""]));
  const missing = CREDENTIAL_KEYS.filter((key) => !String(values[key]).trim());
  if (missing.length) throw new Error(`--persist-env requires non-empty ${CREDENTIAL_KEYS.join(" and ")}; missing: ${missing.join(", ")}.`);
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  atomicWriteFile(file, mergeEnvText(current, values), {mode: 0o600});
  const verified = readEnvFile(file);
  if (CREDENTIAL_KEYS.some((key) => verified[key] !== values[key])) throw new Error("Credential file verification failed after atomic write.");
  if (process.platform !== "win32") chmodSync(file, 0o600);
}

function assertManagedDiscovery(root, agents) {
  const lockFile = resolve(root, "skills-lock.json");
  if (!existsSync(lockFile)) throw new Error("Missing skills-lock.json. Install setup-heroui-pro with npx skills add before configuration.");
  let entry;
  try {
    entry = JSON.parse(readFileSync(lockFile, "utf8")).skills?.["setup-heroui-pro"];
  } catch (error) {
    throw new Error(`Invalid skills-lock.json: ${error.message}`);
  }
  if (!entry || entry.sourceType !== "github" || !String(entry.source || "").includes("1WorldCapture/agent-skills")) {
    throw new Error("skills-lock.json must record setup-heroui-pro from 1WorldCapture/agent-skills.");
  }
  if ((agents.includes("codex") || agents.includes("cursor")) && !existsSync(resolve(root, ".agents/skills/setup-heroui-pro/SKILL.md"))) {
    throw new Error("Missing npx-managed .agents discovery copy for setup-heroui-pro.");
  }
  if ((agents.includes("claude") || agents.includes("grok")) && !existsSync(resolve(root, ".claude/skills/setup-heroui-pro/SKILL.md"))) {
    throw new Error("Missing npx-managed .claude discovery copy for setup-heroui-pro.");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node configure-project.mjs --product <react|native|both> [--root <path>] [--agents grok,codex,claude,cursor] [--channel stable|beta] [--persist-env]");
    return;
  }
  if (!VALID_PRODUCTS.has(args.product)) throw new Error("--product must be react, native, or both.");
  if (!VALID_CHANNELS.has(args.channel)) throw new Error("--channel must be stable or beta.");

  const agents = [...new Set(args.agents.split(",").map((value) => value.trim()).filter(Boolean))];
  const invalidAgent = agents.find((agent) => !VALID_AGENTS.has(agent));
  if (invalidAgent) throw new Error(`Unsupported agent: ${invalidAgent}`);

  const root = resolve(args.root);
  assertManagedDiscovery(root, agents);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillRoot = resolve(scriptDir, "..");
  const agentRoot = resolve(root, ".agent");
  mkdirSync(resolve(agentRoot, "bin"), {recursive: true});
  mkdirSync(resolve(agentRoot, "skills"), {recursive: true});

  writeJson(resolve(agentRoot, "config.json"), {
    schemaVersion: 1,
    product: args.product,
    channel: args.channel,
    agents,
    canonicalSkillsDir: ".agent/skills",
    setupSkillManagedBy: "npx-skills",
  });
  writeFileSync(resolve(agentRoot, ".env.example"), "HEROUI_KEY=\nHEROUI_PERSONAL_TOKEN=\nCACHE_TTL=1800\n");
  ensureLines(resolve(agentRoot, ".gitignore"), [".env.local", "setup-state.json", ".tmp/"]);

  const runnerFiles = [
    ["_shared.mjs", "_shared.mjs"],
    ["_npm-channel.mjs", "_npm-channel.mjs"],
    ["hpmcp-runner.mjs", "hpmcp.mjs"],
    ["hpsetup-runner.mjs", "hpsetup.mjs"],
  ];
  for (const [source, destination] of runnerFiles) {
    const target = resolve(agentRoot, "bin", destination);
    cpSync(resolve(scriptDir, source), target);
    chmodSync(target, 0o755);
  }

  copySelf(skillRoot, resolve(agentRoot, "skills/setup-heroui-pro"));
  if (args.persistEnv) persistEnvironment(root);

  const products = productsFor(args.product);
  const servers = jsonServers(products);
  if (agents.includes("claude")) mergeMcpJson(resolve(root, ".mcp.json"), servers);
  if (agents.includes("cursor")) mergeMcpJson(resolve(root, ".cursor/mcp.json"), servers);
  if (agents.includes("codex")) upsertTomlBlock(resolve(root, ".codex/config.toml"), tomlServers(products, true));
  if (agents.includes("grok")) upsertTomlBlock(resolve(root, ".grok/config.toml"), tomlServers(products, false));

  const syncResult = syncSkills(root);
  console.log(`Configured ${args.product} for ${agents.join(", ")} at ${root}`);
  console.log(`Canonical skills: ${relative(root, resolve(agentRoot, "skills"))}`);
  for (const destination of syncResult.destinations) console.log(`Discovery copy: ${relative(root, destination)}`);
  if (!existsSync(resolve(agentRoot, ".env.local"))) {
    console.log("Credentials were not persisted. Export them or create .agent/.env.local from .agent/.env.example.");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
