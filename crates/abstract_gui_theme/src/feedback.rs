//! Transient board feedback (Boop graduation / win overlays) using the shared win + human palette.

use bevy::{color::Alpha, prelude::Color};

use crate::palette::{HUMAN, WIN};

pub fn graduation_cell_fill(strength: f32, fade: f32) -> Color {
    HUMAN.with_alpha((0.38 + 0.32 * strength) * fade)
}

pub fn graduation_cell_border(pulse: f32, fade: f32) -> Color {
    HUMAN.with_alpha((0.85 + 0.15 * pulse) * fade)
}

pub fn graduation_connector(fade: f32) -> Color {
    HUMAN.with_alpha(0.95 * fade)
}

pub fn win_cell_fill(strength: f32, fade: f32) -> Color {
    WIN.with_alpha((0.35 + 0.35 * strength) * fade)
}

pub fn win_cell_border(pulse: f32, fade: f32) -> Color {
    WIN.with_alpha((0.9 + 0.1 * pulse) * fade)
}

pub fn win_connector(fade: f32) -> Color {
    WIN.with_alpha(0.95 * fade)
}

pub fn eight_cats_fill(strength: f32, fade: f32) -> Color {
    HUMAN.with_alpha((0.28 + 0.22 * strength) * fade)
}

pub fn eight_cats_border(pulse: f32, fade: f32) -> Color {
    HUMAN.with_alpha((0.75 + 0.25 * pulse) * fade)
}

pub fn graduation_hover_fill(pulse: f32) -> Color {
    HUMAN.with_alpha(0.55 + 0.2 * pulse)
}

pub fn graduation_hover_border() -> Color {
    HUMAN.with_alpha(1.0)
}

pub fn graduation_hover_connector(pulse: f32) -> Color {
    HUMAN.with_alpha(0.95)
}

pub fn graduation_idle_fill(pulse: f32) -> Color {
    HUMAN.with_alpha(0.10 + 0.08 * pulse)
}

pub fn graduation_idle_border(pulse: f32) -> Color {
    HUMAN.with_alpha(0.55 + 0.25 * pulse)
}

pub fn graduation_idle_connector() -> Color {
    HUMAN.with_alpha(0.45)
}
