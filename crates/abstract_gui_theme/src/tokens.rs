use bevy::{color::Alpha, prelude::Color};

use crate::palette::{AI, GRID_LINE, HUMAN, HUMAN_HIGHLIGHTED, STAGE, WIN};

/// Board and piece colors for one visual theme (all values mirror the Yinsh palette).
#[derive(Debug, Clone, Copy)]
pub struct BoardPalette {
    pub stage: Color,
    pub board_fill: Color,
    pub grid_line: Color,
    pub player_a: Color,
    pub player_b: Color,
    pub player_b_stroke: Color,
    pub win: Color,
    pub hover: Color,
}

pub const DARK: BoardPalette = BoardPalette {
    stage: STAGE,
    board_fill: STAGE,
    grid_line: GRID_LINE,
    player_a: HUMAN,
    player_b: AI,
    player_b_stroke: AI,
    win: WIN,
    hover: HUMAN_HIGHLIGHTED,
};

pub const LIGHT: BoardPalette = BoardPalette {
    stage: Color::srgb(0xf3 as f32 / 255.0, 0xf1 as f32 / 255.0, 0xec as f32 / 255.0),
    board_fill: Color::srgb(0xe8 as f32 / 255.0, 0xe4 as f32 / 255.0, 0xdc as f32 / 255.0),
    grid_line: Color::srgb(0x5c as f32 / 255.0, 0x56 as f32 / 255.0, 0x4c as f32 / 255.0),
    player_a: HUMAN,
    player_b: AI,
    player_b_stroke: AI,
    win: WIN,
    hover: HUMAN_HIGHLIGHTED,
};

impl BoardPalette {
    pub fn player_a_cat(self) -> Color {
        crate::palette::human_variant(0.92)
    }

    pub fn player_b_cat(self) -> Color {
        crate::palette::ai_variant(0.92)
    }

    pub fn player_a_ghost(self) -> Color {
        crate::palette::human_ghost_alpha(0.35)
    }
}
