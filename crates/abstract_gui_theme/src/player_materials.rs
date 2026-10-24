use bevy::prelude::*;

use crate::palette::{AI, HUMAN, HUMAN_GHOST, HUMAN_HIGHLIGHTED};

#[derive(Resource, Clone)]
pub struct PlayerColorMaterials {
    pub human: Handle<ColorMaterial>,
    pub human_highlighted: Handle<ColorMaterial>,
    pub human_ghost: Handle<ColorMaterial>,
    /// Yinsh cursor / ring-removal styling (same material as `human_ghost`).
    pub human_transparent: Handle<ColorMaterial>,
    pub ai: Handle<ColorMaterial>,
    pub animated_markers: [Handle<ColorMaterial>; 8],
}

pub fn insert_player_color_materials(
    commands: &mut Commands,
    materials: &mut Assets<ColorMaterial>,
) -> PlayerColorMaterials {
    let ai = materials.add(AI);
    let human_ghost = materials.add(HUMAN_GHOST);
    let player = PlayerColorMaterials {
        human: materials.add(HUMAN),
        human_highlighted: materials.add(HUMAN_HIGHLIGHTED),
        human_ghost: human_ghost.clone(),
        human_transparent: human_ghost,
        ai: ai.clone(),
        animated_markers: std::array::from_fn(|_| ai.clone()),
    };
    commands.insert_resource(player.clone());
    player
}
