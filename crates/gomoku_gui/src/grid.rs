use bevy::prelude::*;
use gomoku::BOARD_SIZE;

use crate::graphics::{COLOR_GRID, ScaleFactor};

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let grid_line_color = COLOR_GRID;
    let last = (BOARD_SIZE - 1) as u8;

    for x in 0..=last {
        let start = scale_factor.screen_point(gomoku::Coord { x, y: 0 });
        let end = scale_factor.screen_point(gomoku::Coord { x, y: last });
        gizmos.line(start, end, grid_line_color);
    }

    for y in 0..=last {
        let start = scale_factor.screen_point(gomoku::Coord { x: 0, y });
        let end = scale_factor.screen_point(gomoku::Coord { x: last, y });
        gizmos.line(start, end, grid_line_color);
    }
}
