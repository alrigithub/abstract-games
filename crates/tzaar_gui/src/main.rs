mod ai;
mod graphics;
mod grid;
mod information_display;
mod interaction;
mod keyboard_control;
mod pass_ui;
mod piece_visual;
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
            ai::plugin,
            state_update::plugin,
            graphics::plugin,
            piece_visual::plugin,
            information_display::plugin,
            interaction::plugin,
            pass_ui::plugin,
            keyboard_control::plugin,
        ))
        .run();
}
