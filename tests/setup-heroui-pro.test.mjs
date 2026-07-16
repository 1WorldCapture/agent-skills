#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {delimiter, dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {redactSensitive} from "../skills/setup-heroui-pro/scripts/_shared.mjs";
import {downloadArchive, installArchive, validateArchiveName} from "../skills/setup-heroui-pro/scripts/install-agent-skills.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = resolve(repoRoot, "skills/setup-heroui-pro");
const scripts = resolve(skillRoot, "scripts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runRaw(script, args, options = {}) {
  return spawnSync(process.execPath, [resolve(scripts, script), ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {...process.env, ...(options.env || {})},
  });
}

function run(script, args, options = {}) {
  const result = runRaw(script, args, options);
  if (result.status !== 0) throw new Error(`${script} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result;
}

function write(path, contents, mode) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, contents, mode ? {mode} : undefined);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function digest(directory) {
  const hash = createHash("sha256");
  for (const file of walk(directory).sort()) {
    const name = relative(directory, file);
    if (name === ".agent/.env.local") continue;
    hash.update(name);
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function vendorSkills(product) {
  const skills = ["heroui-pro-design-taste"];
  if (product === "react" || product === "both") skills.push("heroui-react-pro");
  if (product === "native" || product === "both") skills.push("heroui-native-pro");
  return skills.sort();
}

const currentSkill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");

for (const product of ["react", "native", "both"]) {
  const project = mkdtempSync(resolve(tmpdir(), `setup-heroui-pro-${product}-`));
  try {
    write(resolve(project, "package.json"), '{"name":"fixture","private":true}\n');
    write(resolve(project, ".mcp.json"), '{"mcpServers":{"existing":{"command":"existing"}}}\n');
    write(resolve(project, ".cursor/mcp.json"), '{"mcpServers":{"existing-cursor":{"command":"existing"}}}\n');
    write(resolve(project, ".codex/config.toml"), 'model_reasoning_effort = "high"\n');
    write(resolve(project, ".grok/config.toml"), 'theme = "system"\n');
    write(resolve(project, ".agent/.env.local"), "UNRELATED=kept\n");
    write(resolve(project, ".agent/.gitignore"), "custom-cache/\n");
    write(resolve(project, "skills-lock.json"), `${JSON.stringify({version: 1, skills: {"setup-heroui-pro": {source: "1WorldCapture/agent-skills", sourceType: "github", skillPath: "skills/setup-heroui-pro/SKILL.md", computedHash: "fixture"}}}, null, 2)}\n`);
    write(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), currentSkill);
    write(resolve(project, ".claude/skills/setup-heroui-pro/SKILL.md"), currentSkill);

    run("configure-project.mjs", [
      "--root", project,
      "--product", product,
      "--agents", "grok,codex,claude,cursor",
      "--channel", "stable",
      "--persist-env",
    ], {env: {HEROUI_KEY: "unit-key", HEROUI_PERSONAL_TOKEN: "unit-token"}});

    assert(readFileSync(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), "utf8") === currentSkill, "configure overwrote npx-managed Codex/Cursor Skill");
    assert(readFileSync(resolve(project, ".claude/skills/setup-heroui-pro/SKILL.md"), "utf8") === currentSkill, "configure overwrote npx-managed Claude/Grok Skill");
    assert(existsSync(resolve(project, ".agent/skills/setup-heroui-pro/SKILL.md")), "missing .agent setup mirror");
    assert(existsSync(resolve(project, ".agent/bin/_shared.mjs")), "missing shared runner module");
    assert(existsSync(resolve(project, ".agent/bin/_npm-channel.mjs")), "missing npm channel runner module");
    assert(readFileSync(resolve(project, ".agent/.gitignore"), "utf8").includes("setup-state.json"), "setup state is not gitignored");
    assert(readFileSync(resolve(project, ".agent/.gitignore"), "utf8").includes("custom-cache/"), "configure removed an unrelated .agent ignore rule");

    const mcp = JSON.parse(readFileSync(resolve(project, ".mcp.json"), "utf8"));
    assert(mcp.mcpServers.existing, "existing Claude MCP server was lost");
    const expectedServerCount = product === "both" ? 3 : 2;
    assert(Object.keys(mcp.mcpServers).length === expectedServerCount, "unexpected Claude MCP server count");

    const envLocal = resolve(project, ".agent/.env.local");
    const envContents = readFileSync(envLocal, "utf8");
    assert(envContents.includes("UNRELATED=kept"), "persist-env removed an unrelated variable");
    assert(envContents.includes("HEROUI_KEY=") && envContents.includes("HEROUI_PERSONAL_TOKEN="), "persist-env omitted a credential");
    if (process.platform !== "win32") assert((statSync(envLocal).mode & 0o077) === 0, ".env.local is not mode 0600");

    for (const skillName of vendorSkills(product)) {
      write(resolve(project, ".agent/skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: fixture\n---\n`);
    }
    const localHpmcp = resolve(project, "node_modules/.bin", process.platform === "win32" ? "hpmcp.cmd" : "hpmcp");
    write(localHpmcp, process.platform === "win32" ? "@exit /b 0\r\n" : "#!/bin/sh\nexit 0\n", 0o755);
    if (process.platform !== "win32") chmodSync(localHpmcp, 0o755);

    run("sync-skills.mjs", ["--root", project]);
    for (const skillName of vendorSkills(product)) {
      assert(existsSync(resolve(project, ".agents/skills", skillName, "SKILL.md")), `missing .agents copy for ${skillName}`);
      assert(existsSync(resolve(project, ".claude/skills", skillName, "SKILL.md")), `missing .claude copy for ${skillName}`);
    }
    run("verify-project.mjs", ["--root", project]);
    run("install-agent-skills.mjs", ["--root", project, "--dry-run"]);
    const credentials = run("check-credentials.mjs", ["--root", project]);
    assert(credentials.stdout === "HEROUI_KEY=available\nHEROUI_PERSONAL_TOKEN=available\n", "credential check disclosed or misreported values");

    const before = digest(project);
    run("configure-project.mjs", [
      "--root", project,
      "--product", product,
      "--agents", "grok,codex,claude,cursor",
      "--channel", "stable",
      "--persist-env",
    ], {env: {HEROUI_KEY: "unit-key", HEROUI_PERSONAL_TOKEN: "unit-token"}});
    const after = digest(project);
    assert(before === after, `${product} configuration is not idempotent`);

    for (const configFile of [".mcp.json", ".cursor/mcp.json", ".codex/config.toml", ".grok/config.toml"]) {
      const contents = readFileSync(resolve(project, configFile), "utf8");
      assert(!contents.includes("unit-key") && !contents.includes("unit-token"), `credential leaked into ${configFile}`);
    }
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
}

{
  const project = mkdtempSync(resolve(tmpdir(), "setup-heroui-pro-empty-"));
  try {
    write(resolve(project, ".agent/.env.local"), "UNRELATED=keep\nHEROUI_KEY=old\n");
    write(resolve(project, "skills-lock.json"), `${JSON.stringify({version: 1, skills: {"setup-heroui-pro": {source: "1WorldCapture/agent-skills", sourceType: "github"}}})}\n`);
    write(resolve(project, ".agents/skills/setup-heroui-pro/SKILL.md"), currentSkill);
    write(resolve(project, ".claude/skills/setup-heroui-pro/SKILL.md"), currentSkill);
    const result = runRaw("configure-project.mjs", ["--root", project, "--product", "react", "--persist-env"], {
      env: {HEROUI_KEY: "new-key", HEROUI_PERSONAL_TOKEN: ""},
    });
    assert(result.status !== 0, "persist-env accepted an empty credential");
    assert(readFileSync(resolve(project, ".agent/.env.local"), "utf8").includes("HEROUI_KEY=old"), "failed persist-env modified the existing file");
    const check = runRaw("check-credentials.mjs", ["--root", project], {env: {HEROUI_KEY: "", HEROUI_PERSONAL_TOKEN: ""}});
    assert(check.status !== 0, "credential preflight accepted empty values");
    assert(check.stdout === "HEROUI_KEY=empty\nHEROUI_PERSONAL_TOKEN=empty\n", "empty credential output is not minimal");
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
}

{
  const workspace = mkdtempSync(resolve(tmpdir(), "setup-heroui-pro-archive-"));
  try {
    const source = resolve(workspace, "source");
    const archive = resolve(workspace, "skill.tar.gz");
    const agentRoot = resolve(workspace, "project/.agent");
    write(resolve(source, "SKILL.md"), "---\nname: heroui-react-pro\ndescription: archive fixture\n---\n");
    write(resolve(source, "references/example.md"), "safe\n");
    const tar = spawnSync("tar", ["-czf", archive, "-C", source, "."], {encoding: "utf8"});
    assert(tar.status === 0, `could not create fixture archive: ${tar.stderr}`);
    const destination = installArchive(readFileSync(archive), {agentRoot, skillName: "heroui-react-pro"});
    assert(existsSync(resolve(destination, "SKILL.md")), "atomic archive install failed");
    assert(relative(agentRoot, destination) === "skills/heroui-react-pro", "archive escaped .agent");
    let rejected = false;
    try { validateArchiveName("../outside"); } catch { rejected = true; }
    assert(rejected, "archive traversal was not rejected");

    const unsafeSource = resolve(workspace, "unsafe-source");
    const unsafeArchive = resolve(workspace, "unsafe.tar.gz");
    write(resolve(unsafeSource, "SKILL.md"), "---\nname: heroui-native-pro\ndescription: unsafe fixture\n---\n");
    symlinkSync("SKILL.md", resolve(unsafeSource, "linked.md"));
    const unsafeTar = spawnSync("tar", ["-czf", unsafeArchive, "-C", unsafeSource, "."], {encoding: "utf8"});
    assert(unsafeTar.status === 0, `could not create unsafe fixture archive: ${unsafeTar.stderr}`);
    rejected = false;
    try { installArchive(readFileSync(unsafeArchive), {agentRoot, skillName: "heroui-native-pro"}); } catch { rejected = true; }
    assert(rejected, "archive symbolic link was not rejected");
  } finally {
    rmSync(workspace, {recursive: true, force: true});
  }
}

{
  let observedHeader;
  const payload = Buffer.from("fixture");
  const downloaded = await downloadArchive("https://example.test/skill.tar.gz", "header-secret", async (_url, options) => {
    observedHeader = options.headers["x-heroui-personal-token"];
    return new Response(payload, {status: 200, headers: {"content-length": String(payload.length)}});
  });
  assert(observedHeader === "header-secret", "personal token was not sent in the HTTP header");
  assert(downloaded.equals(payload), "downloaded payload changed");
}

{
  const uuid = ["deadbeef", "dead", "beef", "cafe", "deadbeefcafe"].join("-");
  const hpToken = `hp_${"a".repeat(24)}`;
  const raw = `Authorization: Bearer ${uuid}\n--token ${hpToken}\nhpmcp react positional-secret\nhttps://secret.example.test/path`;
  const redacted = redactSensitive(raw);
  assert(!redacted.includes(uuid) && !redacted.includes(hpToken) && !redacted.includes("positional-secret") && !redacted.includes("secret.example"), "runtime redaction leaked sensitive output");
}

{
  const project = mkdtempSync(resolve(tmpdir(), "setup-heroui-pro-runtime-"));
  try {
    const fakeHome = resolve(project, "home");
    const fakeBin = resolve(project, "bin");
    const uuid = ["deadbeef", "dead", "beef", "cafe", "deadbeefcafe"].join("-");
    const hpToken = `hp_${"b".repeat(24)}`;
    write(resolve(project, ".agent/config.json"), '{"product":"react","channel":"stable","agents":["claude"]}\n');
    write(resolve(project, ".mcp.json"), '{"mcpServers":{"heroui-pro":{"command":"node"}}}\n');
    write(resolve(fakeHome, ".claude.json"), '{"mcpServers":{"heroui-pro":{"command":"legacy"}}}\n');
    const cli = resolve(fakeBin, process.platform === "win32" ? "claude.cmd" : "claude");
    write(cli, process.platform === "win32"
      ? `@echo Authorization: Bearer ${uuid} --token ${hpToken} https://secret.example.test\r\n`
      : `#!/bin/sh\nprintf '%s\\n' 'Authorization: Bearer ${uuid} --token ${hpToken} https://secret.example.test'\n`, 0o755);
    if (process.platform !== "win32") chmodSync(cli, 0o755);
    const result = run("verify-agent-runtime.mjs", ["--root", project, "--agents", "claude"], {
      env: {HOME: fakeHome, PATH: `${fakeBin}${delimiter}${process.env.PATH}`},
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert(output.includes("scopes=project,user"), "runtime verifier missed a user/project conflict");
    assert(!output.includes(uuid) && !output.includes(hpToken) && !output.includes("secret.example"), "runtime verifier leaked captured output");
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
}

{
  const project = mkdtempSync(resolve(tmpdir(), "setup-heroui-pro-verify-app-"));
  try {
    write(resolve(project, "package.json"), `${JSON.stringify({scripts: {lint: "eslint . --fix", typecheck: "tsc --noEmit", test: "vitest run", build: "next build", start: "next start"}})}\n`);
    const result = runRaw("verify-app.mjs", ["--root", project]);
    assert(result.status !== 0 && result.stderr.includes("lint script is mutating"), "verify-app accepted a mutating lint script");
  } finally {
    rmSync(project, {recursive: true, force: true});
  }
}

run("setup.mjs", ["--help"]);

console.log("setup-heroui-pro tests passed for safe install, credentials, runtime redaction, and react/native/both configuration.");
