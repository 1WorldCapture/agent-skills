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

const product = process.argv[2];
if (!new Set(["react", "native"]).has(product)) {
  console.error("Usage: node .agent/bin/hpmcp.mjs <react|native>");
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const fileEnv = readEnvFile(resolve(projectRoot, ".agent/.env.local"));
const token = process.env.HEROUI_PERSONAL_TOKEN || fileEnv.HEROUI_PERSONAL_TOKEN;

if (!token) {
  console.error("HEROUI_PERSONAL_TOKEN is missing. Export it or add it to .agent/.env.local (gitignored).");
  process.exit(1);
}

const executable = resolve(
  projectRoot,
  "node_modules/.bin",
  process.platform === "win32" ? "hpmcp.cmd" : "hpmcp",
);

if (!existsSync(executable)) {
  console.error("Project-local hpmcp is missing. Install hpmcp@latest as a root development dependency.");
  process.exit(1);
}

const child = spawnSync(executable, [product, token], {
  cwd: projectRoot,
  env: {...process.env, ...fileEnv, CACHE_TTL: process.env.CACHE_TTL || fileEnv.CACHE_TTL || "1800"},
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
