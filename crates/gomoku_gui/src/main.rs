mod ai;
mod graphics;
mod grid;
mod interaction;
mod keyboard_control;
mod state_update;

use bevy::{
    prelude::*,
    window::{WindowMode, WindowResolution},
};
use gomoku::Player;

pub const PLAYER_HUMAN: Player = Player::Black;
pub const PLAYER_AI: Player = Player::White;

fn main() {
    App::new()
        .add_plugins((
            DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: "Gomoku".into(),
                    name: Some("gomoku".into()),
                    resolution: WindowResolution::new(860, 960),
                    mode: WindowMode::Windowed,
                    canvas: Some("#gomoku-canvas".into()),
                    ..default()
                }),
                ..default()
            }),
            state_update::plugin,
            ai::plugin,
            graphics::plugin,
            interaction::plugin,
            keyboard_control::plugin,
        ))
        .run();
}
