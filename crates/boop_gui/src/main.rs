mod ai;
mod graphics;
mod grid;
mod information_display;
mod interaction;
mod keyboard_control;
mod line_feedback;
mod pool_display;
mod state_update;

use bevy::{
    prelude::*,
    window::{WindowMode, WindowResolution},
};
use boop::Player;

pub const PLAYER_HUMAN: Player = Player::First;
pub const PLAYER_AI: Player = Player::Second;

fn main() {
    let window = Window {
        title: "Boop".into(),
        name: Some("boop".into()),
        resolution: WindowResolution::new(860, 960),
        mode: WindowMode::Windowed,
        ..default()
    };
    #[cfg(target_arch = "wasm32")]
    {
        window.canvas = Some("#boop-canvas".into());
    }

    App::new()
        .add_plugins((
            DefaultPlugins.set(WindowPlugin {
                primary_window: Some(window),
                ..default()
            }),
            state_update::plugin,
            ai::plugin,
            graphics::plugin,
            interaction::plugin,
            information_display::plugin,
            line_feedback::plugin,
            pool_display::plugin,
            keyboard_control::plugin,
        ))
        .run();
}
