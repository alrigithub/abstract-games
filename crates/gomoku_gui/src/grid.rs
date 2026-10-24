use abstract_gui_theme::draw_intersection_grid_lines;
use bevy::prelude::*;
use gomoku::BOARD_SIZE;

use crate::graphics::ScaleFactor;

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    let last = (BOARD_SIZE - 1) as u8;
    draw_intersection_grid_lines(&mut gizmos, last, |x, y| {
        scale_factor.screen_point(gomoku::Coord { x, y })
    });
}
