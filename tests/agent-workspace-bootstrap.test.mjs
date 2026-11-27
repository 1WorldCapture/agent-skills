#!/usr/bin/env node

import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(repoRoot, "skills/agent-workspace-bootstrap/scripts/bootstrap.py");

function runBootstrap(cwd, args) {
  const result = spawnSync("python3", [script, "--root", ".", "--json", ...args], {
    cwd,
    encoding: "utf8",
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON output (exit ${result.status}): ${result.stdout}\n${result.stderr}`, {
      cause: error,
    });
  }
  return {status: result.status, payload, stderr: result.stderr};
}

function withTempProject(fn) {
  const rawDir = mkdtempSync(join(tmpdir(), "awb-test-"));
  const dir = realpathSync(rawDir);
  try {
    fn(dir);
  } finally {
    rmSync(rawDir, {recursive: true, force: true});
  }
}

// 1. Portable baseline: bootstrap, validate, status, idempotent re-run
withTempProject((dir) => {
  const boot = runBootstrap(dir, ["--mode", "bootstrap", "--name", "Demo Agent", "--mission", "Ship cleanly"]);
  assert.equal(boot.status, 0);
  assert.equal(boot.payload.errors.length, 0);
  assert.ok(existsSync(join(dir, "AGENTS.md")));
  assert.ok(existsSync(join(dir, "FILESYSTEM.md")));
  assert.ok(existsSync(join(dir, ".agents/bootstrap-state.yaml")));
  assert.ok(!existsSync(join(dir, ".cursor")));
  assert.ok(!existsSync(join(dir, ".zcode")));

  const state = readFileSync(join(dir, ".agents/bootstrap-state.yaml"), "utf8");
  assert.match(state, /^schema: agent-workspace-bootstrap\/v2$/m);
  assert.match(state, /^harnesses:\n  - 'portable'$/m);

  const val = runBootstrap(dir, ["--mode", "validate"]);
  assert.equal(val.status, 0);
  assert.equal(val.payload.errors.length, 0);

  const st = runBootstrap(dir, ["--mode", "status"]);
  assert.equal(st.status, 0);
  assert.ok(st.payload.skipped.includes("bootstrap state present"));
  assert.ok(!st.payload.warnings.includes("bootstrap state present"));

  const rerun = runBootstrap(dir, ["--mode", "bootstrap"]);
  assert.equal(rerun.status, 0);
  assert.equal(rerun.payload.created.length, 0);
  assert.equal(rerun.payload.conflicts.length, 0);
});

// 2. Cursor adapter creation, validation, status, and user conflict preservation
withTempProject((dir) => {
  const boot = runBootstrap(dir, ["--mode", "bootstrap", "--harness", "cursor"]);
  assert.equal(boot.status, 0);
  assert.equal(boot.payload.errors.length, 0);
  assert.ok(existsSync(join(dir, ".cursor/rules/agent-workspace.mdc")));
  assert.ok(existsSync(join(dir, ".cursor/skills/README.md")));

  const mdc = readFileSync(join(dir, ".cursor/rules/agent-workspace.mdc"), "utf8");
  assert.ok(mdc.startsWith("---\n"));
  assert.match(mdc, /alwaysApply:\s*true/);
  assert.match(mdc, /AGENTS\.md/);

  const state = readFileSync(join(dir, ".agents/bootstrap-state.yaml"), "utf8");
  assert.match(state, /^harnesses:\n  - 'cursor'$/m);

  const st = runBootstrap(dir, ["--mode", "status"]);
  assert.equal(st.status, 0);
  assert.ok(st.payload.skipped.includes("Cursor adapter present"));

  writeFileSync(join(dir, ".cursor/rules/agent-workspace.mdc"), "# Custom rule without frontmatter\n", "utf8");
  const repair = runBootstrap(dir, ["--mode", "repair", "--harness", "cursor"]);
  assert.equal(repair.status, 0);
  assert.ok(repair.payload.conflicts.some((c) => c.includes(".cursor/rules/agent-workspace.mdc")));
  assert.equal(
    readFileSync(join(dir, ".cursor/rules/agent-workspace.mdc"), "utf8"),
    "# Custom rule without frontmatter\n",
  );

  const invalidVal = runBootstrap(dir, ["--mode", "validate", "--harness", "cursor"]);
  assert.equal(invalidVal.status, 1);
  assert.ok(invalidVal.payload.errors.some((e) => e.includes("frontmatter")));
  assert.ok(invalidVal.payload.errors.some((e) => e.includes("AGENTS.md")));
});

// 3. Multi-adapter scaffolding (cursor,zcode) and invalid harness rejection
withTempProject((dir) => {
  const bad = runBootstrap(dir, ["--mode", "bootstrap", "--harness", "unknown-tool"]);
  assert.equal(bad.status, 1);
  assert.ok(bad.payload.errors.some((e) => e.includes("unsupported --harness")));

  const boot = runBootstrap(dir, ["--mode", "bootstrap", "--harness", "cursor,zcode"]);
  assert.equal(boot.status, 0);
  assert.ok(existsSync(join(dir, ".cursor/rules/agent-workspace.mdc")));
  assert.ok(existsSync(join(dir, ".cursor/skills/README.md")));
  assert.ok(existsSync(join(dir, ".zcode/skills/README.md")));

  const st = runBootstrap(dir, ["--mode", "status"]);
  assert.equal(st.status, 0);
  assert.ok(st.payload.skipped.includes("Cursor adapter present"));
  assert.ok(st.payload.skipped.includes("Zcode adapter present"));
});

// 4. Legacy zcode-agent-bootstrap marker compatibility on repair
withTempProject((dir) => {
  const boot = runBootstrap(dir, ["--mode", "bootstrap"]);
  assert.equal(boot.status, 0);

  const agentsPath = join(dir, "AGENTS.md");
  const oldAgents = readFileSync(agentsPath, "utf8").replace(
    "Generated by agent-workspace-bootstrap",
    "Generated by zcode-agent-bootstrap",
  );
  writeFileSync(agentsPath, oldAgents, "utf8");

  const promptsPath = join(dir, "ROUTINES/task-prompts.md");
  const oldPrompts = readFileSync(promptsPath, "utf8").replace(
    "Generated by agent-workspace-bootstrap",
    "Generated by zcode-agent-bootstrap",
  );
  writeFileSync(promptsPath, oldPrompts, "utf8");

  const repair = runBootstrap(dir, ["--mode", "repair"]);
  assert.equal(repair.status, 0);
  assert.equal(repair.payload.conflicts.length, 0);
  assert.ok(repair.payload.skipped.some((s) => s.startsWith("AGENTS.md (managed file exists")));
});

// 5. board-init mirroring into .cursor/skills/board and .zcode/skills/board + validate
withTempProject((dir) => {
  const boot = runBootstrap(dir, ["--mode", "bootstrap", "--harness", "cursor,zcode"]);
  assert.equal(boot.status, 0);

  const boardSkillDir = join(dir, ".agents/skills/board");
  mkdirSync(boardSkillDir, {recursive: true});
  writeFileSync(join(boardSkillDir, "SKILL.md"), "---\nname: board\ndescription: Board\n---\n", "utf8");

  const boardInit = runBootstrap(dir, [
    "--mode", "board-init",
    "--harness", "cursor,zcode",
    "--non-interactive",
    "--skip-board-install",
    "--board-url", "http://127.0.0.1:4100/api/board",
    "--board-profile", "worker-1",
    "--board-channels", "general,dev",
    "--board-mode", "observe",
  ]);
  assert.equal(boardInit.status, 0);
  assert.equal(boardInit.payload.errors.length, 0);
  assert.ok(existsSync(join(dir, "INTEGRATIONS/VERCEL_BOARD.md")));
  assert.ok(existsSync(join(dir, "ROUTINES/vercel-board-triage.md")));
  assert.ok(existsSync(join(dir, ".cursor/skills/board/SKILL.md")));
  assert.ok(existsSync(join(dir, ".zcode/skills/board/SKILL.md")));

  const routine = readFileSync(join(dir, "ROUTINES/vercel-board-triage.md"), "utf8");
  assert.match(routine, /Cursor Automation/);

  const val = runBootstrap(dir, ["--mode", "validate", "--harness", "cursor,zcode"]);
  assert.equal(val.status, 0);
  assert.equal(val.payload.errors.length, 0);
});

// 6. Secret pattern detection in USER.md and .cursor/rules/agent-workspace.mdc
withTempProject((dir) => {
  const boot = runBootstrap(dir, ["--mode", "bootstrap", "--harness", "cursor"]);
  assert.equal(boot.status, 0);

  writeFileSync(join(dir, "USER.md"), "# USER.md\n\napi_key: supersecretvalue12345\n", "utf8");
  const mdcPath = join(dir, ".cursor/rules/agent-workspace.mdc");
  writeFileSync(mdcPath, readFileSync(mdcPath, "utf8") + "\npassword: anothersecretvalue99\n", "utf8");

  const val = runBootstrap(dir, ["--mode", "validate", "--harness", "cursor"]);
  assert.equal(val.status, 1);
  assert.ok(val.payload.errors.some((e) => e.includes("USER.md")));
  assert.ok(val.payload.errors.some((e) => e.includes(".cursor/rules/agent-workspace.mdc")));
});

console.log("agent-workspace-bootstrap 脚手架、适配器、board-init 与安全校验测试通过。");
