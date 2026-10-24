//! Win-line and selection glow pulse (Yinsh score presentation).

use bevy::prelude::*;

use crate::palette::score_bloom_color;

#[derive(Component)]
pub struct GlowPulse {
    pub base_scale: f32,
}

pub fn pulse_factor(time_secs: f32, intense: bool) -> f32 {
    if intense {
        1.0 + 0.12 * (time_secs * 9.0).sin()
    } else {
        1.0 + 0.06 * (time_secs * 7.0).sin()
    }
}

pub fn apply_glow_pulse<S: bevy::ecs::query::QueryFilter>(
    time: Res<Time>,
    intense: bool,
    active: bool,
    query: &mut Query<(&GlowPulse, &mut Transform), S>,
) {
    if !active {
        return;
    }
    let factor = pulse_factor(time.elapsed_secs(), intense);
    for (base, mut transform) in query.iter_mut() {
        transform.scale = Vec3::splat(base.base_scale * factor);
    }
}

#[derive(Resource)]
pub struct WinGlowMaterials {
    pub core: Handle<ColorMaterial>,
    pub halo: Handle<ColorMaterial>,
}

pub fn setup_win_glow_materials(materials: &mut Assets<ColorMaterial>) -> WinGlowMaterials {
    WinGlowMaterials {
        core: materials.add(ColorMaterial {
            color: score_bloom_color(1.0),
            ..default()
        }),
        halo: materials.add(ColorMaterial {
            color: score_bloom_color(0.55),
            ..default()
        }),
    }
}
