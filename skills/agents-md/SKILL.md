---
name: agents-md
description: >
  在项目根目录创建或维护英文 AGENTS.md：按原则与松散骨架写入项目整体理解，
  保留人类 handcraft 章节，并按一周新鲜度决定是否更新。用于用户提到
  AGENTS.md、agents.md、维护项目 agent 说明书、创建/更新 AGENTS.md，
  或希望 agent 在动手前有一份稳定的项目级指引时。
---

# AGENTS.md 维护

在**当前项目根目录**创建或更新 `AGENTS.md`。技能说明用中文；写出的文件正文必须是**英文**。

## 原则

1. 内容要让 agent 对项目有**整体理解**。
2. **不要**写入容易变化的内容。
3. **不要**写入常识——对人类像经验、对强模型往往已是默认知识；只留项目特有、非显而易见的信息。

## 松散骨架

章节可删可扩（`Handcraft` 除外）。默认英文标题与用途：

| Section | Purpose |
| --- | --- |
| `## Project overview` | What this repo is, how it is shaped, what agents should optimize for |
| `## Directory structure` | Stable tree ≈ `tree -L 2` depth; skeleton only, not a live file inventory |
| `## Start and stop` | How to bring the environment up and tear it down |
| `## Verification` | How to validate a change (commands / checks that matter here) |
| `## Handcraft` | Human-owned notes; skill never edits this section's body |

不适用的骨架章节直接**省略**，不要留空壳。`Handcraft` 例外：新建时必须预留空节；更新时若缺失则在文件末尾**补上空节**。

## 不要写什么

1. 依赖/工具的具体版本号与 changelog 式变更记录
2. 会随迭代漂移的详尽文件/API 清单（超出稳定目录骨架）
3. 通用工程常识与默认最佳实践（别提交密钥、常规 Git 礼仪等）
4. 产品文案、用户故事、对外营销式介绍（留给 README / docs）
5. 一次性任务、临时 workaround、进行中的 TODO / 讨论记录

## 工作流

### 1. 判定动作

在项目根检查 `AGENTS.md`：

```bash
node "<path-to-this-skill>/scripts/freshness.mjs" --root .
```

（将 `<path-to-this-skill>` 解析为本 `SKILL.md` 所在目录，不要用 cwd 猜。）

脚本 stdout 为一行 JSON，字段：

- `action`: `create` | `update` | `skip`
- `path`: 目标文件绝对路径
- `ageDays`: 距今天数（无文件时为 `null`）
- `source`: `none` | `git` | `mtime`（时间来源）
- `forceHint`: 是否建议因用户明示而强制更新

规则：

| 情况 | 动作 |
| --- | --- |
| 文件不存在 | `create` |
| 最近改动 **> 7 天** | `update` |
| 最近改动 **≤ 7 天** | `skip`，除非用户**明示要求更新** |

时间来源：优先该文件在 git 中的最近提交时间；未进 git 或无法取得 → 用文件 **mtime**。

用户明示要求更新时：即使 `action` 为 `skip`，也按 `update` 执行。

`skip` 时向用户简短说明「一周内已更新过，已跳过」，然后结束。不要改文件。

### 2. 收集事实

只读探索，服从三原则：

- README、现有 `AGENTS.md`、包管理与脚本入口（`package.json`、`Makefile`、`docker-compose` 等）
- 顶层与约两级深度的目录布局（可用 `tree -L 2`，没有 tree 则等价列举）
- 真实的启动/停止与验证命令（以仓库脚本为准，不要臆造）

不确定就省略或写清「unknown / not applicable」，不要用常识填充。

### 3. 创建（`create`）

写英文 `AGENTS.md`，覆盖适用骨架章节，并**预留空 Handcraft**：

```markdown
## Handcraft

<!-- Human-maintained. Do not edit in agents-md skill updates. -->
```

### 4. 更新（`update`）

1. 读取现有 `AGENTS.md`。
2. **完整提取** `## Handcraft` 整节（从该标题到下一同级 `##` 之前，或到文件末尾），原样保留；技能**绝不改动**其正文。
3. 按原则与骨架重写其余章节；合并仍有效的项目特有信息，删除违背「不要写什么」的内容。
4. 将保留的 Handcraft 节写回（通常放在文末）。若旧文件没有该节，追加上面的空 Handcraft 模板。
5. 不要改动无关文件；不要自动 commit。

### 5. 收尾

用一两句话告诉用户：创建了 / 更新了 / 跳过了，以及文件路径。不要在回复里复述整份 `AGENTS.md`。

## Handcraft 边界

- 识别标题：行首 `## Handcraft`（大小写敏感，按此字面匹配）。
- 更新时整段只读保留；可移动到文末，但正文零修改。
- 不要把技能生成的内容写进 Handcraft。
