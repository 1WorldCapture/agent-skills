---
name: light-ocr-text-extraction
description: 使用 light-ocr 在本机离线提取图片文字、行级置信度和四边形坐标，并对 TIFF 等格式自动解码。用于用户要求识别、转写或提取 PNG、JPEG、单页 TIFF、静态 WebP、静态 GIF、AVIF 等图片中的中英文文字，比较 bounded/tiled OCR 策略，或需要可核验的纯文本、JSON 与质量报告时；不用于手写体识别、版面样式重建、未经转图的 PDF 或未拆分的多页图片。
---

# 使用 Light OCR 提取文字

通过固定脚本运行 `@arcships/light-ocr`。脚本使用 `sharp` 解码图片，因此 TIFF 等非原生编码格式不需要先手工转换；OCR 与结果始终保留在本机。

## 工作原则

- 保留原始 OCR 输出，不把人工修改伪装成模型结果。
- 使用 Node.js 22 或 24；不要用 Node.js 26 运行 OCR。
- 将依赖安装到任务工作区的临时目录，不要写入技能目录或用户项目依赖。
- 默认使用 `auto` 策略：长边超过 1200 像素或总像素超过 150 万时选择 `tiled`，否则选择 `bounded`。
- 用户指定策略时尊重其选择。大图小字、密集报告和扫描页优先使用 `tiled`。
- 模型置信度不等于真实准确率。交付前检查低置信度行、标题分隔符、标点、数字和中英混排。
- 不声称重建了字体、颜色、卡片或段落样式；本技能输出按阅读顺序排列的文字行与坐标。

## 执行流程

### 1. 确认输入与输出

确认图片路径可读。将任务临时文件放在工作区的 `work/`，将用户需要的最终产物放在约定的输出目录。

PDF 和多页/多帧图片不由脚本直接处理。先使用对应工具逐页或逐帧渲染为 PNG，再分别运行本技能，并保持页码或帧序。

### 2. 选择兼容的 Node.js

先检查：

```bash
node --version
```

如果不是 Node.js 22/24，优先使用环境已提供的兼容 Node。找不到时可临时运行：

```bash
npx --yes node@24 --version
```

不要替换用户项目的 Node.js 版本或修改其 `package.json`。

### 3. 运行确定性脚本

将 `SKILL_DIR` 解析为本 `SKILL.md` 所在目录；所有路径都使用绝对路径：

```bash
NODE_24="/absolute/path/to/node-24"
"$NODE_24" "$SKILL_DIR/scripts/extract.mjs" \
  --input "/absolute/path/to/input.tiff" \
  --output-dir "/absolute/path/to/output" \
  --runtime-dir "/absolute/path/to/work/light-ocr-runtime" \
  --strategy auto
```

若通过 `npx node@24` 执行：

```bash
npx --yes node@24 "$SKILL_DIR/scripts/extract.mjs" \
  --input "/absolute/path/to/input.tiff" \
  --output-dir "/absolute/path/to/output" \
  --runtime-dir "/absolute/path/to/work/light-ocr-runtime" \
  --strategy auto
```

首次运行会在 `--runtime-dir` 下安装固定版本的 `@arcships/light-ocr` 与 `sharp`；后续复用。目标文件已存在时脚本会停止，确认可以替换后再增加 `--overwrite`。

可用参数：

- `--strategy auto|bounded|tiled`：默认 `auto`。
- `--execution auto|cpu|apple|webgpu`：默认 `auto`。
- `--confidence-warning 0..1`：质量报告的低置信度阈值，默认 `0.98`。
- `--max-pixels N`：解码像素上限，默认 2500 万。
- `--overwrite`：覆盖已有产物。

### 4. 核验产物

脚本生成：

- `text.txt`：未经人工修改的逐行文本。
- `result.json`：文字、置信度、坐标、执行策略、预处理与诊断信息。
- `quality-report.md`：中文质量摘要和低置信度行。

至少完成以下检查：

1. 对照原图确认标题、正文区块与阅读顺序没有遗漏。
2. 检查报告列出的低置信度行。
3. 检查 `AI`、数字、引号、分号、冒号、竖线等容易混淆的字符。
4. 检查 `result.json` 中是否存在 warnings、rejectedLines 或零行结果。
5. 若结果需要正式使用，创建单独的人工核验版；保留 `text.txt` 作为原始证据。

## 策略比较

只有在自动结果明显不佳或用户要求比较时，才分别运行 `bounded` 和 `tiled`。使用不同输出目录，比较行数、实际文本和诊断信息；不要仅按平均置信度选择结果。

## 失败处理

- `Node.js 22 or 24 is required`：切换到兼容 Node，不要绕过检查。
- npm 安装失败：保留错误输出，检查网络、代理、磁盘和 npm registry；不要改为来源不明的模型包。
- `invalid_image` 或 sharp 解码失败：检查文件是否损坏、扩展名是否伪装，必要时先转换为 PNG。
- `resource_limit_exceeded`：不要盲目提高上限；先确认图片尺寸，必要时分块或逐页处理。
- 零行或明显漏字：改用 `tiled`，确认图片方向与清晰度，再考虑其他 OCR 引擎。

## 安全与边界

- 不把附件上传到第三方服务。
- 不在仓库提交原始附件、模型缓存、`node_modules` 或包含敏感路径的调试产物。
- 不自动覆盖用户原文件。
- 手写体、复杂公式、印章遮挡和极低清晰度图片不在可靠能力范围内，应明确说明限制。
