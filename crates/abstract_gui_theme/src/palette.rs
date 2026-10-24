//! Canonical palette extracted from `yinsh_gui` (all games use these values).

use bevy::{color::Alpha, prelude::Color};

pub const STAGE: Color = Color::hsl(0.0, 0.0, 0.05);

pub const GRID_LINE: Color = Color::hsl(0.0, 0.0, 0.2);

pub const RING_MOVEMENT_INDICATOR: Color = Color::hsla(0.0, 0.0, 1.5, 0.1);

pub const WIN: Color = Color::srgb(
    0x3b as f32 / 255.0,
    0x82 as f32 / 255.0,
    0xf6 as f32 / 255.0,
);

const HUMAN_R: f32 = 255.0;
const HUMAN_G: f32 = 226.0;
const HUMAN_B: f32 = 55.0;
const HUMAN_BLOOM: f32 = 1.5;

const AI_R: f32 = 81.0;
const AI_G: f32 = 151.0;
const AI_B: f32 = 242.0;
const AI_BLOOM: f32 = 1.3;

pub const HUMAN: Color = Color::srgba(
    HUMAN_BLOOM * HUMAN_R / 255.0,
    HUMAN_BLOOM * HUMAN_G / 255.0,
    HUMAN_BLOOM * HUMAN_B / 255.0,
    1.0,
);

pub const HUMAN_HIGHLIGHTED: Color = Color::srgba(
    4.0 * HUMAN_R / 255.0,
    4.0 * HUMAN_G / 255.0,
    4.0 * HUMAN_B / 255.0,
    1.0,
);

pub const HUMAN_GHOST: Color = Color::srgba(
    HUMAN_BLOOM * HUMAN_R / 255.0,
    HUMAN_BLOOM * HUMAN_G / 255.0,
    HUMAN_BLOOM * HUMAN_B / 255.0,
    0.2,
);

pub const AI: Color = Color::srgba(
    AI_BLOOM * AI_R / 255.0,
    AI_BLOOM * AI_G / 255.0,
    AI_BLOOM * AI_B / 255.0,
    1.0,
);

/// Slightly dimmed human fill (Tak walls, Boop cats, etc.).
pub fn human_variant(dim: f32) -> Color {
    Color::srgba(
        HUMAN_BLOOM * HUMAN_R / 255.0 * dim,
        HUMAN_BLOOM * HUMAN_G / 255.0 * dim,
        HUMAN_BLOOM * HUMAN_B / 255.0 * dim,
        1.0,
    )
}

pub fn ai_variant(dim: f32) -> Color {
    Color::srgba(
        AI_BLOOM * AI_R / 255.0 * dim,
        AI_BLOOM * AI_G / 255.0 * dim,
        AI_BLOOM * AI_B / 255.0 * dim,
        1.0,
    )
}

/// Ghost placement preview (Tak uses higher alpha than Yinsh cursor).
pub fn human_ghost_alpha(alpha: f32) -> Color {
    Color::srgba(
        HUMAN_BLOOM * HUMAN_R / 255.0,
        HUMAN_BLOOM * HUMAN_G / 255.0,
        HUMAN_BLOOM * HUMAN_B / 255.0,
        alpha,
    )
}

/// Marks / strokes on light (AI) pieces.
pub fn ai_mark() -> Color {
    ai_variant(0.55)
}

/// Capstone accent (Tak cap uses win blue family).
pub fn cap_accent() -> Color {
    WIN
}

/// Rack slot outline during Yinsh scoring presentation.
pub fn rack_outline() -> Color {
    GRID_LINE.with_alpha(0.55)
}

/// Score-line glow on WASM (desktop uses HDR bloom — see [`score_bloom_color`]).
#[cfg(target_arch = "wasm32")]
pub fn score_bloom_color(intensity: f32) -> Color {
    WIN.with_alpha(0.35 + 0.25 * intensity)
}

/// Score-line glow on native HDR + bloom cameras.
#[cfg(not(target_arch = "wasm32"))]
pub fn score_bloom_color(intensity: f32) -> Color {
    Color::linear_rgb(1.2 * intensity, 2.4 * intensity, 6.5 * intensity)
}

pub fn score_dust_speck(r: f32, g: f32, b: f32, alpha: f32) -> Color {
    Color::srgba(r, g, b, alpha)
}

pub fn score_dust_rgb(mut rand: impl FnMut() -> f32) -> (f32, f32, f32) {
    (
        0.23 + rand() * 0.55,
        0.45 + rand() * 0.35,
        0.75 + rand() * 0.2,
    )
}
