import {chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {dirname, isAbsolute, relative, resolve} from "node:path";

export const CREDENTIAL_KEYS = ["HEROUI_KEY", "HEROUI_PERSONAL_TOKEN"];

export function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    let value = rawValue;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      try {
        value = JSON.parse(rawValue);
      } catch {
        value = rawValue.slice(1, -1);
      }
    } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      value = rawValue.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function credentialsFor(rootInput = ".", environment = process.env) {
  const root = resolve(rootInput);
  const fileValues = readEnvFile(resolve(root, ".agent/.env.local"));
  return Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, environment[key] ?? fileValues[key] ?? ""]));
}

export function credentialStatuses(rootInput = ".", environment = process.env) {
  const values = credentialsFor(rootInput, environment);
  return Object.fromEntries(CREDENTIAL_KEYS.map((key) => [key, String(values[key]).trim() ? "available" : "empty"]));
}

export function isInside(parentInput, childInput) {
  const parent = resolve(parentInput);
  const child = resolve(childInput);
  const pathFromParent = relative(parent, child);
  return pathFromParent === "" || (pathFromParent !== ".." && !pathFromParent.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(pathFromParent));
}

export function assertInside(parent, child, label = "Path") {
  if (!isInside(parent, child)) throw new Error(`${label} escapes the allowed root: ${child}`);
}

export function atomicWriteFile(file, contents, options = {}) {
  mkdirSync(dirname(file), {recursive: true});
  const temporary = resolve(dirname(file), `.${file.split(/[\\/]/).pop()}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temporary, contents, options);
    if (options.mode !== undefined && process.platform !== "win32") chmodSync(temporary, options.mode);
    renameSync(temporary, file);
    if (options.mode !== undefined && process.platform !== "win32") chmodSync(file, options.mode);
  } finally {
    rmSync(temporary, {force: true});
  }
}

export function serializeEnvValue(value) {
  const stringValue = String(value);
  if (/[\r\n]/.test(stringValue)) throw new Error("Credential values must not contain newlines.");
  return JSON.stringify(stringValue);
}

export function mergeEnvText(current, updates) {
  const pending = new Map(Object.entries(updates));
  const seen = new Set();
  const output = [];
  for (const line of current.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !pending.has(match[1])) {
      output.push(line);
      continue;
    }
    if (!seen.has(match[1])) output.push(`${match[1]}=${serializeEnvValue(pending.get(match[1]))}`);
    seen.add(match[1]);
  }
  for (const [key, value] of pending) if (!seen.has(key)) output.push(`${key}=${serializeEnvValue(value)}`);
  while (output.length && output.at(-1) === "") output.pop();
  return `${output.join("\n")}\n`;
}

export function redactSensitive(input) {
  return String(input)
    .replace(/(\bhpmcp(?:\.mjs)?\b)[^\r\n]*/gi, "$1 [ARGS REDACTED]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[REDACTED]")
    .replace(/\bhp_[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b(Bearer)\s+[^\s"']+/gi, "$1 [REDACTED]")
    .replace(/((?:authorization|x-heroui-personal-token)\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/((?:--)?(?:personal[-_]?token|token)\s*(?:=|\s)\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^\s)\]}>"']+/gi, "[URL REDACTED]");
}
