#!/usr/bin/env node

import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {CREDENTIAL_KEYS, credentialStatuses} from "./_shared.mjs";

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

export function checkCredentials(root = ".", environment = process.env) {
  const statuses = credentialStatuses(root, environment);
  return {complete: CREDENTIAL_KEYS.every((key) => statuses[key] === "available"), statuses};
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node check-credentials.mjs [--root <project-root>]");
    return;
  }
  const result = checkCredentials(args.root);
  for (const key of CREDENTIAL_KEYS) console.log(`${key}=${result.statuses[key]}`);
  if (!result.complete) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
