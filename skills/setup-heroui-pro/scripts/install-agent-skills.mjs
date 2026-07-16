#!/usr/bin/env node

import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {syncSkills} from "./sync-skills.mjs";

const INSTALLER_URL = "https://hp-skills.932324.xyz/install";

function parseArgs(argv) {
  const args = {root: "."};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function skillsFor(product) {
  const skills = ["heroui-pro-design-taste"];
  if (product === "react" || product === "both") skills.unshift("heroui-react-pro");
  if (product === "native" || product === "both") skills.unshift("heroui-native-pro");
  return skills;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node install-agent-skills.mjs [--root <project-root>] [--dry-run]");
    return;
  }

  const root = resolve(args.root);
  const configPath = resolve(root, ".agent/config.json");
  if (!existsSync(configPath)) throw new Error("Missing .agent/config.json; run configure-project.mjs first.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const skillNames = skillsFor(config.product);
  const destination = resolve(root, ".agent/skills");

  if (args.dryRun) {
    console.log(`Would install into ${destination}: ${skillNames.join(", ")}`);
    return;
  }

  const fileEnv = readEnvFile(resolve(root, ".agent/.env.local"));
  const token = process.env.HEROUI_PERSONAL_TOKEN || fileEnv.HEROUI_PERSONAL_TOKEN;
  if (!token) throw new Error("HEROUI_PERSONAL_TOKEN is missing. Export it or add it to .agent/.env.local (gitignored).");

  const installer = execFileSync("curl", ["-fsSL", INSTALLER_URL], {maxBuffer: 8 * 1024 * 1024});
  const childEnv = {
    ...process.env,
    ...fileEnv,
    HEROUI_PERSONAL_TOKEN: token,
    HEROUI_PRO_SKILLS_DIR: destination,
  };

  for (const skillName of skillNames) {
    const result = spawnSync("bash", ["-s", skillName], {
      cwd: root,
      env: childEnv,
      input: installer,
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`HeroUI installer failed for ${skillName} with status ${result.status}.`);
    if (!existsSync(resolve(destination, skillName, "SKILL.md"))) {
      throw new Error(`Installer completed but ${skillName}/SKILL.md was not found in ${destination}.`);
    }
  }

  const syncResult = syncSkills(root);
  console.log(`Installed and synchronized: ${syncResult.skillNames.join(", ")}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
