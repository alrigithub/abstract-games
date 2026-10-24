use abstract_gui_theme::{
    apply_stage_clear_color, configure_grid_gizmos, insert_player_color_materials,
    PlayerColorMaterials, BACKGROUND, FOREGROUND,
};
use bevy::prelude::*;
use bevy::window::PrimaryWindow;
#[cfg(not(target_arch = "wasm32"))]
use bevy::{post_process::bloom::Bloom, render::view::Hdr};
use gomoku::{BOARD_SIZE, Coord};

use crate::grid::draw_grid;

pub use abstract_gui_theme::{
    BACKGROUND as BACKGROUND_RENDER_LAYER, FOREGROUND as FOREGROUND_RENDER_LAYER,
};

pub const ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(500);

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
}

impl ScaleFactor {
    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        let center = (BOARD_SIZE as f32 - 1.0) / 2.0;
        Vec3::new(
            (coord.x as f32 - center) * self.spacing,
            (center - coord.y as f32) * self.spacing,
            0.,
        )
    }
}

impl Default for ScaleFactor {
    fn default() -> Self {
        Self {
            spacing: 44.0,
            factor: 1.0,
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

pub type PlayerColors = PlayerColorMaterials;

pub fn stone_mesh(
    meshes: &mut Assets<Mesh>,
    color_material: Handle<ColorMaterial>,
    visibility: Visibility,
) -> impl Bundle {
    (
        Mesh2d(meshes.add(Circle::new(18.0))),
        MeshMaterial2d(color_material),
        visibility,
    )
}

fn setup_graphics(
    mut commands: Commands,
    mut config_store: ResMut<GizmoConfigStore>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    apply_stage_clear_color(&mut commands);

    #[cfg_attr(target_arch = "wasm32", allow(unused_mut, unused_variables))]
    let mut bg_camera = commands.spawn((
        Camera2d,
        Camera {
            order: 1,
            ..default()
        },
        BACKGROUND,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    bg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    #[cfg_attr(target_arch = "wasm32", allow(unused_mut, unused_variables))]
    let mut fg_camera = commands.spawn((
        Camera2d,
        Camera {
            order: 2,
            ..default()
        },
        FOREGROUND,
        MainCamera,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    fg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    insert_player_color_materials(&mut commands, &mut materials);

    configure_grid_gizmos(&mut config_store, Some(BACKGROUND));
}

pub fn set_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    const BASE_SPACING_AT_800_PIXELS: f32 = 44.0;

    let Ok(window) = window.single() else {
        return;
    };
    let height = (window.physical_height() as f32) / window.scale_factor();
    let width = (window.physical_width() as f32) / window.scale_factor();
    let factor = ((height.min(width)) / 800.0).min(1.5);
    scale_factor.factor = factor;
    scale_factor.spacing = BASE_SPACING_AT_800_PIXELS * factor;
}

pub fn plugin(app: &mut App) {
    app.insert_resource(ScaleFactor::default())
        .add_systems(PreStartup, setup_graphics)
        .add_systems(
            Update,
            (
                set_scale_factor.in_set(ScaleFactorSet),
                draw_grid.after(ScaleFactorSet),
            ),
        );
}
