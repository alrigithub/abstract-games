use bevy::{color::Alpha, prelude::Color};

/// Board and piece colors for one visual theme.
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

/// Dark stage and grid (current default for Boop / Gomoku WASM shells).
pub const DARK: BoardPalette = BoardPalette {
    stage: Color::srgb(
        0x0d as f32 / 255.0,
        0x0d as f32 / 255.0,
        0x0d as f32 / 255.0,
    ),
    board_fill: Color::srgb(
        0x1a as f32 / 255.0,
        0x18 as f32 / 255.0,
        0x14 as f32 / 255.0,
    ),
    grid_line: Color::srgb(
        0x8a as f32 / 255.0,
        0x82 as f32 / 255.0,
        0x78 as f32 / 255.0,
    ),
    player_a: Color::srgb(
        0x11 as f32 / 255.0,
        0x11 as f32 / 255.0,
        0x11 as f32 / 255.0,
    ),
    player_b: Color::srgb(
        0xf5 as f32 / 255.0,
        0xf5 as f32 / 255.0,
        0xf5 as f32 / 255.0,
    ),
    player_b_stroke: Color::srgb(
        0x22 as f32 / 255.0,
        0x22 as f32 / 255.0,
        0x22 as f32 / 255.0,
    ),
    win: Color::srgb(
        0x3b as f32 / 255.0,
        0x82 as f32 / 255.0,
        0xf6 as f32 / 255.0,
    ),
    hover: Color::srgb(
        0x94 as f32 / 255.0,
        0xa3 as f32 / 255.0,
        0xb8 as f32 / 255.0,
    ),
};

/// Light theme tokens (reserved for a future theme toggle).
pub const LIGHT: BoardPalette = BoardPalette {
    stage: Color::srgb(
        0xf3 as f32 / 255.0,
        0xf1 as f32 / 255.0,
        0xec as f32 / 255.0,
    ),
    board_fill: Color::srgb(
        0xe8 as f32 / 255.0,
        0xe4 as f32 / 255.0,
        0xdc as f32 / 255.0,
    ),
    grid_line: Color::srgb(
        0x5c as f32 / 255.0,
        0x56 as f32 / 255.0,
        0x4c as f32 / 255.0,
    ),
    player_a: DARK.player_a,
    player_b: DARK.player_b,
    player_b_stroke: DARK.player_b_stroke,
    win: DARK.win,
    hover: DARK.hover,
};

/// Slightly darker/lighter piece variants (kitten vs cat) on the same player hue.
impl BoardPalette {
    pub fn player_a_cat(self) -> Color {
        Color::srgb(
            0x1a as f32 / 255.0,
            0x1a as f32 / 255.0,
            0x1a as f32 / 255.0,
        )
    }

    pub fn player_b_cat(self) -> Color {
        Color::srgb(
            0xe8 as f32 / 255.0,
            0xe8 as f32 / 255.0,
            0xe8 as f32 / 255.0,
        )
    }

    pub fn player_a_ghost(self) -> Color {
        self.player_a.with_alpha(0.35)
    }
}
