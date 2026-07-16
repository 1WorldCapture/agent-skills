#!/usr/bin/env node

import {createHash} from "node:crypto";
import {existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync} from "node:fs";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {assertInside, credentialStatuses} from "./_shared.mjs";

function parseArgs(argv) {
  const args = {root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--allow-missing-hpmcp") args.allowMissingHpmcp = true;
    else if (arg === "--allow-missing-heroui-skills") args.allowMissingSkills = true;
    else if (arg === "--allow-missing-credentials") args.allowMissingCredentials = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function digestDirectory(directory) {
  const hash = createHash("sha256");
  const walk = (current) => {
    for (const entry of readdirSync(current, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".DS_Store") continue;
      const path = resolve(current, entry.name);
      const name = relative(directory, path);
      hash.update(name);
      if (entry.isDirectory()) walk(path);
      else hash.update(readFileSync(path));
    }
  };
  walk(directory);
  return hash.digest("hex");
}

function expectedHeroUiSkills(product) {
  const skills = ["heroui-pro-design-taste"];
  if (product === "react" || product === "both") skills.push("heroui-react-pro");
  if (product === "native" || product === "both") skills.push("heroui-native-pro");
  return skills.sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node verify-project.mjs [--root <project-root>] [--allow-missing-hpmcp] [--allow-missing-heroui-skills] [--allow-missing-credentials]");
    return;
  }

  const root = resolve(args.root);
  const errors = [];
  const warnings = [];
  const configPath = resolve(root, ".agent/config.json");
  if (!existsSync(configPath)) throw new Error("Missing .agent/config.json.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const agents = new Set(config.agents || []);
  if (!new Set(["stable", "beta"]).has(config.channel)) errors.push(".agent/config.json must declare channel=stable or beta.");

  const agentRoot = resolve(root, ".agent");
  if (lstatSync(agentRoot).isSymbolicLink()) errors.push(".agent must be a real project directory, not a symbolic link.");
  else assertInside(realpathSync(root), realpathSync(agentRoot), ".agent real path");

  const requiredFiles = [
    ".agent/.env.example",
    ".agent/.gitignore",
    ".agent/bin/hpmcp.mjs",
    ".agent/bin/hpsetup.mjs",
    ".agent/bin/_shared.mjs",
    ".agent/bin/_npm-channel.mjs",
  ];
  if (agents.has("codex")) requiredFiles.push(".codex/config.toml");
  if (agents.has("grok")) requiredFiles.push(".grok/config.toml");
  if (agents.has("claude")) requiredFiles.push(".mcp.json");
  if (agents.has("cursor")) requiredFiles.push(".cursor/mcp.json");
  for (const file of requiredFiles) if (!existsSync(resolve(root, file))) errors.push(`Missing ${file}`);

  const expected = expectedHeroUiSkills(config.product);
  const canonicalSkills = ["setup-heroui-pro", ...expected];
  for (const skillName of canonicalSkills) {
    const skillFile = resolve(root, ".agent/skills", skillName, "SKILL.md");
    if (!existsSync(skillFile)) {
      const isHeroUiSkill = skillName !== "setup-heroui-pro";
      if (isHeroUiSkill && args.allowMissingSkills) warnings.push(`Missing ${skillFile}`);
      else errors.push(`Missing ${skillFile}`);
    }
  }

  const discoveryRoots = [];
  if (agents.has("codex") || agents.has("cursor")) discoveryRoots.push(resolve(root, ".agents/skills"));
  if (agents.has("claude") || agents.has("grok")) discoveryRoots.push(resolve(root, ".claude/skills"));
  for (const discoveryRoot of discoveryRoots) {
    for (const skillName of expected) {
      const skillFile = resolve(discoveryRoot, skillName, "SKILL.md");
      if (!existsSync(skillFile)) {
        if (args.allowMissingSkills) warnings.push(`Missing ${skillFile}`);
        else errors.push(`Missing ${skillFile}`);
      }
    }
  }

  const lockPath = resolve(root, "skills-lock.json");
  if (!existsSync(lockPath)) {
    errors.push("Missing skills-lock.json; install setup-heroui-pro with npx skills add before configure-project.mjs.");
  } else {
    try {
      const lockEntry = JSON.parse(readFileSync(lockPath, "utf8")).skills?.["setup-heroui-pro"];
      if (!lockEntry || lockEntry.sourceType !== "github" || !String(lockEntry.source || "").includes("1WorldCapture/agent-skills")) {
        errors.push("skills-lock.json does not record setup-heroui-pro from 1WorldCapture/agent-skills.");
      }
    } catch (error) {
      errors.push(`Invalid skills-lock.json: ${error.message}`);
    }
  }

  const currentSkillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const currentSkillFile = resolve(currentSkillRoot, "SKILL.md");
  const mirrorRoot = resolve(root, ".agent/skills/setup-heroui-pro");
  if (existsSync(mirrorRoot) && digestDirectory(mirrorRoot) !== digestDirectory(currentSkillRoot)) {
    errors.push(".agent setup Skill mirror does not match the currently invoked setup-heroui-pro version.");
  }
  for (const discoveryRoot of discoveryRoots) {
    const discoveryFile = resolve(discoveryRoot, "setup-heroui-pro/SKILL.md");
    if (!existsSync(discoveryFile)) errors.push(`Missing npx-managed discovery copy: ${relative(root, discoveryFile)}`);
    else if (readFileSync(discoveryFile, "utf8") !== readFileSync(currentSkillFile, "utf8")) {
      errors.push(`Stale npx-managed discovery copy: ${relative(root, discoveryFile)}`);
    }
  }

  const hpmcp = resolve(root, "node_modules/.bin", process.platform === "win32" ? "hpmcp.cmd" : "hpmcp");
  if (!existsSync(hpmcp)) {
    const message = "Missing project-local node_modules/.bin/hpmcp";
    if (args.allowMissingHpmcp) warnings.push(message);
    else errors.push(message);
  }

  const generatedConfigs = [".agent/config.json", ".codex/config.toml", ".grok/config.toml", ".mcp.json", ".cursor/mcp.json"];
  const secretPatterns = [
    /hp_[A-Za-z0-9_-]{20,}/,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  ];
  for (const file of generatedConfigs) {
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    const contents = readFileSync(absolute, "utf8");
    if (secretPatterns.some((pattern) => pattern.test(contents))) errors.push(`Possible credential embedded in ${file}`);
  }

  const envLocal = resolve(root, ".agent/.env.local");
  if (existsSync(envLocal) && process.platform !== "win32") {
    const permissions = statSync(envLocal).mode & 0o777;
    if ((permissions & 0o077) !== 0) errors.push(".agent/.env.local must not be readable by group or others (use mode 0600).");
  }

  const credentials = credentialStatuses(root);
  const emptyCredentials = Object.entries(credentials).filter(([, status]) => status !== "available").map(([key]) => key);
  if (emptyCredentials.length) {
    const message = `Empty credentials: ${emptyCredentials.join(", ")}`;
    if (args.allowMissingCredentials) warnings.push(message);
    else errors.push(message);
  }

  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  for (const error of errors) console.error(`ERROR: ${error}`);
  if (errors.length) process.exit(1);
  console.log(`Verified ${config.product} setup for ${[...agents].join(", ")}.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
