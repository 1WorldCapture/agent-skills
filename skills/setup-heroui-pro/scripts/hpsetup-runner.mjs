#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {credentialsFor} from "./_shared.mjs";
import {resolveNpmChannelVersion} from "./_npm-channel.mjs";

function parseArgs(argv) {
  const forwarded = [];
  let channel = "stable";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--channel") channel = argv[++index];
    else forwarded.push(argv[index]);
  }
  return {channel, forwarded};
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const {channel, forwarded} = parseArgs(process.argv.slice(2));
const credentials = credentialsFor(projectRoot);
const key = credentials.HEROUI_KEY;

if (!String(key).trim() || !String(credentials.HEROUI_PERSONAL_TOKEN).trim()) {
  console.error("Both HEROUI_KEY and HEROUI_PERSONAL_TOKEN must be non-empty. Run check-credentials.mjs after setting them outside chat.");
  process.exit(1);
}

let version;
try {
  version = resolveNpmChannelVersion("hpsetup", channel);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawnSync(npx, ["-y", `hpsetup@${version}`, ...forwarded], {
  cwd: projectRoot,
  env: {...process.env, HEROUI_KEY: key},
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
