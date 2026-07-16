#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {homedir} from "node:os";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {redactSensitive} from "./_shared.mjs";

const CLI_SPECS = {
  codex: {command: "codex", args: ["mcp", "list"]},
  claude: {command: "claude", args: ["mcp", "list"]},
  cursor: {command: "cursor-agent", args: ["mcp", "list"]},
  grok: {command: "grok", args: ["inspect"]},
};

function parseArgs(argv) {
  const args = {root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--agents") args.agents = argv[++index];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function expectedNames(product) {
  if (product === "react") return ["heroui-pro"];
  if (product === "native") return ["heroui-native-pro"];
  return ["heroui-pro", "heroui-native-pro"];
}

function jsonMcpNames(file) {
  if (!existsSync(file)) return new Set();
  try {
    const names = new Set();
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (value.mcpServers && typeof value.mcpServers === "object") {
        for (const name of Object.keys(value.mcpServers)) names.add(name);
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(JSON.parse(readFileSync(file, "utf8")));
    return names;
  } catch {
    return new Set();
  }
}

function tomlMcpNames(file) {
  if (!existsSync(file)) return new Set();
  const names = new Set();
  for (const match of readFileSync(file, "utf8").matchAll(/^\s*\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\]\s*$/gm)) {
    names.add(match[1] || match[2]);
  }
  return names;
}

function userNamesFor(agent) {
  const home = homedir();
  if (agent === "claude") return jsonMcpNames(resolve(home, ".claude.json"));
  if (agent === "cursor") return jsonMcpNames(resolve(home, ".cursor/mcp.json"));
  if (agent === "codex") return tomlMcpNames(resolve(home, ".codex/config.toml"));
  if (agent === "grok") return tomlMcpNames(resolve(home, ".grok/config.toml"));
  return new Set();
}

function projectNamesFor(root, agent) {
  if (agent === "claude") return jsonMcpNames(resolve(root, ".mcp.json"));
  if (agent === "cursor") return jsonMcpNames(resolve(root, ".cursor/mcp.json"));
  if (agent === "codex") return tomlMcpNames(resolve(root, ".codex/config.toml"));
  if (agent === "grok") return tomlMcpNames(resolve(root, ".grok/config.toml"));
  return new Set();
}

function safeOutput(value) {
  const sanitized = redactSensitive(value).trim();
  if (!sanitized) return "(no output)";
  return sanitized.length > 12_000 ? `${sanitized.slice(0, 12_000)}\n[OUTPUT TRUNCATED]` : sanitized;
}

export function verifyAgentRuntime(rootInput = ".", selectedAgents) {
  const root = resolve(rootInput);
  const configPath = resolve(root, ".agent/config.json");
  if (!existsSync(configPath)) throw new Error("Missing .agent/config.json; run configure-project.mjs first.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const agents = selectedAgents?.length ? selectedAgents : config.agents || [];
  const expected = expectedNames(config.product);
  const results = [];

  for (const agent of agents) {
    const spec = CLI_SPECS[agent];
    if (!spec) continue;
    const projectNames = projectNamesFor(root, agent);
    const userNames = userNamesFor(agent);
    for (const name of expected) {
      const scopes = [];
      if (projectNames.has(name)) scopes.push("project");
      if (userNames.has(name)) scopes.push("user");
      if (scopes.length > 1) console.warn(`WARN: MCP conflict: agent=${agent} name=${name} scopes=${scopes.join(",")}. Review the user-scoped entry manually; nothing was deleted.`);
    }

    const result = spawnSync(spec.command, spec.args, {
      cwd: root,
      encoding: "utf8",
      env: {...process.env, NO_COLOR: "1"},
      timeout: 15_000,
    });
    if (result.error?.code === "ENOENT") {
      console.log(`${agent}: cli=unavailable`);
      results.push({agent, status: "unavailable"});
      continue;
    }
    if (result.error) {
      console.log(`${agent}: cli=error`);
      console.log(safeOutput(result.error.message));
      results.push({agent, status: "error"});
      continue;
    }
    const status = result.status === 0 ? "ok" : `exit-${result.status}`;
    console.log(`${agent}: cli=${status}`);
    console.log(safeOutput(`${result.stdout || ""}\n${result.stderr || ""}`));
    results.push({agent, status});
  }
  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node verify-agent-runtime.mjs [--root <project-root>] [--agents grok,codex,claude,cursor]");
    return;
  }
  verifyAgentRuntime(args.root, args.agents?.split(",").map((value) => value.trim()).filter(Boolean));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(redactSensitive(error.message));
    process.exit(1);
  }
}
