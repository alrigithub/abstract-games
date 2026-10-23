//! UI chrome colors (HUD, panels, buttons).

use bevy::{color::Alpha, prelude::Color};

use crate::palette::{GRID_LINE, HUMAN, STAGE};

pub const STAGE_CSS: &str = "hsl(0, 0%, 5%)";

pub const STATUS_TEXT: Color = Color::hsl(0.0, 0.0, 0.3);

pub const STATUS_TEXT_ON_DARK: Color = Color::hsl(0.0, 0.0, 0.88);

pub const POOL_TITLE: Color = Color::srgb(0.95, 0.92, 0.85);

pub const POOL_LABEL: Color = Color::srgb(0.82, 0.84, 0.88);

pub fn ai_strength_panel() -> (Color, Color, Color) {
    let panel_bg = Color::srgb(0xf3 as f32 / 255.0, 0xf1 as f32 / 255.0, 0xec as f32 / 255.0);
    let border = Color::srgb(0x5c as f32 / 255.0, 0x56 as f32 / 255.0, 0x4c as f32 / 255.0);
    let text = HUMAN;
    (panel_bg, border, text)
}

pub fn ai_strength_button_hover() -> Color {
    Color::srgb(0xe8 as f32 / 255.0, 0xe4 as f32 / 255.0, 0xdc as f32 / 255.0)
}

pub fn pass_panel() -> (Color, Color, Color) {
    let bg = STAGE.with_alpha(0.95);
    let border = GRID_LINE;
    let text = POOL_TITLE;
    (bg, border, text)
}

pub struct PieceSelectorHud;

impl PieceSelectorHud {
    pub const HINT: Color = Color::srgb(0.72, 0.74, 0.78);
    pub const BUTTON_BG: Color = Color::srgb(0.18, 0.2, 0.24);
    pub const BUTTON_BORDER: Color = Color::srgb(0.35, 0.38, 0.42);
    pub const BUTTON_TEXT: Color = Color::srgb(0.9, 0.9, 0.92);
    pub const HOVER_BG: Color = Color::srgb(0.32, 0.38, 0.48);
    pub const PRESSED_BG: Color = Color::srgb(0.12, 0.13, 0.15);
    pub const SELECTED_BORDER: Color = Color::srgb(0.85, 0.65, 0.25);
    pub const SELECTED_TEXT: Color = Self::BUTTON_TEXT;
    pub const IDLE_TEXT: Color = Color::srgb(0.45, 0.47, 0.5);
}
