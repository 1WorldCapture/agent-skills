//! Minimal gpui + gpui-component application skeleton.
//!
//! Cargo.toml:
//! ```toml
//! [dependencies]
//! gpui = { git = "https://github.com/zed-industries/zed" }
//! gpui_platform = { git = "https://github.com/zed-industries/zed", features = ["font-kit"] }
//! gpui-component = { git = "https://github.com/longbridge/gpui-component" }
//! gpui-component-assets = { git = "https://github.com/longbridge/gpui-component" }
//! anyhow = "1.0"
//! ```

use gpui::*;
use gpui_component::{button::*, *};

struct HelloWorld;

impl Render for HelloWorld {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .gap_3()
            .size_full()
            .justify_center()
            .items_center()
            .child("Hello, gpui!")
            .child(
                Button::new("ok")
                    .primary()
                    .label("Let's Go!")
                    .on_click(|_, window, cx| {
                        // Toast notification; requires Root in the view tree.
                        window.push_notification("Clicked!", cx);
                    }),
            )
    }
}

fn main() {
    gpui_platform::application()
        .with_assets(gpui_component_assets::Assets) // built-in icons; drop if unused
        .run(|cx: &mut App| {
            // Must be the first call: initializes theme, root, dialog, sheet, menu, etc.
            gpui_component::init(cx);

            let bounds = Bounds::centered(None, size(px(600.), px(400.)), cx);
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                |window, cx| {
                    let view = cx.new(|_| HelloWorld);
                    // Every window's first-level view must be wrapped in Root,
                    // otherwise Dialog/Sheet/Notification overlays cannot render.
                    cx.new(|cx| Root::new(view, window, cx))
                },
            )
            .unwrap();
            cx.activate(true);
        });
}
