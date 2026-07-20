#!/usr/bin/env node

import {strict as assert} from "node:assert";
import {spawnSync} from "node:child_process";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  chooseStrategy,
  DEFAULT_CONFIDENCE_WARNING,
  DEFAULT_MAX_PIXELS,
  parseArguments,
  summarizeConfidence,
} from "../skills/light-ocr-text-extraction/scripts/extract.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(repoRoot, "skills/light-ocr-text-extraction/scripts/extract.mjs");

{
  const options = parseArguments([
    "--input", "scan.tiff",
    "--output-dir", "outputs",
    "--runtime-dir", "work/runtime",
  ]);
  assert.equal(options.strategy, "auto");
  assert.equal(options.execution, "auto");
  assert.equal(options.confidenceWarning, DEFAULT_CONFIDENCE_WARNING);
  assert.equal(options.maxPixels, DEFAULT_MAX_PIXELS);
}

{
  const options = parseArguments([
    "--input", "scan.png",
    "--output-dir", "outputs",
    "--runtime-dir", "work/runtime",
    "--strategy", "tiled",
    "--execution", "cpu",
    "--confidence-warning", "0.9",
    "--max-pixels", "1000",
    "--overwrite",
  ]);
  assert.equal(options.strategy, "tiled");
  assert.equal(options.execution, "cpu");
  assert.equal(options.confidenceWarning, 0.9);
  assert.equal(options.maxPixels, 1000);
  assert.equal(options.overwrite, true);
}

assert.equal(chooseStrategy("auto", 1000, 1000), "bounded");
assert.equal(chooseStrategy("auto", 1308, 1382), "tiled");
assert.equal(chooseStrategy("bounded", 4000, 4000), "bounded");

{
  const summary = summarizeConfidence([
    {confidence: 0.99, text: "第一行"},
    {confidence: 0.8, text: "第二行"},
  ], 0.9);
  assert.equal(summary.mean, 0.895);
  assert.deepEqual(summary.lowConfidenceLines.map((line) => line.index), [2]);
}

for (const invalid of [
  ["--input", "scan.png"],
  ["--input", "scan.png", "--output-dir", "out", "--runtime-dir", "runtime", "--strategy", "invalid"],
  ["--input", "scan.png", "--output-dir", "out", "--runtime-dir", "runtime", "--confidence-warning", "2"],
  ["--input", "scan.png", "--output-dir", "out", "--runtime-dir", "runtime", "--max-pixels", "0"],
]) {
  assert.throws(() => parseArguments(invalid));
}

{
  const help = spawnSync(process.execPath, [script, "--help"], {encoding: "utf8"});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--runtime-dir/);
  assert.equal(help.stderr, "");
}

console.log("light-ocr-text-extraction 参数、策略选择与置信度汇总测试通过。");
