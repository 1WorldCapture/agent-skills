#!/usr/bin/env node

import {spawn, spawnSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {redactSensitive} from "./_shared.mjs";

function parseArgs(argv) {
  const args = {root: ".", timeout: 45_000};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index];
    else if (arg === "--expect") args.expect = argv[++index];
    else if (arg === "--timeout") args.timeout = Number(argv[++index]) * 1000;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function packageManager(root) {
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const declared = String(packageJson.packageManager || "").split("@")[0];
  if (new Set(["pnpm", "npm", "yarn", "bun"]).has(declared)) return declared;
  if (existsSync(resolve(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(root, "bun.lock")) || existsSync(resolve(root, "bun.lockb"))) return "bun";
  if (existsSync(resolve(root, "yarn.lock"))) return "yarn";
  return "npm";
}

function executable(manager) {
  return process.platform === "win32" ? `${manager}.cmd` : manager;
}

function scriptArgs(manager, name, extra = []) {
  if (manager === "yarn") return ["run", name, ...extra];
  return ["run", name, ...extra];
}

function gitStatus(root) {
  const result = spawnSync("git", ["status", "--porcelain=v1", "-uall"], {cwd: root, encoding: "utf8"});
  if (result.status !== 0) throw new Error("verify-app requires a Git work tree so it can prove validation is read-only.");
  return result.stdout;
}

function runScript(root, manager, name) {
  console.log(`verify-app: ${name}`);
  const result = spawnSync(executable(manager), scriptArgs(manager, name), {cwd: root, stdio: "inherit"});
  if (result.error) throw new Error(`${name} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${name} failed with status ${result.status}.`);
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {stdio: "ignore"});
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // The preview already exited.
    }
  }
}

async function verifyPreview(root, manager, scripts, expected, timeout) {
  const name = scripts.start ? "start" : scripts.preview ? "preview" : null;
  if (!name) throw new Error("package.json must define a start or preview script for HTTP verification.");
  const port = 41_000 + Math.floor(Math.random() * 8_000);
  const extra = name === "preview" ? ["--", "--host", "127.0.0.1", "--port", String(port)] : [];
  const child = spawn(executable(manager), scriptArgs(manager, name, extra), {
    cwd: root,
    detached: process.platform !== "win32",
    env: {...process.env, HOST: "127.0.0.1", PORT: String(port), NO_COLOR: "1"},
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + timeout;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Preview exited before verification.\n${redactSensitive(output.slice(-4000))}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        const body = await response.text();
        if (response.status !== 200) throw new Error(`Preview returned HTTP ${response.status}.`);
        if (expected && !body.includes(expected)) throw new Error(`Preview is missing expected content: ${expected}`);
        console.log(`verify-app: preview HTTP 200${expected ? " with representative content" : ""}`);
        return;
      } catch (error) {
        if (error.message.startsWith("Preview returned") || error.message.startsWith("Preview is missing")) throw error;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    }
    throw new Error(`Preview did not become ready within ${Math.round(timeout / 1000)} seconds.\n${redactSensitive(output.slice(-4000))}`);
  } finally {
    stopProcess(child);
  }
}

export async function verifyApp(rootInput = ".", options = {}) {
  const root = resolve(rootInput);
  const packageFile = resolve(root, "package.json");
  if (!existsSync(packageFile)) throw new Error("Missing package.json.");
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  const scripts = packageJson.scripts || {};
  for (const name of ["lint", "typecheck", "test", "build"]) {
    if (!scripts[name]) throw new Error(`package.json must define a ${name} script.`);
  }
  if (/(?:^|\s)--fix(?:\s|$)|eslint\s+--fix/.test(scripts.lint)) throw new Error("The lint script is mutating; move --fix to lint:fix and keep lint read-only.");
  if (!/--noEmit\b/.test(scripts.typecheck)) throw new Error("The typecheck script must run TypeScript with --noEmit.");
  if (/--watch\b|\bwatch\b/.test(scripts.test)) throw new Error("The test script must be non-interactive and must not use watch mode.");

  const before = gitStatus(root);
  const manager = packageManager(root);
  let validationError;
  try {
    for (const name of ["lint", "typecheck", "test", "build"]) runScript(root, manager, name);
    await verifyPreview(root, manager, scripts, options.expect, options.timeout || 45_000);
  } catch (error) {
    validationError = error;
  }
  const after = gitStatus(root);
  if (after !== before) {
    const suffix = validationError ? ` The validation also failed: ${validationError.message}` : "";
    throw new Error(`Validation modified the Git work tree; inspect the diff and make all verification commands read-only.${suffix}`);
  }
  if (validationError) throw validationError;
  console.log("verify-app: all checks passed and the Git work tree is unchanged.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node verify-app.mjs [--root <project-root>] [--expect <text>] [--timeout <seconds>]");
    return;
  }
  await verifyApp(args.root, {expect: args.expect, timeout: args.timeout});
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    await main();
  } catch (error) {
    console.error(redactSensitive(error.message));
    process.exit(1);
  }
}
