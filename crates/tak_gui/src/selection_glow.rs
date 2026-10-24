use abstract_gui_theme::{apply_glow_pulse, setup_win_glow_materials, GlowPulse, WinGlowMaterials};
use bevy::prelude::*;

use crate::{
    graphics::{ScaleFactor, ScaleFactorSet, BACKGROUND_RENDER_LAYER},
    interaction::SelectedStack,
    state_update::InteractionState,
    PLAYER_HUMAN,
};

#[derive(Component)]
struct StackSelectionGlow;

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, init_glow_materials)
        .add_systems(
            Update,
            (
                sync_stack_glow.after(ScaleFactorSet),
                pulse_stack_glow.after(sync_stack_glow),
            ),
        );
}

fn init_glow_materials(
    mut commands: Commands,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(setup_win_glow_materials(&mut materials));
}

fn sync_stack_glow(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    selected: Res<SelectedStack>,
    scale_factor: Res<ScaleFactor>,
    game_state: Res<crate::state_update::GameState>,
    interaction_state: Res<InteractionState>,
    materials: Res<WinGlowMaterials>,
    existing: Query<Entity, With<StackSelectionGlow>>,
) {
    for entity in existing.iter() {
        commands.entity(entity).despawn();
    }

    if !matches!(*interaction_state, InteractionState::HumanTurn) {
        return;
    }
    let Some(coord) = selected.0 else {
        return;
    };
    if game_state.board().controlled_by(coord) != Some(PLAYER_HUMAN) {
        return;
    }

    let center = scale_factor.screen_point(coord);
    let scale = scale_factor.factor;
    for (radius, mat) in [(34.0, materials.halo.clone()), (18.0, materials.core.clone())] {
        commands.spawn((
            StackSelectionGlow,
            GlowPulse { base_scale: scale },
            Mesh2d(meshes.add(Circle::new(radius))),
            MeshMaterial2d(mat),
            Transform::from_translation(center).with_scale(Vec3::splat(scale)),
            BACKGROUND_RENDER_LAYER,
        ));
    }
}

fn pulse_stack_glow(
    time: Res<Time>,
    selected: Res<SelectedStack>,
    mut q: Query<(&GlowPulse, &mut Transform), With<StackSelectionGlow>>,
) {
    apply_glow_pulse(time, true, selected.0.is_some(), &mut q);
}
