use bevy::{
    camera::visibility::RenderLayers,
    prelude::*,
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

/// Human placement “settle” scale-in.
pub const PLACE_ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(320);

/// Boops, graduation removes, off-board glide.
pub const PIECE_MOVE_ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(400);

/// Pause after human move before AI search / AI piece animation.
pub const AI_TURN_DELAY: std::time::Duration = std::time::Duration::from_millis(550);

/// Fraction of cell width used for hover/pick (higher = easier cell-to-cell jumps).
pub const CELL_PICK_RADIUS_FRAC: f32 = 0.62;

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
}

impl ScaleFactor {
    /// Center of the board cell `(x, y)` in world space (chess-style cells, not line intersections).
    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        let half = BOARD_SIZE as f32 / 2.0;
        Vec3::new(
            (coord.x as f32 + 0.5 - half) * self.spacing,
            (half - coord.y as f32 - 0.5) * self.spacing,
            0.,
        )
    }

    /// Half-width/height of the square board in world units.
    pub fn board_half_extent(&self) -> f32 {
        BOARD_SIZE as f32 / 2.0 * self.spacing
    }

    /// Pick the cell whose interior contains `world`, if any.
    pub fn coord_at_world(&self, world: Vec2) -> Option<Coord> {
        let max_dist_sq = (self.spacing * CELL_PICK_RADIUS_FRAC).powi(2);

        (0..BOARD_SIZE as u8)
            .flat_map(|y| (0..BOARD_SIZE as u8).map(move |x| Coord { x, y }))
            .filter(|coord| {
                let center = self.screen_point(*coord).truncate();
                (center - world).length_squared() <= max_dist_sq
            })
            .min_by(|a, b| {
                let da = (self.screen_point(*a).truncate() - world).length_squared();
                let db = (self.screen_point(*b).truncate() - world).length_squared();
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cell_centers_sit_inside_squares_not_on_grid_crossings() {
        let sf = ScaleFactor {
            spacing: 10.0,
            factor: 1.0,
        };
        let half = sf.board_half_extent();
        let c00 = sf.screen_point(Coord::new(0, 0));
        assert!((c00.x - (-half + 5.0)).abs() < 0.001);
        assert!((c00.y - (half - 5.0)).abs() < 0.001);

        let c55 = sf.screen_point(Coord::new(5, 5));
        assert!((c55.x - (half - 5.0)).abs() < 0.001);
        assert!((c55.y - (-half + 5.0)).abs() < 0.001);
    }

    #[test]
    fn coord_at_world_inverts_cell_center() {
        let sf = ScaleFactor {
            spacing: 10.0,
            factor: 1.0,
        };
        let coord = Coord::new(2, 3);
        let world = sf.screen_point(coord).truncate();
        assert_eq!(sf.coord_at_world(world), Some(coord));
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
    pub cat_mesh: Handle<Mesh>,
    pub kitten_mesh: Handle<Mesh>,
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
    materials: &PieceMaterials,
    material: Handle<ColorMaterial>,
    kind: PieceKind,
    visibility: Visibility,
) -> impl Bundle {
    let mesh = match kind {
        PieceKind::Cat => materials.cat_mesh.clone(),
        PieceKind::Kitten => materials.kitten_mesh.clone(),
    };
    (
        Mesh2d(mesh),
        MeshMaterial2d(material),
        visibility,
    )
}

fn setup_graphics(
    mut commands: Commands,
    mut config_store: ResMut<GizmoConfigStore>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(ClearColor(COLOR_BACKGROUND));

    commands.spawn((
        Camera2d,
        Camera {
            order: 1,
            ..default()
        },
        BACKGROUND_RENDER_LAYER,
    ));
    // Plain Camera2d on native: HDR + Bloom + MSAA8 has caused hard exits on Intel Iris Xe (Windows).

    let fg_camera = commands.spawn((
        Camera2d,
        Camera {
            order: 2,
            clear_color: ClearColorConfig::None,
            ..default()
        },
        FOREGROUND_RENDER_LAYER,
        MainCamera,
    ));
    let _ = fg_camera;

    commands.insert_resource(PieceMaterials {
        cat_mesh: meshes.add(Circle::new(22.0)),
        kitten_mesh: meshes.add(Rectangle::new(18.0, 22.0)),
        first_kitten: materials.add(COLOR_FIRST),
        first_cat: materials.add(Color::srgb(0.85, 0.42, 0.08)),
        first_ghost: materials.add(COLOR_FIRST_TRANSPARENT),
        second_kitten: materials.add(COLOR_SECOND),
        second_cat: materials.add(Color::srgb(0.55, 0.58, 0.62)),
    });

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.render_layers = BACKGROUND_RENDER_LAYER;
}

fn init_scale_factor(mut scale_factor: ResMut<ScaleFactor>, window: Query<&Window, With<PrimaryWindow>>) {
    set_scale_factor_inner(&mut scale_factor, &window);
}

fn set_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    set_scale_factor_inner(&mut scale_factor, &window);
}

fn set_scale_factor_inner(
    scale_factor: &mut ScaleFactor,
    window: &Query<&Window, With<PrimaryWindow>>,
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
        .add_systems(PostStartup, init_scale_factor)
        .add_systems(
            Update,
            (
                set_scale_factor.in_set(ScaleFactorSet),
                draw_grid.after(ScaleFactorSet),
            ),
        );
}
