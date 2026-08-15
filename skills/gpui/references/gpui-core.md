# gpui 框架核心

gpui 是 Zed 编辑器的 UI 框架（`zed/crates/gpui`），GPU 加速、hybrid immediate + retained mode。pre-1.0，API 会变。本文覆盖写应用所需的核心概念；更深的细节去翻官方参考（见 further-reading.md）。

## 三层模型

```
Entity<T>   状态层：App 统一持有，Entity 只是引用计数句柄
  └─ View   实现了 Render 的 Entity，render() 产出元素树
       └─ Element   底层绘制单元（div、svg、自定义 Element）
```

### Entity 与 Context

- 创建：`let entity = cx.new(|cx| MyState { ... });` → 得到 `Entity<MyState>`。
- 读：`entity.read(cx)`；写：`entity.update(cx, |state, cx| { ... })`。**所有访问都要经过 context 闭包**，这是硬性设计，不是风格建议。
- Context 层级（能力递增）：
  - `App` — 应用级：`open_window`、`quit`、菜单、全局状态（`cx.set_global` / `cx.global`）、`background_spawn`。
  - `Context<T>` — 绑定到具体 entity 的 App：额外有 `notify`、`observe`、`subscribe`、`emit`、`spawn`、`listener`。
  - `&mut Window` — 渲染与事件回调里才有：焦点、键分发、窗口级绘制。
  - trait 视角：`AppContext`（new/update/read entity、global）⊂ `VisualContext`（带 window：`new_window_entity`、`replace_root_view`、`focus`）。

### Render 与元素样式

```rust
impl Render for Counter {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex().flex_col().gap_3().p_4()
            .bg(rgb(0x505050)).text_color(rgb(0xffffff))
            .child(format!("count: {}", self.count))
    }
}
```

- `div()` + Tailwind 风格方法链覆盖绝大多数布局；布局引擎是 taffy（flexbox + grid）。
- 颜色：`rgb(0xRRGGBB)`、`hsla(...)`，或 gpui-component 里 `cx.theme().primary` 等语义色（**用组件库时优先取 theme 色，不要硬编码 rgb**）。
- 尺寸：`px(500.)`、`size(...)`；`rem()` 等也有。
- 条件样式：`use gpui::prelude::FluentBuilder as _;` 然后 `.when(cond, |this| this.bg(...))` / `.when_some(opt, |this, v| ...)`。

### 交互与事件

- 鼠标：元素要可交互需先给 id（`.id("...")` 成为 `Stateful`），然后 `.on_click(|event, window, cx| ...)`、`.on_mouse_down(...)`、拖放等。
- 捕获自身状态的回调用 `cx.listener(|this, event, window, cx| { ...; cx.notify(); })`。
- 键盘走 **Action 体系**：
  - `actions!(my_app, [Quit, Save]);` 或 `#[derive(Action)]` 定义动作；
  - `cx.bind_keys([KeyBinding::new("cmd-q", Quit, None)])` 绑定；
  - 元素 `.on_action(|action, window, cx| ...)` 或 `window.dispatch_action(...)` 分发；
  - 焦点链由 `FocusHandle`（`cx.focus_handle()` + `.track_focus(&handle)`）决定，键分发沿焦点链向上冒泡。

### 数据流三件套

| 机制 | 触发 | 接收 | 用途 |
|---|---|---|---|
| notify/observe | `cx.notify()` | `cx.observe(&entity, \|obs, handle, cx\| ...)` | 状态变了 → 重渲染 + 联动 |
| EventEmitter | `cx.emit(event)`（需 `impl EventEmitter<E> for T {}`） | `cx.subscribe(&entity, \|sub, handle, event, cx\| ...)` | 类型化事件（组件库事件全走这个） |
| listener | — | `cx.listener(...)` | 事件回调里改自己 |

`observe`/`subscribe` 返回 `Subscription`：`.detach()` 挂到 entity 生命周期，或存起来手动 drop 取消订阅。

### 异步

- `cx.spawn(|this, cx| async move { ... })` — 前台任务，entity 销毁自动取消；闭包里 `cx` 是 `AsyncApp`，`this.update(cx, ...)` 改状态。
- `cx.background_spawn(future)` — 后台线程（无 UI 访问）。
- executor 与平台事件循环集成；不要自己起 tokio runtime 处理 UI 联动。

### 动画

`with_animation` / `Animation` API（元素级），参考 `zed/crates/gpui/examples/animation.rs` 与 `opacity.rs`。

### 窗口

`cx.open_window(WindowOptions { window_bounds: Some(WindowBounds::Windowed(bounds)), titlebar, ..Default::default() }, |window, cx| cx.new(|cx| MyView::new(window, cx)))`。窗口类型（dialog/popup/floating）、定位、阴影见 examples：`window.rs`、`window_positioning.rs`、`window_shadow.rs`。多窗口间移动 entity 见 `move_entity_between_windows.rs`。

### 测试

`#[gpui::test]` + `TestAppContext`，可模拟键盘鼠标输入与视觉断言。参考 `zed/crates/gpui/examples/testing.rs`；系统学习用 gpui-component 官方 skill 的 `references/test*.md` 三篇。

## 版本与平台

- crates.io 有 `gpui 0.2.2`（2025-10）与拆出的 `gpui_platform`，但**落后于 main**。跟 gpui-component 一起用时统一走 git 依赖。
- 官方脚手架：`zed/crates/create-gpui-app`。
- 平台：macOS（Metal；字体需 `font-kit` feature）、Linux/FreeBSD（`wayland`/`x11` feature，Blade/Vulkan + cosmic-text）、Windows（Win32 + DirectWrite，无 feature）。

## 官方 examples 地图（zed/crates/gpui/examples/）

从 zed 仓库根运行：`cargo run -p gpui --example <name>`。按需求查：

- 入门：`hello_world`、`input`（文本输入/焦点/剪贴板/键绑定）、`testing`
- 布局样式：`grid_layout`、`opacity`、`pattern`、`shadow`、`text`、`text_layout`、`text_wrapper`
- 交互：`anchor`、`data_table`（虚拟化表格+自绘滚动条）、`drag_drop`、`focus_visible`、`popover`、`scrollable`、`tab_stop`
- 图像动画：`animation`、`gif_viewer`、`gradient`、`image`、`image_gallery`、`painting`（canvas/path 自绘）、`svg`
- 窗口：`window`、`window_positioning`、`window_shadow`、`set_menus`、`on_window_close_quit`、`system_notifications`
- 大列表：`uniform_list`（等高虚拟列表）、`list_example`、`tree`
- 其他：`a11y`（无障碍）、`layer_shell`（Linux）
