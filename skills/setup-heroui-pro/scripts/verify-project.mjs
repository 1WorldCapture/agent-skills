#!/usr/bin/env node

import {existsSync, readFileSync, statSync} from "node:fs";
import {resolve} from "node:path";

function parseArgs(argv) {
  const args = {root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--allow-missing-hpmcp") args.allowMissingHpmcp = true;
    else if (arg === "--allow-missing-heroui-skills") args.allowMissingSkills = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
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
    console.log("Usage: node verify-project.mjs [--root <project-root>] [--allow-missing-hpmcp] [--allow-missing-heroui-skills]");
    return;
  }

  const root = resolve(args.root);
  const errors = [];
  const warnings = [];
  const configPath = resolve(root, ".agent/config.json");
  if (!existsSync(configPath)) throw new Error("Missing .agent/config.json.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const agents = new Set(config.agents || []);

  const requiredFiles = [
    ".agent/.env.example",
    ".agent/.gitignore",
    ".agent/bin/hpmcp.mjs",
    ".agent/bin/hpsetup.mjs",
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

  const setupDiscoveryCount = discoveryRoots.filter((discoveryRoot) =>
    existsSync(resolve(discoveryRoot, "setup-heroui-pro/SKILL.md")),
  ).length;
  if (!setupDiscoveryCount) warnings.push("The npx-managed setup-heroui-pro discovery copy was not found; reinstall it with npx skills add.");

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
