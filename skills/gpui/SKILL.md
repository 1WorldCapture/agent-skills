---
name: gpui
description: 使用 gpui（Zed 开源的 Rust GPU 加速 UI 框架）和 gpui-component（Longbridge 出品的配套组件库）开发桌面应用。用于创建 gpui 应用骨架、编写 view/entity、选用组件库的现成组件（Button/Input/Select/Dialog/Table 等）、主题与国际化、仿照现有模式编写新组件，或排查 gpui 相关问题时。
---

# gpui + gpui-component 开发指南

本 skill 服务于「用 Rust + gpui + gpui-component 写桌面应用」的场景。读者是 agent：你知识面很广，但对这两个项目的记忆很可能**过时或错误**——它们都很年轻、API 变动快。请以本文件及 references/ 为准，不要凭训练记忆臆造 API。

- gpui：<https://github.com/zed-industries/zed/tree/main/crates/gpui>（Zed 仓库的子 crate，pre-1.0，API 经常 break）
- gpui-component：<https://github.com/longbridge/gpui-component>（crates.io 有发布，文档站 <https://longbridge.github.io/gpui-component/>）

## 最重要的心智模型（30 秒版）

gpui 是「hybrid immediate + retained mode」框架，分三层：

1. **Entity（状态层）**：所有状态由 `App` 持有。`cx.new(|cx| Foo{...})` 返回 `Entity<T>` 句柄（类似 `Rc`，本身不持有状态）。读写状态必须经过 context：`entity.update(cx, |foo, cx| ...)` / `entity.read(cx)`。**没有绕过 context 拿 `&mut` 的办法。**
2. **View（声明式 UI）**：实现了 `Render` trait 的 Entity。每帧调 `render(&mut self, window, cx) -> impl IntoElement` 产出元素树。`div()` 是瑞士军刀，样式是 **Tailwind 风格方法链**（`.flex().flex_col().gap_3().bg(rgb(0x505050)).p_4()`）。
3. **Element（命令式底层）**：`Element`/`IntoElement` trait，自控 layout/prepaint/paint，只有虚拟列表、编辑器这类场景才需要。

改状态后调 `cx.notify()` 触发重渲染；跨 entity 联动用 `cx.observe(...)` 或 `EventEmitter` + `cx.subscribe(...)`。

gpui-component 在此基础上提供 60+ 现成组件（shadcn/ui 之于 React 的定位），外加主题、i18n、图标、Dialog/Notification 等 overlay 基础设施。

## 常见认知错误（务必避免）

- **`Model` 早已改名 `Entity`**；`ViewContext` 已并入 `Context<T>`。
- 入口 API 有两代：旧 `Application::new()` vs 新 `gpui_platform::application()`。写代码前先确认依赖来源（crates.io 0.2.2 还是 zed git main）。
- **gpui 不要从 crates.io 与 git 混用**。配合 gpui-component 时一律用 git 依赖（版本对齐由 gpui-component 仓库保证）。
- git 方式依赖 zed 仓库会拉入 GPL-3.0 的 `ztracing`/`zlog`；crates.io 版无此问题。商用分发注意。
- gpui 官网 <https://gpui.rs/> 很薄，不是完整教程。**最好的用法参考是 Zed 源码**（`crates/ui`、`crates/workspace`、`crates/editor`）和 gpui-component 源码。

## 项目骨架（依赖 + 初始化三要素）

```toml
[dependencies]
gpui = { git = "https://github.com/zed-industries/zed" }
gpui_platform = { git = "https://github.com/zed-industries/zed", features = ["font-kit"] }
gpui-component = { git = "https://github.com/longbridge/gpui-component" }
gpui-component-assets = { git = "https://github.com/longbridge/gpui-component" } # 可选：内置图标
anyhow = "1.0"
```

```rust
fn main() {
    gpui_platform::application()
        .with_assets(gpui_component_assets::Assets) // 用内置图标时
        .run(|cx| {
            gpui_component::init(cx); // 1. 必须第一行：初始化 theme/dialog/sheet/menu 等全局状态
            // 2. open_window；3. 每个窗口的第一层 view 必须包 Root::new(view, window, cx)
        });
}
```

缺了 `gpui_component::init` 或 `Root`，Dialog/Sheet/Notification 等 overlay 不会渲染。完整可运行骨架见 [examples/hello-world.rs](examples/hello-world.rs)。

## 用组件前，先查目录

gpui-component 已有 **60+ 组件**：输入表单（Input/Select/Combobox/Checkbox/Switch/Slider/ColorPicker/DatePicker/Form…）、展示反馈（Button/Tag/Badge/Alert/Spinner/Skeleton/Progress/Tooltip…）、浮层（Dialog/Sheet/Notification/Popover/Menu…）、导航布局（Tabs/Sidebar/TitleBar/Resizable/Accordion…）、数据大件（DataTable/List/Tree/VirtualList/Editor/Chart/TextView…）。**写新组件前务必先查 [references/component-catalog.md](references/component-catalog.md)，不要重造轮子。**

组件分两类用法：

- **Stateless**：直接在 render 里用，`Button::new("id").primary().label("OK").on_click(|_, _, _| {})`
- **Stateful**：状态存成 struct 字段的 `Entity<XxxState>`（`cx.new(|cx| InputState::new(window, cx))`），render 里 `Input::new(&self.input)`；事件用 `cx.subscribe(&state, ...)` 接收

## 路由索引（按需加载）

| 你要做什么 | 读哪个文件 |
|---|---|
| 理解 entity/context/render/事件/异步/键分发/动画/测试 | [references/gpui-core.md](references/gpui-core.md) |
| 找现成组件、看某个组件的用法要点 | [references/component-catalog.md](references/component-catalog.md) |
| 主题换肤、暗色模式、i18n、图标/assets、Root/overlay 层 | references/component-catalog.md 末章 |
| 编写一个新组件（代码组织、trait 套路、variant 约定） | [references/authoring-components.md](references/authoring-components.md) |
| 遇到本 skill 没覆盖的问题，去官网/GitHub 深挖 | [references/further-reading.md](references/further-reading.md) |
| 抄一个最小可运行应用 | [examples/hello-world.rs](examples/hello-world.rs) |
| 抄 entity + 事件订阅的完整模式 | [examples/stateful-counter.rs](examples/stateful-counter.rs) |

## 最快的自助查询通道

- 任意组件文档：`https://longbridge.github.io/gpui-component/docs/components/{name}.md`（站点的**任何页面加 `.md` 后缀即得 Markdown**）
- 全文档合集（约 1MB）：`https://longbridge.github.io/gpui-component/llms-full.txt`
- gpui-component 官方自带 skill（本 skill 的上游，更细）：仓库 `skills/gpui-component/` 和 `skills/gpui/`（22 篇 gpui 底层参考）
- gpui API：<https://docs.rs/gpui>；gpui 官方 examples：`zed/crates/gpui/examples/`，跑法 `cargo run -p gpui --example hello_world`
