#!/usr/bin/env node

import {existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {credentialsFor, readEnvFile} from "./_shared.mjs";

const product = process.argv[2];
if (!new Set(["react", "native"]).has(product)) {
  console.error("Usage: node .agent/bin/hpmcp.mjs <react|native>");
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const fileEnv = readEnvFile(resolve(projectRoot, ".agent/.env.local"));
const credentials = credentialsFor(projectRoot);
const token = credentials.HEROUI_PERSONAL_TOKEN;

if (!String(credentials.HEROUI_KEY).trim() || !String(token).trim()) {
  console.error("Both HEROUI_KEY and HEROUI_PERSONAL_TOKEN must be non-empty. Run check-credentials.mjs after setting them outside chat.");
  process.exit(1);
}

const executable = resolve(
  projectRoot,
  "node_modules/.bin",
  process.platform === "win32" ? "hpmcp.cmd" : "hpmcp",
);

if (!existsSync(executable)) {
  console.error("Project-local hpmcp is missing. Use setup.mjs to resolve and install the current stable version as a root development dependency.");
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
