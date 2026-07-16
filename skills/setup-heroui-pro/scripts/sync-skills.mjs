#!/usr/bin/env node

import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const NPX_MANAGED_SKILLS = new Set(["setup-heroui-pro"]);

function parseArgs(argv) {
  const args = {root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function copySkill(source, destination) {
  rmSync(destination, {recursive: true, force: true});
  cpSync(source, destination, {
    recursive: true,
    filter: (entry) => !entry.endsWith("/.DS_Store") && !entry.endsWith("\\.DS_Store"),
  });
}

export function syncSkills(rootInput = ".") {
  const root = resolve(rootInput);
  const configPath = resolve(root, ".agent/config.json");
  if (!existsSync(configPath)) throw new Error(`Missing ${configPath}; run configure-project.mjs first.`);

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const agents = new Set(config.agents || []);
  const sourceRoot = resolve(root, ".agent/skills");
  if (!existsSync(sourceRoot)) throw new Error(`Missing canonical skills directory: ${sourceRoot}`);

  const skillNames = readdirSync(sourceRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(resolve(sourceRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .filter((skillName) => !NPX_MANAGED_SKILLS.has(skillName))
    .sort();

  const destinations = [];
  if (agents.has("codex") || agents.has("cursor")) destinations.push(resolve(root, ".agents/skills"));
  if (agents.has("claude") || agents.has("grok")) destinations.push(resolve(root, ".claude/skills"));

  for (const destinationRoot of destinations) {
    mkdirSync(destinationRoot, {recursive: true});
    for (const skillName of skillNames) {
      copySkill(resolve(sourceRoot, skillName), resolve(destinationRoot, skillName));
    }
  }

  return {agents: [...agents], destinations, root, skillNames};
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node sync-skills.mjs [--root <project-root>]");
      process.exit(0);
    }
    const result = syncSkills(args.root);
    console.log(`Synchronized ${result.skillNames.length} HeroUI skill(s): ${result.skillNames.join(", ")}`);
    for (const destination of result.destinations) console.log(`  -> ${destination}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
