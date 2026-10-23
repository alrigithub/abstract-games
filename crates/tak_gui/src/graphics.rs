use bevy::{camera::visibility::RenderLayers, prelude::*, window::PrimaryWindow};
#[cfg(not(target_arch = "wasm32"))]
use bevy::{post_process::bloom::Bloom, render::view::Hdr};
use tak::{BOARD_SIZE, Coord, Player, StoneKind};

use crate::grid::draw_grid;

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

pub const COLOR_GRID: Color = Color::hsl(0.0, 0.0, 0.25);
pub const COLOR_BACKGROUND: Color = Color::hsl(0.0, 0.0, 0.05);

pub const COLOR_HUMAN: Color = Color::srgb(0.94, 0.91, 0.82);
pub const COLOR_HUMAN_GHOST: Color = Color::srgba(0.94, 0.91, 0.82, 0.35);
pub const COLOR_AI: Color = Color::srgb(0.22, 0.2, 0.18);
pub const COLOR_CAP_RING: Color = Color::srgb(0.85, 0.55, 0.2);

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
            spacing: 72.0,
            factor: 1.0,
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

#[derive(Resource)]
pub struct PieceMaterials {
    pub human_flat: Handle<ColorMaterial>,
    pub human_wall: Handle<ColorMaterial>,
    pub human_cap: Handle<ColorMaterial>,
    pub human_ghost: Handle<ColorMaterial>,
    pub ai_flat: Handle<ColorMaterial>,
    pub ai_wall: Handle<ColorMaterial>,
    pub ai_cap: Handle<ColorMaterial>,
}

pub fn material_for(
    materials: &PieceMaterials,
    player: Player,
    kind: StoneKind,
) -> Handle<ColorMaterial> {
    match (player, kind) {
        (Player::First, StoneKind::Flat) => materials.human_flat.clone(),
        (Player::First, StoneKind::Wall) => materials.human_wall.clone(),
        (Player::First, StoneKind::Cap) => materials.human_cap.clone(),
        (Player::Second, StoneKind::Flat) => materials.ai_flat.clone(),
        (Player::Second, StoneKind::Wall) => materials.ai_wall.clone(),
        (Player::Second, StoneKind::Cap) => materials.ai_cap.clone(),
    }
}

fn piece_dimensions(kind: StoneKind) -> (f32, f32) {
    match kind {
        StoneKind::Flat => (26.0, 10.0),
        StoneKind::Wall => (18.0, 28.0),
        StoneKind::Cap => (28.0, 12.0),
    }
}

pub fn piece_mesh2d(meshes: &mut Assets<Mesh>, kind: StoneKind) -> Mesh2d {
    let (w, h) = piece_dimensions(kind);
    Mesh2d(meshes.add(Rectangle::new(w, h)))
}

pub fn piece_mesh(
    meshes: &mut Assets<Mesh>,
    material: Handle<ColorMaterial>,
    kind: StoneKind,
    visibility: Visibility,
) -> impl Bundle {
    (
        piece_mesh2d(meshes, kind),
        MeshMaterial2d(material),
        visibility,
    )
}

fn setup_graphics(
    mut commands: Commands,
    mut config_store: ResMut<GizmoConfigStore>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(ClearColor(COLOR_BACKGROUND));

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

    commands.insert_resource(PieceMaterials {
        human_flat: materials.add(COLOR_HUMAN),
        human_wall: materials.add(Color::srgb(0.78, 0.74, 0.65)),
        human_cap: materials.add(COLOR_CAP_RING),
        human_ghost: materials.add(COLOR_HUMAN_GHOST),
        ai_flat: materials.add(COLOR_AI),
        ai_wall: materials.add(Color::srgb(0.35, 0.32, 0.28)),
        ai_cap: materials.add(COLOR_CAP_RING),
    });

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.render_layers = BACKGROUND_RENDER_LAYER;
}

pub fn set_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    const BASE_SPACING_AT_800_PIXELS: f32 = 72.0;

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
