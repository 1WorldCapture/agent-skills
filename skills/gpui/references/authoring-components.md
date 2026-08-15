# 编写新组件（gpui-component 风格）

当 component-catalog.md 和 gpui-base 都满足不了需求时，按本文的模式写新组件，保证与库内组件风格一致。素材来源：gpui-component 官方 `skills/gpui-component/references/style-guide.md`、`crates/ui/src/tag.rs`、`button/`、CONTRIBUTING.md。

## 先选组件形态

- **Stateless 受控组件**（绝大多数情况）：调用方持有状态，组件只渲染 + 回调。用 `#[derive(IntoElement)]` + `RenderOnce`。
- **Stateful 组件**（内部状态复杂，如 Input/Table）：独立 `XxxState` entity + 轻量 View 包装，事件用 `EventEmitter` + `cx.subscribe`。
- 内部状态简单但需容器抽象：优先考虑 `gpui-base` 的 headless primitive 组合。

## Stateless 组件的标准结构

```rust
use gpui::{prelude::FluentBuilder as _, *};
use gpui_component::{ActiveTheme as _, Sizable, Size, StyleRefinement, StyledExt as _, ...};

/// A Badge element.
#[derive(IntoElement)]
pub struct Badge {
    id: ElementId,
    base: Stateful<Div>,          // 可交互用 Stateful<Div>，纯展示用 Div
    style: StyleRefinement,       // 用户样式覆盖，固定套路
    size: Size,
    selected: bool,
    disabled: bool,
    // ... builder 字段
    on_click: Option<Rc<dyn Fn(&ClickEvent, &mut Window, &mut App)>>, // 回调必须 Rc
}

impl Badge {
    /// Create a new Badge with the given id.
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self { id: id.into(), base: div().id(...), style: StyleRefinement::default(),
               size: Size::Medium, selected: false, disabled: false, on_click: None }
    }

    /// Set the count.
    pub fn count(mut self, count: usize) -> Self { self.count = count; self }
    // setter 全是 mut self -> Self
}
```

### 必须/按需实现的 trait

| Trait | 何时 | 要点 |
|---|---|---|
| `RenderOnce` | 必须 | 根元素**末尾** `.refine_style(&self.style)`，让用户的样式覆盖生效 |
| `Styled` | 必须 | 返回 `&mut self.style`，用户才能链式改样式 |
| `ParentElement` | 有子元素时 | 转发到 `self.base` |
| `InteractiveElement` + `StatefulInteractiveElement` | 需要 hover/active/on_click 等交互时 | 需要 `.id()` |
| `Sizable` | 有尺寸档位时 | 只实现 `with_size`，免费得 `.xsmall()/.small()/.medium()/.large()` |
| `Disableable` / `Selectable` | 有 disabled/selected 态时 | 各一个 setter |

### Variant 约定

枚举 + trait 双件套（照抄 tag.rs / alert.rs 的模式）：

```rust
#[derive(Clone, Copy, Default)]
pub enum AlertVariant { #[default] Info, Success, Warning, Error }

pub trait AlertVariants: Sized {
    fn with_variant(self, variant: AlertVariant) -> Self;
    fn success(self) -> Self { self.with_variant(AlertVariant::Success) }
    // ... 每个 variant 一个默认方法
}
```

颜色**必须**从 `cx.theme()` 取语义色，并按 `cx.theme().is_dark()` 分支取色阶，不要硬编码 `rgb(...)`。

### 其他约定

- 条件样式：`.when(cond, |this| ...)` / `.when_some(opt, ...)`（`FluentBuilder`）。
- 文档注释固定句式：struct 用 `/// A {Name} element.`；构造函数 `/// Create a new {Name} with the given id.`；setter `/// Set the {field}.`
- **桌面应用鼠标光标用 `default` 而非 `pointer`**（gpui-component CONTRIBUTING 明确约定，与 Web 习惯相反）。
- 默认尺寸 `Size::Medium`。
- 事件：stateless 直接 `on_click`（状态值放回调首参，如 `|&bool, _, _|`）；stateful 用 `EventEmitter<XxxEvent>`。
- 设计观感对齐 Apple HIG / Fluent / shadcn/ui。
- 改渲染性能敏感的代码后，用 `MTL_HUD_ENABLED=1 cargo run`（macOS）或 Samply 验证 FPS。

## Stateful 组件的模式

参考 `input/`：`InputState` 是普通 struct，封装内部 entity（如文本缓冲区、焦点 handle）；外部 `cx.new(|cx| InputState::new(window, cx))` 得到 `Entity<InputState>`；`Input::new(&state)` 只是渲染包装。事件定义 `pub enum InputEvent { Change, PressEnter, Focus, Blur }` + `impl EventEmitter<InputEvent> for InputState {}`，内部 `cx.emit(InputEvent::Change)`，使用方 `cx.subscribe(&input, |this, _, ev, cx| match ev { ... }).detach()`。

## 代码组织

- 简单组件单文件（`tag.rs`、`checkbox.rs`）；复杂组件一个目录（`button/{button,button_group,dropdown_button,toggle}.rs`、`input/`、`table/`）。
- 在自己的项目里：放 `src/components/`（或 `src/ui/`），一个组件一个模块，`mod.rs` 统一 re-export。
- 展示/调试：gpui-component 仓库里每个组件配一个 story（`crates/story/src/stories/xxx_story.rs`）；自己项目里可以做一个简单的 gallery 窗口集中放组件示例。
