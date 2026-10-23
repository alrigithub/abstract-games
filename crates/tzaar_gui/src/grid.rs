use bevy::prelude::*;
use tzaar::{DIRECTIONS, all_playable_coords, is_playable, step};

use crate::graphics::{COLOR_GRID, ScaleFactor};

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let color = COLOR_GRID;
    for coord in all_playable_coords() {
        for dir in DIRECTIONS {
            let neighbor = step(coord, dir);
            if !is_playable(neighbor) {
                continue;
            }
            // Draw each edge once (toward increasing y, then x).
            if neighbor.y < coord.y || (neighbor.y == coord.y && neighbor.x < coord.x) {
                continue;
            }
            gizmos.line(
                scale_factor.screen_point(coord),
                scale_factor.screen_point(neighbor),
                color,
            );
        }
    }
}
