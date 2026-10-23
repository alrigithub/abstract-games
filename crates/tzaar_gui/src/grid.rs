use bevy::prelude::*;
use tzaar::{all_playable_coords, is_playable, step};

use crate::graphics::{COLOR_GRID, COLOR_INTERSECTION, ScaleFactor};

/// Three parallel line families on the hex intersection grid (each edge belongs to one family).
const GRID_LINE_DIRS: [(i8, i8); 3] = [(1, 0), (0, 1), (1, -1)];

fn neg_dir((dx, dy): (i8, i8)) -> (i8, i8) {
    (-dx, -dy)
}

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let line_color = COLOR_GRID;
    let dot_color = COLOR_INTERSECTION;

    for dir in GRID_LINE_DIRS {
        let back = neg_dir(dir);
        for coord in all_playable_coords() {
            if is_playable(step(coord, back)) {
                continue;
            }
            let mut current = coord;
            while is_playable(current) {
                let next = step(current, dir);
                if !is_playable(next) {
                    break;
                }
                gizmos.line(
                    scale_factor.screen_point(current),
                    scale_factor.screen_point(next),
                    line_color,
                );
                current = next;
            }
        }
    }

    for coord in all_playable_coords() {
        let p = scale_factor.screen_point(coord);
        gizmos.circle_2d(p.truncate(), 2.2 * scale_factor.factor, dot_color);
    }
}
