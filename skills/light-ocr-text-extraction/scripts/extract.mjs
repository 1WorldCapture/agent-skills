#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {basename, dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const LIGHT_OCR_VERSION = "0.3.0";
export const SHARP_VERSION = "0.35.3";
export const DEFAULT_CONFIDENCE_WARNING = 0.98;
export const DEFAULT_MAX_PIXELS = 25_000_000;

const HELP = `用法：
  node extract.mjs --input <图片> --output-dir <目录> --runtime-dir <目录> [选项]

必需参数：
  --input <路径>                输入图片
  --output-dir <路径>           结果目录
  --runtime-dir <路径>          任务级依赖缓存目录

选项：
  --strategy auto|bounded|tiled 默认 auto
  --execution auto|cpu|apple|webgpu
                                默认 auto
  --confidence-warning <0..1>   默认 0.98
  --max-pixels <正整数>         默认 25000000
  --overwrite                   覆盖已有结果
  --help                        显示帮助
`;

function fail(message) {
  throw new Error(message);
}

function valueAfter(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} 缺少参数值`);
  return value;
}

export function parseArguments(argv) {
  const options = {
    confidenceWarning: DEFAULT_CONFIDENCE_WARNING,
    execution: "auto",
    help: false,
    input: null,
    maxPixels: DEFAULT_MAX_PIXELS,
    outputDir: null,
    overwrite: false,
    runtimeDir: null,
    strategy: "auto",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--input") options.input = valueAfter(argv, index++, argument);
    else if (argument === "--output-dir") options.outputDir = valueAfter(argv, index++, argument);
    else if (argument === "--runtime-dir") options.runtimeDir = valueAfter(argv, index++, argument);
    else if (argument === "--strategy") options.strategy = valueAfter(argv, index++, argument);
    else if (argument === "--execution") options.execution = valueAfter(argv, index++, argument);
    else if (argument === "--confidence-warning") {
      options.confidenceWarning = Number(valueAfter(argv, index++, argument));
    } else if (argument === "--max-pixels") {
      options.maxPixels = Number(valueAfter(argv, index++, argument));
    } else fail(`未知参数：${argument}`);
  }

  if (options.help) return options;
  for (const [name, value] of [["--input", options.input], ["--output-dir", options.outputDir], ["--runtime-dir", options.runtimeDir]]) {
    if (!value) fail(`缺少必需参数：${name}`);
  }
  if (!new Set(["auto", "bounded", "tiled"]).has(options.strategy)) {
    fail("--strategy 必须是 auto、bounded 或 tiled");
  }
  if (!new Set(["auto", "cpu", "apple", "webgpu"]).has(options.execution)) {
    fail("--execution 必须是 auto、cpu、apple 或 webgpu");
  }
  if (!Number.isFinite(options.confidenceWarning) || options.confidenceWarning < 0 || options.confidenceWarning > 1) {
    fail("--confidence-warning 必须是 0 到 1 之间的数字");
  }
  if (!Number.isSafeInteger(options.maxPixels) || options.maxPixels <= 0) {
    fail("--max-pixels 必须是正整数");
  }
  return options;
}

export function chooseStrategy(requested, width, height) {
  if (requested !== "auto") return requested;
  return Math.max(width, height) > 1200 || width * height > 1_500_000 ? "tiled" : "bounded";
}

export function summarizeConfidence(lines, warningThreshold = DEFAULT_CONFIDENCE_WARNING) {
  const mean = lines.length ? lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length : 0;
  const lowConfidenceLines = lines
    .map((line, index) => ({index: index + 1, ...line}))
    .filter((line) => line.confidence < warningThreshold);
  return {lowConfidenceLines, mean};
}

function ensureSupportedNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== 22 && major !== 24) {
    fail(`需要 Node.js 22 或 24，当前版本为 ${process.version}`);
  }
}

function runtimePackageJson() {
  return {
    name: "light-ocr-text-extraction-runtime",
    private: true,
    version: "1.0.0",
    dependencies: {
      "@arcships/light-ocr": LIGHT_OCR_VERSION,
      sharp: SHARP_VERSION,
    },
  };
}

function runtimeIsReady(runtimeDir) {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(runtimeDir, "package.json"), "utf8"));
    const expected = runtimePackageJson();
    if (packageJson.dependencies?.["@arcships/light-ocr"] !== expected.dependencies["@arcships/light-ocr"]) return false;
    if (packageJson.dependencies?.sharp !== expected.dependencies.sharp) return false;
    const require = createRequire(resolve(runtimeDir, "package.json"));
    require.resolve("@arcships/light-ocr");
    require.resolve("sharp");
    return true;
  } catch {
    return false;
  }
}

function ensureRuntime(runtimeRoot) {
  const root = resolve(runtimeRoot);
  mkdirSync(root, {recursive: true});
  const runtimeDir = resolve(root, `runtime-v1-${process.platform}-${process.arch}`);
  if (runtimeIsReady(runtimeDir)) return runtimeDir;

  const staging = mkdtempSync(resolve(root, ".install-"));
  try {
    writeFileSync(resolve(staging, "package.json"), `${JSON.stringify(runtimePackageJson(), null, 2)}\n`);
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const installation = spawnSync(npm, ["install", "--ignore-scripts=false", "--no-audit", "--no-fund"], {
      cwd: staging,
      encoding: "utf8",
      env: process.env,
    });
    if (installation.status !== 0) {
      const output = [installation.stdout, installation.stderr].filter(Boolean).join("\n").trim();
      fail(`OCR 运行依赖安装失败${output ? `：\n${output}` : ""}`);
    }
    if (!runtimeIsReady(staging)) fail("OCR 运行依赖安装后未通过完整性检查");
    rmSync(runtimeDir, {recursive: true, force: true});
    renameSync(staging, runtimeDir);
    return runtimeDir;
  } catch (error) {
    rmSync(staging, {recursive: true, force: true});
    throw error;
  }
}

function loadRuntime(runtimeDir) {
  const require = createRequire(resolve(runtimeDir, "package.json"));
  const lightOcr = require("@arcships/light-ocr");
  const sharpModule = require("sharp");
  return {createEngine: lightOcr.createEngine, sharp: sharpModule.default ?? sharpModule};
}

async function decodeImage(sharp, input, maxPixels) {
  const image = sharp(input, {failOn: "error", limitInputPixels: maxPixels});
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) fail("无法读取图片尺寸");
  if ((metadata.pages ?? 1) > 1) fail("检测到多页或多帧图片；请先拆分为单页 PNG 后逐页识别");
  if (metadata.width * metadata.height > maxPixels) {
    fail(`图片像素数 ${metadata.width * metadata.height} 超过上限 ${maxPixels}`);
  }
  const {data, info} = await image
    .rotate()
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  if (info.channels !== 4) fail(`预处理产生了不受支持的 ${info.channels} 通道图片`);
  return {data, info, metadata};
}

function outputPaths(outputDir) {
  return {
    json: resolve(outputDir, "result.json"),
    report: resolve(outputDir, "quality-report.md"),
    text: resolve(outputDir, "text.txt"),
  };
}

function ensureOutputsAvailable(paths, overwrite) {
  if (overwrite) return;
  const existing = Object.values(paths).filter((path) => existsSync(path));
  if (existing.length) fail(`目标文件已存在：${existing.join("、")}；确认后使用 --overwrite`);
}

function writeAtomically(path, contents, overwrite) {
  mkdirSync(dirname(path), {recursive: true});
  const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(temporary, contents);
  if (overwrite) rmSync(path, {force: true});
  renameSync(temporary, path);
}

function createQualityReport(summary) {
  const lowConfidence = summary.confidence.lowConfidenceLines.length
    ? summary.confidence.lowConfidenceLines
      .map((line) => `- 第 ${line.index} 行（${(line.confidence * 100).toFixed(2)}%）：${line.text}`)
      .join("\n")
    : "- 无";
  const warnings = summary.diagnostics.warnings.length
    ? summary.diagnostics.warnings.map((warning) => `- ${warning.code}：${warning.message}`).join("\n")
    : "- 无";

  return `# OCR 质量报告

## 摘要

- 输入文件：${summary.inputFile}
- 原始格式：${summary.preprocessing.sourceFormat || "未知"}
- 处理后尺寸：${summary.image.width} × ${summary.image.height}
- 检测策略：${summary.engine.detectionStrategy}
- 执行后端：${summary.engine.executionProvider}
- 检出行数：${summary.lineCount}
- 拒绝行数：${summary.diagnostics.rejectedLines.length}
- 运行警告数：${summary.diagnostics.warnings.length}
- 平均模型置信度：${(summary.confidence.mean * 100).toFixed(2)}%
- 低置信度阈值：${(summary.confidence.warningThreshold * 100).toFixed(2)}%
- OCR 内部耗时：${(summary.timingUs.total / 1_000_000).toFixed(2)} 秒

模型置信度不等于真实准确率。请对照原图检查标点、数字、中英混排、标题分隔符和阅读顺序。

## 低置信度行

${lowConfidence}

## 运行警告

${warnings}

## 产物

- \`text.txt\`：未经人工修改的 OCR 文本。
- \`result.json\`：文字、置信度、坐标、诊断与执行信息。
- \`quality-report.md\`：本报告。
`;
}

export async function runExtraction(options) {
  ensureSupportedNode();
  const input = resolve(options.input);
  if (!existsSync(input)) fail(`输入文件不存在：${input}`);
  const paths = outputPaths(resolve(options.outputDir));
  ensureOutputsAvailable(paths, options.overwrite);

  const runtimeDir = ensureRuntime(options.runtimeDir);
  const {createEngine, sharp} = loadRuntime(runtimeDir);
  const decoded = await decodeImage(sharp, input, options.maxPixels);
  const strategy = chooseStrategy(options.strategy, decoded.info.width, decoded.info.height);
  const engine = await createEngine({
    detection: {strategy},
    execution: {provider: options.execution},
  });
  const engineInfo = engine.info;

  let result;
  try {
    result = await engine.recognize({
      data: decoded.data,
      height: decoded.info.height,
      pixelFormat: "rgba8",
      stride: decoded.info.width * 4,
      width: decoded.info.width,
    }, {includeDiagnostics: true});
  } finally {
    await engine.close();
  }

  const confidence = summarizeConfidence(result.lines, options.confidenceWarning);
  const diagnostics = result.diagnostics ?? {rejectedLines: [], warnings: []};
  const summary = {
    schema: "light-ocr-text-extraction/1.0",
    inputFile: basename(input),
    packages: {lightOcr: LIGHT_OCR_VERSION, sharp: SHARP_VERSION},
    runtime: {node: process.version, platform: process.platform, arch: process.arch},
    preprocessing: {
      autoOrient: true,
      sourceFormat: decoded.metadata.format ?? null,
      sourceHeight: decoded.metadata.height,
      sourceWidth: decoded.metadata.width,
      pixelFormat: "rgba8",
    },
    image: {height: result.imageHeight, width: result.imageWidth},
    engine: {
      backend: engineInfo.backend,
      detectionStrategy: engineInfo.detectionStrategy,
      executionProvider: engineInfo.executionProvider,
      modelBundleId: result.modelBundleId,
    },
    lineCount: result.lines.length,
    confidence: {
      mean: confidence.mean,
      warningThreshold: options.confidenceWarning,
      lowConfidenceLines: confidence.lowConfidenceLines,
    },
    timingUs: result.timingUs,
    diagnostics,
    lines: result.lines,
  };

  const text = result.lines.map((line) => line.text).join("\n");
  writeAtomically(paths.text, `${text}${text ? "\n" : ""}`, options.overwrite);
  writeAtomically(paths.json, `${JSON.stringify(summary, null, 2)}\n`, options.overwrite);
  writeAtomically(paths.report, createQualityReport(summary), options.overwrite);
  return {paths, summary};
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const {paths, summary} = await runExtraction(options);
  process.stdout.write(`${JSON.stringify({
    detectionStrategy: summary.engine.detectionStrategy,
    lineCount: summary.lineCount,
    meanConfidence: summary.confidence.mean,
    outputs: paths,
  }, null, 2)}\n`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`错误：${error.message}\n`);
    process.exitCode = 1;
  });
}
