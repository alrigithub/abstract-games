use std::time::Duration;

use abstract_gui_theme::{
    apply_stage_clear_color, configure_grid_gizmos, insert_player_color_materials,
    PlayerColorMaterials, BACKGROUND, FOREGROUND,
};
#[cfg_attr(target_arch = "wasm32", allow(unused_imports))]
use bevy::{
    camera::visibility::RenderLayers, post_process::bloom::Bloom, prelude::*, render::view::Hdr,
    window::PrimaryWindow,
};

use yinsh::{Coord, Player};

use crate::{
    PLAYER_HUMAN,
    board::{BoardElement, Marker, Ring},
    grid::draw_grid,
};

pub use abstract_gui_theme::{
    BACKGROUND as BACKGROUND_RENDER_LAYER, FOREGROUND as FOREGROUND_RENDER_LAYER,
};
pub use abstract_gui_theme::{
    AI as COLOR_AI, GRID_LINE as COLOR_GRID, HUMAN as COLOR_HUMAN,
    HUMAN_GHOST as COLOR_HUMAN_TRANSPARENT, HUMAN_HIGHLIGHTED as COLOR_HUMAN_HIGHLIGHTED,
    RING_MOVEMENT_INDICATOR as COLOR_RING_MOVEMENT_INDICATOR, STAGE as COLOR_BACKGROUND,
    WIN as COLOR_WIN_GLOW,
};

pub const ANIMATION_DURATION: Duration = Duration::from_millis(500);

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
    pub half_width: f32,
}

impl ScaleFactor {
    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        Vec3::new(
            self.spacing * (0.5 * 3_f32.sqrt() * coord.x as f32),
            self.spacing * (-coord.y as f32 + 0.5 * coord.x as f32),
            0.,
        )
    }
}

impl Default for ScaleFactor {
    fn default() -> Self {
        Self {
            spacing: 80.0,
            factor: 1.0,
            half_width: 430.0,
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

pub type PlayerColors = PlayerColorMaterials;

pub fn color_for_player(player: Player) -> Color {
    if player == PLAYER_HUMAN {
        COLOR_HUMAN
    } else {
        COLOR_AI
    }
}

pub fn ring_mesh(
    meshes: &mut Assets<Mesh>,
    color_material: Handle<ColorMaterial>,
    visibility: Visibility,
) -> impl Bundle {
    (
        Mesh2d(meshes.add(Annulus::new(20., 25.))),
        MeshMaterial2d(color_material),
        visibility,
    )
}

pub fn marker_mesh(
    meshes: &mut Assets<Mesh>,
    color_material: Handle<ColorMaterial>,
    visibility: Visibility,
) -> impl Bundle {
    (
        Mesh2d(meshes.add(Circle::new(16.))),
        MeshMaterial2d(color_material),
        visibility,
    )
}

pub fn spawn_ring(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    player_colors: &PlayerColors,
    coord: Coord,
    player: Player,
) {
    let color = if player == PLAYER_HUMAN {
        player_colors.human.clone()
    } else {
        player_colors.ai.clone()
    };

    commands.spawn((
        ring_mesh(meshes, color, Visibility::Visible),
        BoardElement(coord, player),
        Ring,
        FOREGROUND,
    ));
}

pub fn spawn_marker(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    player_colors: &PlayerColors,
    coord: Coord,
    player: Player,
) {
    let color = if player == PLAYER_HUMAN {
        player_colors.human.clone()
    } else {
        player_colors.ai.clone()
    };

    commands.spawn((
        marker_mesh(meshes, color, Visibility::Visible),
        BoardElement(coord, player),
        Marker,
        FOREGROUND,
    ));
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
    const BASE_SPACING_AT_800_PIXELS: f32 = 80.0;

    let Ok(window) = window.single() else {
        return;
    };
    let height = (window.physical_height() as f32) / window.scale_factor();
    let width = (window.physical_width() as f32) / window.scale_factor();
    let factor = (height / 800.0).min(width / 872.0).min(1.5);
    scale_factor.factor = factor;
    scale_factor.spacing = BASE_SPACING_AT_800_PIXELS * factor;
    scale_factor.half_width = width / 2.0;
}

pub fn plugin(app: &mut App) {
    app.insert_resource(ScaleFactor::default())
        .add_systems(PreStartup, (setup_graphics, set_scale_factor))
        .add_systems(
            Update,
            (
                set_scale_factor.in_set(ScaleFactorSet),
                draw_grid.after(ScaleFactorSet),
            ),
        );
}
