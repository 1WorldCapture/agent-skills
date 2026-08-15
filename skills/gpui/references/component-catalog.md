# gpui-component 组件目录

用途：**动手写 UI 之前先在这里找现成组件**。每个组件给出一句话用途和用法要点；完整 API 抓 `https://longbridge.github.io/gpui-component/docs/components/{name}.md`（kebab-case，如 `data-table.md`、`date-picker.md`）。

约定：
- **有状态（Stateful）** = 需要 `Entity<XxxState>` 持有状态，事件用 `cx.subscribe(&state, ...)`。
- **无状态（Stateless）** = 受控组件，构造传值 + `on_click` 回调。
- 所有带尺寸的组件统一 `.xsmall() / .small() / .medium()(默认) / .large()`。
- import 路径都是 `gpui_component::xxx`，下表省略前缀。

## 输入与表单

| 组件 | Import | 要点 |
|---|---|---|
| Input | `input::{Input, InputState}` | Stateful。单行输入，校验/密码掩码/前后缀。`InputState::new(window, cx).placeholder(..).masked(true)`；`Input::new(&state).cleanable(true).prefix(..).suffix(..)`；事件 `InputEvent::{Change, PressEnter, Focus, Blur}` |
| Textarea | 同 input 模块 | Stateful。`InputState::new(window, cx).multi_line(true)`；固定行数/自动增高/软换行 |
| NumberInput | `number_input::{NumberInput, NumberInputState}` | Stateful。数值 + 增减按钮，`.step(..)` |
| OtpInput | `otp_input::{OtpInput, OtpInputState}` | Stateful。验证码多格输入，自动聚焦/粘贴 |
| Select | `select::{Select, SelectState}` | Stateful。下拉选择。`SelectState::new(vec![..], Some(IndexPath), window, cx)`；`.searchable(true)`；分组 `SelectGroup`；item 实现 `SelectItem`（字符串类型已内置） |
| Combobox | `combobox::{Combobox, ComboboxState}` | Stateful。可搜索自动补全，自定义 trigger、多选 |
| Checkbox | `checkbox::Checkbox` | Stateless。含三态。`Checkbox::new("id").checked(b).on_click(\|&bool,_,_\|..)` |
| Radio / RadioGroup | `radio::{Radio, RadioGroup}` | Stateless。单选 |
| Switch | `switch::Switch` | Stateless。`Switch::new("id").checked(..).on_click(..)` |
| Toggle | `toggle::Toggle` | Stateless。按钮形态开关 |
| Slider | `slider::{Slider, SliderState}` | Stateful。滑块 |
| Rating | `rating::Rating` | Stateless。星级 `Rating::new("id").value(n).on_click(..)` |
| Stepper | `stepper::Stepper` | 步骤引导条 |
| ColorPicker | `color_picker::{ColorPicker, ColorPickerState}` | Stateful。多格式/预设/alpha |
| Calendar | `time::calendar::{Calendar, CalendarState}` | Stateful。单日/区间/禁用日期 |
| DatePicker | `time::date_picker::{DatePicker, DatePickerState}` | Stateful。弹日历选日期 |
| Form | `form::{v_form, h_form, field}` | 表单容器：`v_form().child(field().label("Name").child(input))`，校验、多列 |

## 展示与反馈

| 组件 | Import | 要点 |
|---|---|---|
| Button | `button::{Button, ButtonGroup, DropdownButton}` | Stateless。variant：`.primary()/.danger()/.warning()/.success()/.info()/.ghost()/.link()/.text()`，修饰 `.outline()/.compact()/.disabled()/.loading()/.selected()`，`.icon(IconName)`、`.tooltip(..)`；ButtonGroup 可多选切换组；DropdownButton = 主按钮+下拉菜单 |
| Icon | `{Icon, IconName}` | Stateless。`Icon::new(IconName::Check).small()`；IconName 按 Lucide 命名；SVG 资源需 assets（见文末） |
| Image | `image::Image` | Stateless。加载态/fallback/响应式 |
| Avatar / AvatarGroup | `avatar::{Avatar, AvatarGroup}` | Stateless。图/首字母/占位 |
| Badge | `badge::Badge` | Stateless。红点/未读数 `.count(n)` |
| Tag | `tag::Tag` | Stateless。`Tag::secondary().child("..")`，variant 枚举含 `Color(ColorName)` 与 `Custom` |
| Label | `label::Label` | Stateless。表单标签/高亮/次要文本 |
| Kbd | `kbd::Kbd` | Stateless。快捷键显示（平台格式化） |
| Link | `link::Link` | Stateless。链接样式 |
| Alert | `alert::Alert` | Stateless。`Alert::info(..)/success(..)/warning(..)/error(..)` |
| Spinner | `spinner::Spinner` | Stateless。加载旋转 |
| Skeleton | `skeleton::Skeleton` | Stateless。骨架屏 |
| Progress | `progress::{ProgressBar, ProgressCircle}` | Stateless。`ProgressCircle::new("id").value(45.0)` |
| DescriptionList | `description_list::{DescriptionList, DescriptionItem}` | 键值对详情 |
| TextView | `text_view::{TextView, ...}` | Markdown/HTML 渲染：`text::markdown(md_str)`；支持文本选择与自定义插件 |
| Chart | `chart::{LineChart, BarChart, ...}` | line/bar/area/pie/radar/candlestick/sankey，基于 plot |
| Plot | `plot::Plot` | 底层绘图，`#[derive(IntoPlot)]` 自定义图表 |
| Clipboard | `clipboard::Clipboard` | Stateless。复制按钮 `Clipboard::new("id").content(..)` |

## 浮层与弹出（都依赖 Root，见文末）

| 组件 | Import | 要点 |
|---|---|---|
| Dialog | `dialog::Dialog` + `WindowExt` | 模态框：`window.open_dialog(cx, \|d,_,_\| d.title(..).child(..).footer(..))` / `window.close_dialog(cx)` |
| AlertDialog | `WindowExt` | 确认型模态：`window.open_alert_dialog(...)` |
| Sheet | `sheet::Sheet` + `WindowExt` | 边缘滑出面板：`window.open_sheet(...)` |
| Notification | `notification::Notification` + `WindowExt` | toast：`window.push_notification(.., cx)`；`Notification::new().title(..).message(..).with_type(..).autohide(false).action(..)`；去重 ID `.id::<T>()` |
| Popover | `popover::Popover` | 锚定浮层：`.trigger(..).content(..)` |
| HoverCard | `hover_card::{HoverCard, HoverCardState}` | Stateful。悬停富内容卡片 |
| Tooltip | `tooltip::Tooltip` | 任意带 id 元素 `.tooltip("text")`，或闭包自定义内容 |
| Menu | `menu::{PopupMenu, DropdownMenu}` | 上下文/弹出菜单：图标、快捷键、子菜单、check 项；`PopupMenu::build(..)` |
| FocusTrap | `focus_trap::FocusTrap` | 模态内焦点圈禁 |

## 导航与布局

| 组件 | Import | 要点 |
|---|---|---|
| Tabs / TabBar | `tab::{Tab, TabBar}` | `TabBar::new("id").child(Tab::new("t1")..).selected_index(..)` |
| Sidebar | `sidebar::{Sidebar, SidebarMenu, SidebarMenuItem, ...}` | 应用侧边导航，header/footer/group |
| TitleBar | `title_bar::TitleBar` | 自定义窗口标题栏 |
| StatusBar | `status_bar::StatusBar` | 底部状态栏，左中右三区 |
| Breadcrumb | `breadcrumb::Breadcrumb` | 面包屑（无专页文档，看 story） |
| Pagination | `pagination::Pagination` | Stateless。分页 |
| Accordion | `accordion::Accordion` | 折叠面板组（基于 collapsible） |
| Collapsible | `collapsible::Collapsible` | Stateless。单个展开/收起 |
| GroupBox | `group_box::GroupBox` | Stateless。带标题分组容器 |
| Resizable | `resizable::{h_resizable, v_resizable, resizable_panel, ResizablePanelState}` | 可拖拽分隔面板；事件 `ResizablePanelEvent` |
| Scrollable | `scroll::Scrollbar` | 自定义滚动条：`Scrollbar::both(&state, &handle)`；显示模式 `Theme::set_scrollbar_mode(..)` |
| Dock | `dock::{DockArea, Panel, TabPanel, StackPanel, Tiles}` | IDE 式停靠布局，状态可序列化。无文档页，看 `cargo run --example dock` |
| Settings | `settings::{Settings, SettingItem, SettingGroup, SettingPage}` | 设置页框架，字段带默认值渲染器 |

## 数据展示（大件）

| 组件 | Import | 要点 |
|---|---|---|
| DataTable | `table::{DataTable, TableState, TableDelegate, Column}` | Stateful。虚拟滚动/排序/筛选/固定列/调列宽/选择/右键菜单/无限加载。实现 `TableDelegate`（`columns_count/rows_count/column/render_td`），`Column::new("key","Name").width(..).sortable().fixed(ColumnFixed::Left)` |
| Table | `table::Table` | 简单数据直接渲染的轻量表格 |
| List | `list::{List, ListState, ListDelegate, ListItem}` | Stateful。分组/搜索/选择/无限滚动；事件 `ListEvent::Select(IndexPath)` |
| Tree | `tree::{Tree, TreeState, TreeDelegate}` | Stateful。虚拟化树形视图 |
| VirtualList | `{v_virtual_list, h_virtual_list, VirtualListScrollHandle}` | 可变尺寸项虚拟列表：`v_virtual_list(entity, "id", item_sizes, \|view, range, _, cx\| ..)`；`scroll_handle.scroll_to_item(ix, ScrollStrategy)` |
| Editor | `editor::{Editor, EditorState}` | Stateful。代码编辑器：语法高亮/行号/折叠/decorations/LSP。`EditorState::new("rust", window, cx)`；高亮需 cargo feature（如 `tree-sitter-rust`） |

## 主题、暗色模式、i18n、图标

- **取色**：`use gpui_component::ActiveTheme as _;` 后 `cx.theme().primary / .background / .foreground / .border / .muted / .danger / .secondary ...`（`Hsla`）。渐变 token 走 `cx.theme().tokens.xxx.background`。
- **切换明暗**：`Theme::global_mut(cx).toggle_mode(cx)`；判断 `cx.theme().mode.is_dark()`。
- **主题包**：内置 21 套 JSON 主题（ayu/catppuccin/gruvbox/solarized/tokyonight/macos-classic…）。加载自定义目录：`ThemeRegistry::watch_dir(path, cx, |cx| { Theme::global_mut(cx).apply_config(&theme); })`，支持热切换。
- **i18n**：基于 `rust-i18n`。应用建 `locales/ui.yml`（键放 `gpui_component:` 命名空间），crate root 加 `rust_i18n::i18n!("locales", fallback = "en")`，`gpui_component::init` 前调 `rust_i18n::extend!(gpui_component)`；深合并，未覆盖键回落内置。切换 `gpui_component::set_locale("fr")`。
- **图标**：SVG 不内置。要么依赖 `gpui-component-assets` + `.with_assets(Assets)`，要么自己用 `rust-embed` 实现 gpui `AssetSource` 嵌入 `icons/**/*.svg`（文件名匹配 `IconName`，Lucide 命名）。参考 example `app_assets`。

## Root 与 overlay 层（容易漏）

每个窗口第一层 view 必须是 `Root::new(view, window, cx)`。Root 默认绘制客户端窗口边框，`Root::new(...).bordered(false)` 关闭（无边框窗口见 example `root_borderless`）。

Dialog/Sheet/Notification 三层 overlay 的渲染入口在 Root 里；如果你自定义 Root 之下的渲染，需要把 `Root::render_dialog_layer(window, cx)` / `render_sheet_layer` / `render_notification_layer` 加进第一层 view 的 render（返回 `Option`，用 `.children()` 添加）。

## 没有现成组件时

先看 **gpui-base**（`crates/base`，文档 <https://longbridge.github.io/gpui-component/base/>）：40 个无样式 headless primitives，是自建设计系统的正确起点。再不行才从零写，写法见 authoring-components.md。
