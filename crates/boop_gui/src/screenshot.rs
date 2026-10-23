//! Env-gated one-shot: seed both colours on the bed and write a PNG, then exit.
//!
//! ```text
//! BOOP_SCREENSHOT=/tmp/boop_contrast.png cargo run -p boop_gui
//! ```

use std::path::PathBuf;
use std::time::Duration;

use bevy::prelude::*;
use bevy::render::view::screenshot::{Screenshot, save_to_disk};
use boop::{Coord, Piece, PieceKind, Player};

use crate::state_update::{BoardResyncEvent, GameState};

#[derive(Resource)]
struct ScreenshotPath(PathBuf);

#[derive(Resource, Default)]
struct ScreenshotPhase {
    seeded: bool,
    captured: bool,
    started: Duration,
}

pub fn plugin(app: &mut App, path: PathBuf) {
    app.insert_resource(ScreenshotPath(path))
        .init_resource::<ScreenshotPhase>()
        .add_systems(Update, run_contrast_screenshot);
}

fn run_contrast_screenshot(
    mut game_state: ResMut<GameState>,
    mut resync: MessageWriter<BoardResyncEvent>,
    mut commands: Commands,
    mut phase: ResMut<ScreenshotPhase>,
    time: Res<Time>,
    path: Res<ScreenshotPath>,
) {
    if !phase.seeded {
        seed_both_colours(&mut game_state);
        resync.write(BoardResyncEvent);
        phase.seeded = true;
        phase.started = time.elapsed();
        return;
    }

    if !phase.captured && time.elapsed() - phase.started > Duration::from_millis(450) {
        commands
            .spawn(Screenshot::primary_window())
            .observe(save_to_disk(path.0.clone()));
        phase.captured = true;
        return;
    }

    if phase.captured && time.elapsed() - phase.started > Duration::from_millis(1400) {
        std::process::exit(0);
    }
}

fn seed_both_colours(game_state: &mut GameState) {
    let dark = Player::First;
    let light = Player::Second;
    let layout = [
        (0, 0, dark, PieceKind::Kitten),
        (1, 1, dark, PieceKind::Cat),
        (2, 3, dark, PieceKind::Kitten),
        (0, 4, dark, PieceKind::Cat),
        (5, 5, light, PieceKind::Cat),
        (4, 4, light, PieceKind::Kitten),
        (3, 1, light, PieceKind::Cat),
        (5, 0, light, PieceKind::Kitten),
    ];
    for (x, y, player, kind) in layout {
        game_state.set_piece(Coord::new(x, y), Piece { player, kind });
    }
}
