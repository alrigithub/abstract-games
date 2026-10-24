//! Shared Yinsh-derived palette, grid style, glow, and Bevy setup for all abstract game GUIs.

pub mod feedback;
mod glow;
mod grid;
mod hud;
pub mod layers;
mod palette;
mod player_materials;
mod setup;
mod tokens;

pub use glow::{apply_glow_pulse, pulse_factor, setup_win_glow_materials, GlowPulse, WinGlowMaterials};
pub use grid::{
    draw_intersection_dot, draw_intersection_grid_lines, draw_segment, draw_square_grid_lines,
    grid_line_color, GRID_LINE_WIDTH,
};
pub use hud::{
    ai_strength_button_hover, ai_strength_panel, pass_panel, PieceSelectorHud, POOL_LABEL,
    POOL_TITLE, STAGE_CSS, STATUS_TEXT, STATUS_TEXT_ON_DARK,
};
pub use layers::{BACKGROUND, FOREGROUND};
pub use palette::{
    ai_mark, ai_variant, cap_accent, human_ghost_alpha, human_variant, rack_outline,
    score_bloom_color, score_dust_rgb, score_dust_speck, AI, GRID_LINE, HUMAN, HUMAN_GHOST,
    HUMAN_HIGHLIGHTED, RING_MOVEMENT_INDICATOR, STAGE, WIN,
};
pub use player_materials::{insert_player_color_materials, PlayerColorMaterials};
pub use setup::{apply_dark_stage_clear_color, apply_stage_clear_color, configure_grid_gizmos};
pub use tokens::{BoardPalette, DARK, LIGHT};

pub use hud::STAGE_CSS as DARK_STAGE_CSS;
