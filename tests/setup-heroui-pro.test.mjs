#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = resolve(repoRoot, "skills/setup-heroui-pro");
const scripts = resolve(skillRoot, "scripts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(script, args, options = {}) {
  const result = spawnSync(process.execPath, [resolve(scripts, script), ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {...process.env, ...(options.env || {})},
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function write(path, contents, mode) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, contents, mode ? {mode} : undefined);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function digest(directory) {
  const hash = createHash("sha256");
  for (const file of walk(directory).sort()) {
    const name = relative(directory, file);
    if (name === ".agent/.env.local") continue;
    hash.update(name);
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function vendorSkills(product) {
  const skills = ["heroui-pro-design-taste"];
  if (product === "react" || product === "both") skills.push("heroui-react-pro");
  if (product === "native" || product === "both") skills.push("heroui-native-pro");
  return skills.sort();
}

for (const product of ["react", "native", "both"]) {
  const project = mkdtempSync(resolve(tmpdir(), `setup-heroui-pro-${product}-`));
  try {
    write(resolve(project, "package.json"), '{"name":"fixture","private":true}\n');
    write(resolve(project, ".mcp.json"), '{"mcpServers":{"existing":{"command":"existing"}}}\n');
    write(resolve(project, ".cursor/mcp.json"), '{"mcpServers":{"existing-cursor":{"command":"existing"}}}\n');
    write(resolve(project, ".codex/config.toml"), 'model_reasoning_effort = "high"\n');
    write(resolve(project, ".grok/config.toml"), 'theme = "system"\n');

    const npxManaged = "---\nname: setup-heroui-pro\ndescription: npx-managed test sentinel\n---\n";
    write(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), npxManaged);
    write(resolve(project, ".claude/skills/setup-heroui-pro/SKILL.md"), npxManaged);

    run("configure-project.mjs", [
      "--root", project,
      "--product", product,
      "--agents", "grok,codex,claude,cursor",
      "--persist-env",
    ], {env: {HEROUI_KEY: "unit-key", HEROUI_PERSONAL_TOKEN: "unit-token"}});

    assert(readFileSync(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), "utf8") === npxManaged, "configure overwrote npx-managed Codex/Cursor Skill");
    assert(readFileSync(resolve(project, ".claude/skills/setup-heroui-pro/SKILL.md"), "utf8") === npxManaged, "configure overwrote npx-managed Claude/Grok Skill");
    assert(existsSync(resolve(project, ".agent/skills/setup-heroui-pro/SKILL.md")), "missing .agent setup mirror");

    const mcp = JSON.parse(readFileSync(resolve(project, ".mcp.json"), "utf8"));
    assert(mcp.mcpServers.existing, "existing Claude MCP server was lost");
    const expectedServerCount = product === "both" ? 3 : 2;
    assert(Object.keys(mcp.mcpServers).length === expectedServerCount, "unexpected Claude MCP server count");

    const envLocal = resolve(project, ".agent/.env.local");
    if (process.platform !== "win32") assert((statSync(envLocal).mode & 0o077) === 0, ".env.local is not mode 0600");

    for (const skillName of vendorSkills(product)) {
      write(resolve(project, ".agent/skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: fixture\n---\n`);
    }
    const localHpmcp = resolve(project, "node_modules/.bin", process.platform === "win32" ? "hpmcp.cmd" : "hpmcp");
    write(localHpmcp, process.platform === "win32" ? "@exit /b 0\r\n" : "#!/bin/sh\nexit 0\n", 0o755);
    if (process.platform !== "win32") chmodSync(localHpmcp, 0o755);

    run("sync-skills.mjs", ["--root", project]);
    for (const skillName of vendorSkills(product)) {
      assert(existsSync(resolve(project, ".agents/skills", skillName, "SKILL.md")), `missing .agents copy for ${skillName}`);
      assert(existsSync(resolve(project, ".claude/skills", skillName, "SKILL.md")), `missing .claude copy for ${skillName}`);
    }
    assert(readFileSync(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), "utf8") === npxManaged, "sync overwrote npx-managed Skill");

    run("verify-project.mjs", ["--root", project]);
    run("install-agent-skills.mjs", ["--root", project, "--dry-run"]);

    const before = digest(project);
    run("configure-project.mjs", [
      "--root", project,
      "--product", product,
      "--agents", "grok,codex,claude,cursor",
      "--persist-env",
    ], {env: {HEROUI_KEY: "unit-key", HEROUI_PERSONAL_TOKEN: "unit-token"}});
    const after = digest(project);
    assert(before === after, `${product} configuration is not idempotent`);

    for (const configFile of [".mcp.json", ".cursor/mcp.json", ".codex/config.toml", ".grok/config.toml"]) {
      const contents = readFileSync(resolve(project, configFile), "utf8");
      assert(!contents.includes("unit-key") && !contents.includes("unit-token"), `credential leaked into ${configFile}`);
    }
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
}

console.log("setup-heroui-pro tests passed for react, native, and both.");
