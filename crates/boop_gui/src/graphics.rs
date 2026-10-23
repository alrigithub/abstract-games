use bevy::{
    camera::visibility::RenderLayers,
    post_process::bloom::Bloom,
    prelude::*,
    render::view::Hdr,
    window::PrimaryWindow,
};
use boop::{Coord, Piece, PieceKind, Player, BOARD_SIZE};

use crate::grid::draw_grid;

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

pub const COLOR_GRID: Color = Color::hsl(0.0, 0.0, 0.28);
pub const COLOR_BACKGROUND: Color = Color::hsl(0.35, 0.25, 0.12);

pub const COLOR_FIRST: Color = Color::srgb(0.95, 0.55, 0.15);
pub const COLOR_FIRST_TRANSPARENT: Color = Color::srgba(0.95, 0.55, 0.15, 0.35);
pub const COLOR_SECOND: Color = Color::srgb(0.75, 0.78, 0.82);

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
            spacing: 52.0,
            factor: 1.0,
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

#[derive(Resource)]
pub struct PieceMaterials {
    pub first_kitten: Handle<ColorMaterial>,
    pub first_cat: Handle<ColorMaterial>,
    pub first_ghost: Handle<ColorMaterial>,
    pub second_kitten: Handle<ColorMaterial>,
    pub second_cat: Handle<ColorMaterial>,
}

pub fn material_for(materials: &PieceMaterials, piece: Piece) -> Handle<ColorMaterial> {
    match (piece.player, piece.kind) {
        (Player::First, PieceKind::Kitten) => materials.first_kitten.clone(),
        (Player::First, PieceKind::Cat) => materials.first_cat.clone(),
        (Player::Second, PieceKind::Kitten) => materials.second_kitten.clone(),
        (Player::Second, PieceKind::Cat) => materials.second_cat.clone(),
    }
}

pub fn piece_mesh(
    meshes: &mut Assets<Mesh>,
    material: Handle<ColorMaterial>,
    kind: PieceKind,
    visibility: Visibility,
) -> impl Bundle {
    let radius = match kind {
        PieceKind::Kitten => 16.0,
        PieceKind::Cat => 20.0,
    };
    (
        Mesh2d(meshes.add(Circle::new(radius))),
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
        first_kitten: materials.add(COLOR_FIRST),
        first_cat: materials.add(Color::srgb(0.85, 0.42, 0.08)),
        first_ghost: materials.add(COLOR_FIRST_TRANSPARENT),
        second_kitten: materials.add(COLOR_SECOND),
        second_cat: materials.add(Color::srgb(0.55, 0.58, 0.62)),
    });

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.render_layers = BACKGROUND_RENDER_LAYER;
}

pub fn set_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    const BASE_SPACING_AT_800_PIXELS: f32 = 52.0;

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
