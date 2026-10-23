mod ai;
mod graphics;
mod grid;
mod information_display;
mod interaction;
mod keyboard_control;
mod line_feedback;
mod piece_selector;
mod pool_display;
mod screenshot;
mod state_update;

use bevy::{
    prelude::*,
    window::{WindowMode, WindowResolution},
};
use boop::Player;

pub const PLAYER_HUMAN: Player = Player::First;
pub const PLAYER_AI: Player = Player::Second;

fn main() {
    let screenshot = std::env::var_os("BOOP_SCREENSHOT").map(std::path::PathBuf::from);
    let mut app = App::new();
    app.add_plugins((
        DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Boop".into(),
                name: Some("boop".into()),
                resolution: WindowResolution::new(860, 960),
                mode: WindowMode::Windowed,
                canvas: Some("#boop-canvas".into()),
                ..default()
            }),
            ..default()
        }),
        state_update::plugin,
        ai::plugin,
        graphics::plugin,
        interaction::plugin,
        information_display::plugin,
        line_feedback::plugin,
        pool_display::plugin,
        piece_selector::plugin,
        keyboard_control::plugin,
    ));
    if let Some(path) = screenshot {
        screenshot::plugin(&mut app, path);
    }
    app.run();
}
