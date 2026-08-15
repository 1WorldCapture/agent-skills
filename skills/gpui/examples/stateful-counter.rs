//! The core gpui state patterns in one file:
//! Entity state, cx.listener, cx.notify, EventEmitter + cx.subscribe, cx.spawn.
//!
//! Same Cargo.toml dependencies as hello-world.rs, plus `smol = "2"` for the
//! timer used in the async example.

use gpui::*;
use gpui_component::{button::*, *};
use std::time::Duration;

// --- A state entity that emits typed events --------------------------------

enum CounterEvent {
    ReachedTen,
}

struct Counter {
    count: usize,
}

impl EventEmitter<CounterEvent> for Counter {}

impl Counter {
    fn increment(&mut self, cx: &mut Context<Self>) {
        self.count += 1;
        if self.count == 10 {
            cx.emit(CounterEvent::ReachedTen);
        }
        cx.notify(); // trigger re-render of views depending on this entity
    }
}

// --- The root view ----------------------------------------------------------

struct CounterView {
    counter: Entity<Counter>,
    input: Entity<gpui_component::input::InputState>,
}

impl CounterView {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let counter = cx.new(|_| Counter { count: 0 });

        // Cross-entity communication: react to the counter's typed events.
        cx.subscribe(
            &counter,
            |_this, _counter, event: &CounterEvent, cx| match event {
                CounterEvent::ReachedTen => {
                    cx.notify();
                }
            },
        )
        .detach();

        // Stateful component: the state lives in its own entity.
        let input = cx.new(|cx| {
            gpui_component::input::InputState::new(window, cx).placeholder("Type something...")
        });

        Self { counter, input }
    }
}

impl Render for CounterView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let count = self.counter.read(cx).count;

        div()
            .flex()
            .flex_col()
            .gap_3()
            .size_full()
            .p_4()
            .items_center()
            .justify_center()
            .child(format!("count: {count}"))
            .child(
                Button::new("inc")
                    .primary()
                    .label("+1")
                    // cx.listener captures this view's entity handle.
                    .on_click(cx.listener(|this, _, _window, cx| {
                        // All mutable state access goes through update().
                        this.counter.update(cx, |counter, cx| counter.increment(cx));
                    })),
            )
            .child(
                Button::new("inc-async")
                    .outline()
                    .label("+1 after 1s (async)")
                    .on_click(cx.listener(|this, _, _window, cx| {
                        // Foreground async task; cancelled automatically if the
                        // view entity is dropped.
                        cx.spawn(|this, mut cx| async move {
                            cx.background_spawn(async move {
                                smol::Timer::after(Duration::from_secs(1)).await;
                            })
                            .await;
                            this.update(cx, |this, cx| {
                                this.counter.update(cx, |counter, cx| counter.increment(cx));
                            })
                            .ok();
                        })
                        .detach();
                    })),
            )
            .child(gpui_component::input::Input::new(&self.input))
    }
}

fn main() {
    gpui_platform::application()
        .with_assets(gpui_component_assets::Assets)
        .run(|cx: &mut App| {
            gpui_component::init(cx);

            let bounds = Bounds::centered(None, size(px(600.), px(400.)), cx);
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                |window, cx| {
                    let view = cx.new(|cx| CounterView::new(window, cx));
                    cx.new(|cx| Root::new(view, window, cx))
                },
            )
            .unwrap();
            cx.activate(true);
        });
}
