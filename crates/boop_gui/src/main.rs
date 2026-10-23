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
use boop::Player;

pub const PLAYER_HUMAN: Player = Player::First;
pub const PLAYER_AI: Player = Player::Second;

fn main() {
    App::new()
        .add_plugins((
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
            keyboard_control::plugin,
        ))
        .run();
}
