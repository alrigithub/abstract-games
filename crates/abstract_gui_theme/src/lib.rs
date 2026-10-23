//! Shared dark/light board tokens and Bevy setup helpers for abstract game GUIs.

mod setup;
mod tokens;

pub use setup::{apply_dark_stage_clear_color, configure_grid_gizmos};
pub use tokens::{BoardPalette, DARK, LIGHT};

/// Grid line width shared across board games (matches tzaar_gui gizmo default).
pub const GRID_LINE_WIDTH: f32 = 2.0;

/// CSS background for the dark stage (WASM page chrome).
pub const DARK_STAGE_CSS: &str = "#0d0d0d";
