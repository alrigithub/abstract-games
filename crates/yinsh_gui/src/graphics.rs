use std::time::Duration;

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

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

/// Hub visual tokens (flat geometric; no mauve shell theme).
pub const COLOR_STAGE_BG: Color = Color::srgb(0x0d as f32 / 255., 0x0d as f32 / 255., 0x0d as f32 / 255.);
pub const COLOR_BOARD_FILL: Color = Color::srgb(0xe8 as f32 / 255., 0xe4 as f32 / 255., 0xdc as f32 / 255.);
pub const COLOR_GRID: Color = Color::srgb(0x5c as f32 / 255., 0x56 as f32 / 255., 0x4c as f32 / 255.);
pub const COLOR_BACKGROUND: Color = COLOR_STAGE_BG;

pub const COLOR_RING_MOVEMENT_INDICATOR: Color = Color::srgba(0.23, 0.51, 0.96, 0.25);

pub const COLOR_WIN_GLOW: Color = Color::srgb(0x3b as f32 / 255., 0x82 as f32 / 255., 0xf6 as f32 / 255.);

/// Player A (human)
pub const COLOR_HUMAN: Color = Color::srgb(0x11 as f32 / 255., 0x11 as f32 / 255., 0x11 as f32 / 255.);
pub const COLOR_HUMAN_HIGHLIGHTED: Color = Color::srgb(0.35, 0.35, 0.35);
pub const COLOR_HUMAN_TRANSPARENT: Color = Color::srgba(0x11 as f32 / 255., 0x11 as f32 / 255., 0x11 as f32 / 255., 0.25);

/// Player B (AI) — light fill with dark stroke on ring mesh
pub const COLOR_AI: Color = Color::srgb(0xf5 as f32 / 255., 0xf5 as f32 / 255., 0xf5 as f32 / 255.);
pub const COLOR_AI_STROKE: Color = Color::srgb(0x22 as f32 / 255., 0x22 as f32 / 255., 0x22 as f32 / 255.);

pub fn color_for_player(player: Player) -> Color {
    if player == PLAYER_HUMAN {
        COLOR_HUMAN
    } else {
        COLOR_AI
    }
}

pub const ANIMATION_DURATION: Duration = Duration::from_millis(500);

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
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
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

#[derive(Resource)]
pub struct PlayerColors {
    pub human: Handle<ColorMaterial>,
    pub human_highlighted: Handle<ColorMaterial>,
    pub human_transparent: Handle<ColorMaterial>,
    pub ai: Handle<ColorMaterial>,
    pub ai_stroke: Handle<ColorMaterial>,
    pub animated_markers: [Handle<ColorMaterial>; 8],
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
    let mut ring = commands.spawn((
        BoardElement(coord, player),
        Ring,
        Visibility::Visible,
        FOREGROUND_RENDER_LAYER,
    ));
    if player == PLAYER_HUMAN {
        ring.insert(ring_mesh(
            meshes,
            player_colors.human.clone(),
            Visibility::Visible,
        ));
    } else {
        ring.with_children(|parent| {
            parent.spawn((
                Mesh2d(meshes.add(Annulus::new(25., 27.))),
                MeshMaterial2d(player_colors.ai_stroke.clone()),
                Visibility::Visible,
            ));
            parent.spawn((
                Mesh2d(meshes.add(Annulus::new(20., 25.))),
                MeshMaterial2d(player_colors.ai.clone()),
                Visibility::Visible,
            ));
        });
    }
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
        FOREGROUND_RENDER_LAYER,
    ));
}

fn setup_graphics(
    mut commands: Commands,
    mut config_store: ResMut<GizmoConfigStore>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(ClearColor(COLOR_BACKGROUND));

    // Render layer 1 is for the grid
    #[cfg_attr(target_arch = "wasm32", allow(unused_mut, unused_variables))]
    let mut bg_camera = commands.spawn((
        Camera2d,
        Camera {
            order: 1,
            ..default()
        },
        BACKGROUND_RENDER_LAYER,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    bg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    // Render layer 2 is for the board elements
    #[cfg_attr(target_arch = "wasm32", allow(unused_mut, unused_variables))]
    let mut fg_camera = commands.spawn((
        Camera2d,
        Camera {
            order: 2,
            ..default()
        },
        FOREGROUND_RENDER_LAYER,
        MainCamera,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    fg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    commands.insert_resource(PlayerColors {
        human: materials.add(COLOR_HUMAN),
        human_highlighted: materials.add(COLOR_HUMAN_HIGHLIGHTED),
        human_transparent: materials.add(COLOR_HUMAN_TRANSPARENT),
        ai: materials.add(COLOR_AI),
        ai_stroke: materials.add(COLOR_AI_STROKE),
        animated_markers: [
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
            materials.add(COLOR_HUMAN),
        ],
    });

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.render_layers = BACKGROUND_RENDER_LAYER;
}

pub fn set_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    const BASE_SPACING_AT_800_PIXELS: f32 = 80.0;

    let Ok(window) = window.single() else { return };
    let height = (window.physical_height() as f32) / window.scale_factor();
    let width = (window.physical_width() as f32) / window.scale_factor();
    let factor = ((height.min(width)) / 800.0).min(1.5);
    scale_factor.factor = factor;
    scale_factor.spacing = BASE_SPACING_AT_800_PIXELS * factor;
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
