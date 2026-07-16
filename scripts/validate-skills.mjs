#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, extname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(repoRoot, "skills");
const errors = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && new Set([".git", ".tmp", "node_modules"]).has(entry.name)) continue;
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function parseFrontmatter(file) {
  const contents = readFileSync(file, "utf8");
  if (!contents.startsWith("---\n")) return {contents, description: null, name: null};
  const end = contents.indexOf("\n---\n", 4);
  if (end === -1) return {contents, description: null, name: null};
  const frontmatter = contents.slice(4, end);
  const name = frontmatter.match(/^name:\s*["']?([^\n"']+)["']?\s*$/m)?.[1]?.trim() || null;
  const descriptionLine = frontmatter.match(/^description:\s*(.*)$/m)?.[1]?.trim();
  const hasDescription = Boolean(descriptionLine || /^description:\s*[>|]\s*$/m.test(frontmatter));
  return {contents, description: hasDescription ? descriptionLine || "multiline" : null, name};
}

if (!existsSync(skillsRoot)) errors.push("Missing skills/ directory.");

const skillDirectories = existsSync(skillsRoot)
  ? readdirSync(skillsRoot, {withFileTypes: true}).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : [];

for (const skillName of skillDirectories) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) errors.push(`Invalid skill directory name: ${skillName}`);
  const skillRoot = resolve(skillsRoot, skillName);
  const skillFile = resolve(skillRoot, "SKILL.md");
  if (!existsSync(skillFile)) {
    errors.push(`Missing ${skillName}/SKILL.md`);
    continue;
  }

  const metadata = parseFrontmatter(skillFile);
  if (metadata.name !== skillName) errors.push(`${skillName}: frontmatter name must equal directory name (found ${metadata.name || "missing"}).`);
  if (!metadata.description) errors.push(`${skillName}: missing frontmatter description.`);

  for (const forbidden of ["README.md", "CHANGELOG.md", "INSTALLATION_GUIDE.md", "QUICK_REFERENCE.md"]) {
    if (existsSync(resolve(skillRoot, forbidden))) errors.push(`${skillName}: move ${forbidden} to repository root.`);
  }

  for (const file of walk(skillRoot).filter((path) => extname(path) === ".mjs")) {
    const result = spawnSync(process.execPath, ["--check", file], {encoding: "utf8"});
    if (result.status !== 0) errors.push(`${skillName}: syntax error in ${file}: ${result.stderr.trim()}`);
  }
}

const secretPatterns = [
  {label: "HP key", pattern: /hp_[A-Za-z0-9_-]{20,}/},
  {label: "UUID-like token", pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i},
];

for (const file of walk(repoRoot)) {
  if (statSync(file).size > 2 * 1024 * 1024) continue;
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const {label, pattern} of secretPatterns) {
    if (pattern.test(contents)) errors.push(`${label} pattern found in ${file}`);
  }
}

if (!skillDirectories.length) errors.push("No skills discovered.");

for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log(`Validated ${skillDirectories.length} skill(s): ${skillDirectories.join(", ")}`);
