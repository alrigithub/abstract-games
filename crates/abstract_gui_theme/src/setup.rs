use bevy::{
    camera::visibility::RenderLayers,
    gizmos::config::{DefaultGizmoConfigGroup, GizmoConfigStore},
    prelude::{ClearColor, Commands},
};

use crate::{grid::GRID_LINE_WIDTH, palette::STAGE};

pub fn apply_stage_clear_color(commands: &mut Commands) {
    commands.insert_resource(ClearColor(STAGE));
}

/// Sets gizmo line width and optional render layer for grid drawing (Yinsh-style grid).
pub fn configure_grid_gizmos(
    config_store: &mut GizmoConfigStore,
    render_layers: Option<RenderLayers>,
) {
    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.line.width = GRID_LINE_WIDTH;
    if let Some(layers) = render_layers {
        config.render_layers = layers;
    }
}

/// Back-compat alias for Boop/Gomoku migration.
pub fn apply_dark_stage_clear_color(commands: &mut Commands) {
    apply_stage_clear_color(commands);
}
