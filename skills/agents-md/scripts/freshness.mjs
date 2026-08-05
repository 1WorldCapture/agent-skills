#!/usr/bin/env node

/**
 * Decide whether AGENTS.md should be created, updated, or skipped.
 *
 * Usage: node freshness.mjs --root <project-root> [--force]
 * Prints one JSON object to stdout.
 */

import {existsSync, statSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  let root = process.cwd();
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root" && argv[i + 1]) {
      root = argv[++i];
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--help" || arg === "-h") {
      console.error("Usage: node freshness.mjs --root <project-root> [--force]");
      process.exit(0);
    }
  }
  return {root: resolve(root), force};
}

function gitLastCommitMs(root, relativePath) {
  const result = spawnSync(
    "git",
    ["log", "-1", "--format=%ct", "--", relativePath],
    {cwd: root, encoding: "utf8"},
  );
  if (result.status !== 0) return null;
  const seconds = Number.parseInt(String(result.stdout).trim(), 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1000;
}

function mtimeMs(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function ageDaysFrom(ms) {
  if (ms == null) return null;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

function main() {
  const {root, force} = parseArgs(process.argv.slice(2));
  const relativePath = "AGENTS.md";
  const path = resolve(root, relativePath);

  if (!existsSync(path)) {
    console.log(
      JSON.stringify({
        action: "create",
        path,
        ageDays: null,
        source: "none",
        forceHint: force,
      }),
    );
    return;
  }

  const gitMs = gitLastCommitMs(root, relativePath);
  const source = gitMs != null ? "git" : "mtime";
  const stampMs = gitMs ?? mtimeMs(path);
  const ageDays = ageDaysFrom(stampMs);
  const stale = stampMs == null || Date.now() - stampMs > WEEK_MS;

  let action = stale ? "update" : "skip";
  if (force && action === "skip") action = "update";

  console.log(
    JSON.stringify({
      action,
      path,
      ageDays,
      source,
      forceHint: force,
    }),
  );
}

main();
