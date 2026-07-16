#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {basename, dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {assertInside, credentialsFor} from "./_shared.mjs";
import {syncSkills} from "./sync-skills.mjs";

const DEFAULT_BASE_URL = "https://hp-skills.932324.xyz";
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

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

function skillsFor(product) {
  const skills = ["heroui-pro-design-taste"];
  if (product === "react" || product === "both") skills.unshift("heroui-react-pro");
  if (product === "native" || product === "both") skills.unshift("heroui-native-pro");
  return skills;
}

export function validateArchiveName(name) {
  if (name === "." || name === "./") return;
  const normalized = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Archive contains an absolute or empty path: ${name}`);
  }
  if (normalized.split("/").includes("..")) throw new Error(`Archive path traversal rejected: ${name}`);
}

function inspectArchive(archive) {
  const names = spawnSync("tar", ["-tzf", archive], {encoding: "utf8"});
  if (names.error) throw new Error(`Unable to inspect tarball: ${names.error.message}`);
  if (names.status !== 0) throw new Error(`Invalid tarball: ${names.stderr.trim()}`);
  for (const name of names.stdout.split(/\r?\n/).filter(Boolean)) validateArchiveName(name);

  const verbose = spawnSync("tar", ["-tvzf", archive], {encoding: "utf8"});
  if (verbose.error) throw new Error(`Unable to inspect tarball entries: ${verbose.error.message}`);
  if (verbose.status !== 0) throw new Error(`Invalid tarball: ${verbose.stderr.trim()}`);
  for (const line of verbose.stdout.split(/\r?\n/).filter(Boolean)) {
    const type = line.trimStart()[0];
    if (type && type !== "-" && type !== "d") throw new Error(`Archive link or special entry rejected: ${line}`);
  }
}

function walkAndValidate(directory, allowedRoot) {
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in downloaded skills: ${current}`);
    assertInside(allowedRoot, realpathSync(current), "Installed path");
    if (stat.isDirectory()) for (const entry of readdirSync(current)) stack.push(resolve(current, entry));
  }
}

function locateSkillRoot(extracted, skillName) {
  if (existsSync(resolve(extracted, "SKILL.md"))) return extracted;
  const entries = readdirSync(extracted, {withFileTypes: true}).filter((entry) => entry.name !== "__MACOSX");
  const candidates = entries
    .filter((entry) => entry.isDirectory() && existsSync(resolve(extracted, entry.name, "SKILL.md")))
    .map((entry) => resolve(extracted, entry.name));
  if (candidates.length !== 1) throw new Error(`Tarball for ${skillName} must contain one skill root with SKILL.md.`);
  return candidates[0];
}

function validateSkillMetadata(skillRoot, skillName) {
  const contents = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
  const declaredName = contents.match(/^name:\s*["']?([^\n"']+)["']?\s*$/m)?.[1]?.trim();
  if (declaredName !== skillName) throw new Error(`Downloaded skill name mismatch: expected ${skillName}, found ${declaredName || "missing"}.`);
}

function replaceAtomically(source, destination) {
  const parent = dirname(destination);
  mkdirSync(parent, {recursive: true});
  const incoming = resolve(parent, `.${basename(destination)}.incoming.${process.pid}.${Date.now()}`);
  const backup = resolve(parent, `.${basename(destination)}.backup.${process.pid}.${Date.now()}`);
  rmSync(incoming, {recursive: true, force: true});
  rmSync(backup, {recursive: true, force: true});
  renameSync(source, incoming);
  let backedUp = false;
  try {
    if (existsSync(destination)) {
      renameSync(destination, backup);
      backedUp = true;
    }
    renameSync(incoming, destination);
    rmSync(backup, {recursive: true, force: true});
  } catch (error) {
    rmSync(incoming, {recursive: true, force: true});
    if (backedUp && !existsSync(destination)) renameSync(backup, destination);
    throw error;
  }
}

export async function downloadArchive(urlInput, token, fetchImplementation = fetch) {
  let url = new URL(urlInput);
  const origin = url.origin;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetchImplementation(url, {
      headers: {"x-heroui-personal-token": token},
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const next = new URL(response.headers.get("location"), url);
      if (next.origin !== origin) throw new Error("Cross-origin skill download redirect rejected.");
      url = next;
      continue;
    }
    if (!response.ok) throw new Error(`Skill download failed with HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_ARCHIVE_BYTES) throw new Error("Skill tarball exceeds the 64 MiB safety limit.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_ARCHIVE_BYTES) throw new Error("Skill tarball exceeds the 64 MiB safety limit.");
    return buffer;
  }
  throw new Error("Too many skill download redirects.");
}

export function installArchive(buffer, {agentRoot, skillName}) {
  const resolvedAgentRoot = resolve(agentRoot);
  if (existsSync(resolvedAgentRoot) && lstatSync(resolvedAgentRoot).isSymbolicLink()) {
    throw new Error(`Refusing to install through a symbolic .agent directory: ${resolvedAgentRoot}`);
  }
  mkdirSync(resolve(resolvedAgentRoot, ".tmp"), {recursive: true});
  const realAgentRoot = realpathSync(resolvedAgentRoot);
  const workspace = mkdtempSync(resolve(resolvedAgentRoot, ".tmp", `${skillName}-`));
  const archive = resolve(workspace, "skill.tar.gz");
  const extracted = resolve(workspace, "extracted");
  const destination = resolve(resolvedAgentRoot, "skills", skillName);
  assertInside(resolvedAgentRoot, destination, "Skill destination");
  try {
    writeFileSync(archive, buffer, {mode: 0o600});
    inspectArchive(archive);
    mkdirSync(extracted, {recursive: true});
    const unpack = spawnSync("tar", ["-xzf", archive, "-C", extracted, "--no-same-owner", "--no-same-permissions"], {encoding: "utf8"});
    if (unpack.error) throw new Error(`Unable to extract tarball: ${unpack.error.message}`);
    if (unpack.status !== 0) throw new Error(`Unable to extract tarball: ${unpack.stderr.trim()}`);
    const skillRoot = locateSkillRoot(extracted, skillName);
    validateSkillMetadata(skillRoot, skillName);
    walkAndValidate(skillRoot, realAgentRoot);
    replaceAtomically(skillRoot, destination);
    walkAndValidate(destination, realAgentRoot);
    return destination;
  } finally {
    rmSync(workspace, {recursive: true, force: true});
  }
}

export async function installAgentSkills(rootInput = ".", options = {}) {
  const root = resolve(rootInput);
  const agentRoot = resolve(root, ".agent");
  const configPath = resolve(agentRoot, "config.json");
  if (!existsSync(configPath)) throw new Error("Missing .agent/config.json; run configure-project.mjs first.");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const skillNames = skillsFor(config.product);
  if (options.dryRun) return {destination: resolve(agentRoot, "skills"), skillNames};

  const credentials = credentialsFor(root);
  const missing = ["HEROUI_KEY", "HEROUI_PERSONAL_TOKEN"].filter((key) => !String(credentials[key]).trim());
  if (missing.length) throw new Error(`Both HeroUI credentials are required; empty: ${missing.join(", ")}. Run check-credentials.mjs after setting them outside chat.`);
  const token = credentials.HEROUI_PERSONAL_TOKEN;
  const baseUrl = process.env.HEROUI_SKILLS_BASE_URL || DEFAULT_BASE_URL;
  for (const skillName of skillNames) {
    const url = new URL(`/skills/${encodeURIComponent(skillName)}.tar.gz`, baseUrl);
    const archive = await downloadArchive(url, token);
    installArchive(archive, {agentRoot, skillName});
  }
  const syncResult = syncSkills(root);
  return {destination: resolve(agentRoot, "skills"), skillNames: syncResult.skillNames};
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node install-agent-skills.mjs [--root <project-root>] [--dry-run]");
    return;
  }
  const result = await installAgentSkills(args.root, {dryRun: args.dryRun});
  if (args.dryRun) console.log(`Would install into ${result.destination}: ${result.skillNames.join(", ")}`);
  else console.log(`Installed atomically and synchronized: ${result.skillNames.join(", ")}`);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
