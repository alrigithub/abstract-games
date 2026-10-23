use bevy::prelude::*;
use tak::BOARD_SIZE;

use crate::graphics::{COLOR_GRID, ScaleFactor};

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let grid_line_color = COLOR_GRID;
    let half = scale_factor.board_half_extent();

    for i in 0..=BOARD_SIZE {
        let offset = i as f32 - BOARD_SIZE as f32 / 2.0;
        let x = offset * scale_factor.spacing;
        let y = offset * scale_factor.spacing;
        gizmos.line(
            Vec3::new(x, -half, 0.0),
            Vec3::new(x, half, 0.0),
            grid_line_color,
        );
        gizmos.line(
            Vec3::new(-half, y, 0.0),
            Vec3::new(half, y, 0.0),
            grid_line_color,
        );
    }
}
