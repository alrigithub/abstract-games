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
use tzaar::Player;

pub const PLAYER_HUMAN: Player = Player::First;
pub const PLAYER_AI: Player = Player::Second;

fn main() {
    App::new()
        .add_plugins((
            DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: "Tzaar".into(),
                    name: Some("tzaar".into()),
                    resolution: WindowResolution::new(900, 820),
                    mode: WindowMode::Windowed,
                    canvas: Some("#tzaar-canvas".into()),
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
