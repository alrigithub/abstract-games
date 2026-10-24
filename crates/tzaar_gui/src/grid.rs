use bevy::prelude::*;

use crate::graphics::{COLOR_GRID, COLOR_INTERSECTION, ScaleFactor};
use crate::hex_layout::grid_segments;

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let line_color = COLOR_GRID;
    let dot_color = COLOR_INTERSECTION;
    let spacing = scale_factor.world_spacing();

    for (a, b) in grid_segments(spacing) {
        gizmos.line(
            scale_factor.screen_point(a),
            scale_factor.screen_point(b),
            line_color,
        );
    }

    for coord in tzaar::all_playable_coords() {
        let p = scale_factor.screen_point(coord);
        gizmos.circle_2d(p.truncate(), 2.0 * scale_factor.factor, dot_color);
    }
}
