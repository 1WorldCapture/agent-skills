# 深挖资料：官网与源码导航

本 skill 覆盖常用面，遇到没覆盖的问题按本文线索查。**gpui 生态文档稀缺，读源码是常态，不是最后手段。**

## gpui-component（优先查，文档质量高）

| 资源 | 地址 |
|---|---|
| 文档站 | <https://longbridge.github.io/gpui-component/docs/getting-started>（中文版路径 `/zh-CN/docs/...`） |
| **全文档 Markdown 合集** | <https://longbridge.github.io/gpui-component/llms-full.txt>（约 1MB，可整个抓下来检索） |
| 文档目录索引 | <https://longbridge.github.io/gpui-component/llms.txt> |
| 任意页面转 Markdown | URL 后加 `.md`，如 `.../docs/components/data-table.md` |
| 组件源码 | <https://github.com/longbridge/gpui-component/tree/main/crates/ui/src>（一个组件一个模块，直接读实现最准） |
| headless primitives | `crates/base`，文档 <https://longbridge.github.io/gpui-component/base/> |
| 官方 agent skills（更细的上游参考） | 仓库 `skills/gpui-component/`（usage + style-guide）与 `skills/gpui/`（22 篇底层参考：entity/element/action/event/async/layout/focus/test…），raw 地址 `https://raw.githubusercontent.com/longbridge/gpui-component/main/skills/gpui/references/{name}.md` |
| examples | <https://github.com/longbridge/gpui-component/tree/main/examples>（hello_world/input/sidebar/dialog_overlay/dock/editor/webview/app_assets…），运行 `cargo run -p <name>` 或 `cargo run --example <name>`；story gallery：`cargo run` |
| API 文档 | <https://docs.rs/gpui-component> |
| 在线 Gallery | <https://longbridge.github.io/gpui-component/gallery/> |

## gpui 本体

| 资源 | 地址 |
|---|---|
| 官网 | <https://gpui.rs/>（很薄：README、crate root 文档、Contexts、Key Dispatch、examples 列表） |
| 源码 | <https://github.com/zed-industries/zed/tree/main/crates/gpui> |
| 框架级文档注释 | `crates/gpui/src/gpui.rs`（crate root）、`_ownership_and_data_flow.rs`（数据流专章） |
| 官方 examples | `zed/crates/gpui/examples/`，索引见该目录 README；跑法 `cargo run -p gpui --example hello_world` |
| API 文档 | <https://docs.rs/gpui> |
| **最佳用法参考（官方原话：读 Zed 源码）** | `zed/crates/ui`（Zed 自己的组件库）、`zed/crates/workspace`（pane/item 模式）、`zed/crates/editor`（自定义 Element、复杂交互的极致样本） |
| 脚手架 | `zed/crates/create-gpui-app` |
| 社区 | Zed Discord（有 gpui 频道）：<https://zed.dev/community-links>；<https://zed.dev/blog>；GitHub Discussions |

## 典型问题的定位路径

- **某个组件怎么用 / 有什么 props** → 先抓 `docs/components/{name}.md`；不够就读 `crates/ui/src/{module}.rs` 的 setter 方法；再找 `crates/story/src/stories/` 里对应 story 看真实用法。
- **gpui 某个 API 怎么签名/怎么变了** → docs.rs 对应版本；或直接在 zed 仓库 main 分支搜符号（gpui API 变动快，以源码为准）。
- **「我想做 X 但不知道 gpui 能不能」** → 先翻 `crates/gpui/examples/` 有无对应示例；再全局搜 zed 的 `crates/`（Zed 自己几乎把框架能力都用遍了）。
- **行为不符合预期，疑似 bug** → 在 <https://github.com/longbridge/gpui-component/issues> 或 zed 仓库搜 issue；gpui-component 迭代很快，先升级到最新 main 再判断。
- **版本对齐问题**（编译报 trait 不匹配之类）→ 九成是 gpui 与 gpui-component 的 git rev 没对齐；看 gpui-component 仓库 `Cargo.toml` workspace 段里 `gpui` 指向的 rev。

## 版本快照声明

本 skill 写于 2026-08，基于 zed main 分支与 gpui-component main（crates.io 0.5.x）。这两个项目都迭代很快：**当本文件与官方文档冲突时，以官方文档/源码为准**，并顺手更新本 skill。
