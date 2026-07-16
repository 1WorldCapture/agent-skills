#!/usr/bin/env node

import {existsSync, readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const fileEnv = readEnvFile(resolve(projectRoot, ".agent/.env.local"));
const key = process.env.HEROUI_KEY || fileEnv.HEROUI_KEY;

if (!key) {
  console.error("HEROUI_KEY is missing. Export it or add it to .agent/.env.local (gitignored).");
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawnSync(npx, ["-y", "hpsetup@latest", ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: {...process.env, ...fileEnv, HEROUI_KEY: key},
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
