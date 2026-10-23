use bevy::{camera::visibility::RenderLayers, prelude::*, window::PrimaryWindow};
#[cfg(not(target_arch = "wasm32"))]
use bevy::{post_process::bloom::Bloom, render::view::Hdr};
use tzaar::{Coord, PieceKind, Player, all_playable_coords};

use crate::grid::draw_grid;

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

pub const COLOR_GRID: Color = Color::hsl(0.0, 0.0, 0.28);
pub const COLOR_BACKGROUND: Color = Color::hsl(0.35, 0.2, 0.1);

pub const COLOR_HUMAN: Color = Color::srgb(0.95, 0.92, 0.85);
pub const COLOR_HUMAN_GHOST: Color = Color::srgba(0.95, 0.92, 0.85, 0.35);
pub const COLOR_AI: Color = Color::srgb(0.18, 0.17, 0.2);

pub const ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(500);

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
    origin: Vec2,
}

impl ScaleFactor {
    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        let x = coord.x as f32;
        let y = coord.y as f32;
        let sx = (x - y * 0.5) * self.spacing;
        let sy = -y * self.spacing * 0.866;
        Vec3::new(self.origin.x + sx, self.origin.y + sy, 0.)
    }
}

impl Default for ScaleFactor {
    fn default() -> Self {
        let spacing = 58.0;
        let mut min_x = f32::MAX;
        let mut max_x = f32::MIN;
        let mut min_y = f32::MAX;
        let mut max_y = f32::MIN;
        for coord in all_playable_coords() {
            let x = (coord.x as f32 - coord.y as f32 * 0.5) * spacing;
            let y = -coord.y as f32 * spacing * 0.866;
            min_x = min_x.min(x);
            max_x = max_x.max(x);
            min_y = min_y.min(y);
            max_y = max_y.max(y);
        }
        let origin = Vec2::new(-(min_x + max_x) / 2.0, -(min_y + max_y) / 2.0);
        Self {
            spacing,
            factor: 1.0,
            origin,
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

#[derive(Resource)]
pub struct PieceMaterials {
    pub human_tzaar: Handle<ColorMaterial>,
    pub human_tzarra: Handle<ColorMaterial>,
    pub human_tott: Handle<ColorMaterial>,
    pub human_ghost: Handle<ColorMaterial>,
    pub ai_tzaar: Handle<ColorMaterial>,
    pub ai_tzarra: Handle<ColorMaterial>,
    pub ai_tott: Handle<ColorMaterial>,
}

pub fn material_for(
    materials: &PieceMaterials,
    player: Player,
    kind: PieceKind,
) -> Handle<ColorMaterial> {
    match (player, kind) {
        (Player::First, PieceKind::Tzaar) => materials.human_tzaar.clone(),
        (Player::First, PieceKind::Tzarra) => materials.human_tzarra.clone(),
        (Player::First, PieceKind::Tott) => materials.human_tott.clone(),
        (Player::Second, PieceKind::Tzaar) => materials.ai_tzaar.clone(),
        (Player::Second, PieceKind::Tzarra) => materials.ai_tzarra.clone(),
        (Player::Second, PieceKind::Tott) => materials.ai_tott.clone(),
    }
}

pub fn piece_mesh(
    meshes: &mut Assets<Mesh>,
    material: Handle<ColorMaterial>,
    kind: PieceKind,
    visibility: Visibility,
) -> impl Bundle {
    let radius = match kind {
        PieceKind::Tzaar => 22.0,
        PieceKind::Tzarra => 17.0,
        PieceKind::Tott => 13.0,
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
        MainCamera,
        FOREGROUND_RENDER_LAYER,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    fg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    let human = COLOR_HUMAN;
    let ai = COLOR_AI;
    commands.insert_resource(PieceMaterials {
        human_tzaar: materials.add(ColorMaterial::from(human)),
        human_tzarra: materials.add(ColorMaterial::from(human.with_alpha(0.92))),
        human_tott: materials.add(ColorMaterial::from(human.with_alpha(0.84))),
        human_ghost: materials.add(ColorMaterial::from(COLOR_HUMAN_GHOST)),
        ai_tzaar: materials.add(ColorMaterial::from(ai)),
        ai_tzarra: materials.add(ColorMaterial::from(ai.with_alpha(0.92))),
        ai_tott: materials.add(ColorMaterial::from(ai.with_alpha(0.84))),
    });

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.line.width = 2.0;
}

fn resize_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let width = window.resolution.width();
    let height = window.resolution.height();
    let target = (width.min(height) * 0.85) / 520.0;
    scale_factor.factor = target.clamp(0.65, 1.35);
}

pub fn plugin(app: &mut App) {
    app.init_resource::<ScaleFactor>()
        .add_systems(Startup, setup_graphics)
        .add_systems(
            Update,
            (resize_scale_factor.in_set(ScaleFactorSet), draw_grid),
        );
}
