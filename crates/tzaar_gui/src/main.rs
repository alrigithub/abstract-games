mod ai;
mod board_entity;
mod graphics;
mod grid;
mod information_display;
mod interaction;
mod keyboard_control;
mod pass_ui;
mod piece_visual;
mod render_config;
mod state_update;

use bevy::prelude::*;
use tzaar::Player;

pub const PLAYER_HUMAN: Player = Player::First;
pub const PLAYER_AI: Player = Player::Second;

fn main() {
    let mut app = App::new();
    app.add_plugins(render_config::plugin_group()).add_plugins((
        ai::plugin,
        state_update::plugin,
        graphics::plugin,
        piece_visual::plugin,
        information_display::plugin,
        interaction::plugin,
        pass_ui::plugin,
        keyboard_control::plugin,
    ));
    #[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
    app.add_plugins(render_config::ForceCpuGpuPreprocessingPlugin);
    app.run();
}
