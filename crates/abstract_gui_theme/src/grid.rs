//! Board grid drawing helpers (topology stays in each game; color and weight come from here).

use bevy::prelude::*;

use crate::palette::GRID_LINE;

/// Yinsh does not override gizmo width; Bevy default is used for identical line weight.
pub const GRID_LINE_WIDTH: f32 = 1.0;

pub fn grid_line_color() -> Color {
    GRID_LINE
}

pub fn draw_square_grid_lines(
    gizmos: &mut Gizmos,
    half_extent: f32,
    cell_count: usize,
    spacing: f32,
) {
    let color = grid_line_color();
    for i in 0..=cell_count {
        let offset = i as f32 - cell_count as f32 / 2.0;
        let x = offset * spacing;
        let y = offset * spacing;
        gizmos.line(
            Vec3::new(x, -half_extent, 0.0),
            Vec3::new(x, half_extent, 0.0),
            color,
        );
        gizmos.line(
            Vec3::new(-half_extent, y, 0.0),
            Vec3::new(half_extent, y, 0.0),
            color,
        );
    }
}

pub fn draw_intersection_grid_lines(
    gizmos: &mut Gizmos,
    last_index: u8,
    point: impl Fn(u8, u8) -> Vec3,
) {
    let color = grid_line_color();
    for x in 0..=last_index {
        gizmos.line(point(x, 0), point(x, last_index), color);
    }
    for y in 0..=last_index {
        gizmos.line(point(0, y), point(last_index, y), color);
    }
}

pub fn draw_segment(gizmos: &mut Gizmos, start: Vec3, end: Vec3) {
    gizmos.line(start, end, grid_line_color());
}

pub fn draw_intersection_dot(gizmos: &mut Gizmos, center: Vec2, radius: f32) {
    gizmos.circle_2d(center, radius, grid_line_color());
}
