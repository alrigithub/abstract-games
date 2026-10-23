use abstract_gui_theme::draw_square_grid_lines;
use bevy::prelude::*;
use boop::BOARD_SIZE;

use crate::graphics::ScaleFactor;

pub fn draw_grid(mut gizmos: Gizmos, scale_factor: Res<ScaleFactor>) {
    draw_square_grid_lines(
        &mut gizmos,
        scale_factor.board_half_extent(),
        BOARD_SIZE,
        scale_factor.spacing,
    );
}
