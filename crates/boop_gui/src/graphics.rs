use abstract_gui_theme::configure_grid_gizmos;
use bevy::{
    camera::visibility::RenderLayers,
    ecs::{query::QueryFilter, system::EntityCommands},
    prelude::*,
    window::PrimaryWindow,
};
use boop::{BOARD_SIZE, Coord, Piece, PieceKind, Player};

use crate::grid::draw_grid;

/// Warm stage around the quilt — dark enough that light HUD text still reads.
pub const STAGE: Color = Color::srgb(0.12, 0.10, 0.08);
/// Bed frame / darker quilt binding.
pub const BED_FRAME: Color = Color::srgb(0.42, 0.32, 0.22);
/// Quilt squares (warm mid-tone so charcoal pieces are not lost).
pub const QUILT_LIGHT: Color = Color::srgb(0.84, 0.76, 0.62);
pub const QUILT_DARK: Color = Color::srgb(0.74, 0.64, 0.50);
pub const QUILT_STITCH: Color = Color::srgb(0.38, 0.30, 0.22);

/// Human / first player: charcoal fills, cream rim + warm glow.
pub const FIRST_KITTEN: Color = Color::srgb(0.10, 0.08, 0.07);
pub const FIRST_CAT: Color = Color::srgb(0.26, 0.20, 0.15);
pub const FIRST_GHOST: Color = Color::srgba(0.12, 0.10, 0.08, 0.42);
pub const DARK_RIM: Color = Color::srgb(0.97, 0.93, 0.84);
pub const DARK_GLOW: Color = Color::srgba(0.95, 0.78, 0.38, 0.50);

/// AI / second player: ivory fills, espresso rim (readable on the linen bed).
pub const SECOND_KITTEN: Color = Color::srgb(0.93, 0.90, 0.84);
pub const SECOND_CAT: Color = Color::srgb(0.99, 0.97, 0.93);
pub const LIGHT_RIM: Color = Color::srgb(0.20, 0.16, 0.12);

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

/// Human placement “settle” scale-in.
pub const PLACE_ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(480);

/// Boop displacement glide (cell to cell).
pub const BOOP_GLIDE_ANIMATION_DURATION: std::time::Duration =
    std::time::Duration::from_millis(580);

/// Graduation: kittens shrink off the three highlighted cells.
pub const GRADUATION_SHRINK_ANIMATION_DURATION: std::time::Duration =
    std::time::Duration::from_millis(540);

/// Piece pushed off the bed.
pub const OFF_BOARD_ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(680);

/// Pause after human move before AI search / AI piece animation.
pub const AI_TURN_DELAY: std::time::Duration = std::time::Duration::from_millis(600);

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
    pub dark_rim: Handle<ColorMaterial>,
    pub dark_glow: Handle<ColorMaterial>,
    pub light_rim: Handle<ColorMaterial>,
}

#[derive(Component, Clone, Copy, PartialEq, Eq)]
pub enum PieceHalo {
    Rim,
    Glow,
}

#[derive(Component)]
struct QuiltSquare {
    x: u8,
    y: u8,
}

#[derive(Component)]
struct QuiltFrame;

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
    (Mesh2d(mesh), MeshMaterial2d(material), visibility)
}

fn shape_mesh(materials: &PieceMaterials, kind: PieceKind) -> Handle<Mesh> {
    match kind {
        PieceKind::Cat => materials.cat_mesh.clone(),
        PieceKind::Kitten => materials.kitten_mesh.clone(),
    }
}

fn halo_materials(
    materials: &PieceMaterials,
    piece: Piece,
) -> (Handle<ColorMaterial>, Option<Handle<ColorMaterial>>) {
    match piece.player {
        Player::First => (
            materials.dark_rim.clone(),
            Some(materials.dark_glow.clone()),
        ),
        Player::Second => (materials.light_rim.clone(), None),
    }
}

/// Cream / espresso outline (and a warm glow for charcoal pieces) as children so
/// tweens on the piece transform keep the rim locked to the body.
pub fn attach_piece_halos(entity: &mut EntityCommands, materials: &PieceMaterials, piece: Piece) {
    let mesh = shape_mesh(materials, piece.kind);
    let (rim, glow) = halo_materials(materials, piece);
    entity.with_children(|children| {
        if let Some(glow) = glow {
            children.spawn((
                Mesh2d(mesh.clone()),
                MeshMaterial2d(glow),
                Transform::from_xyz(0.0, 0.0, -0.2).with_scale(Vec3::splat(1.42)),
                FOREGROUND_RENDER_LAYER,
                PieceHalo::Glow,
            ));
        }
        children.spawn((
            Mesh2d(mesh),
            MeshMaterial2d(rim),
            Transform::from_xyz(0.0, 0.0, -0.1).with_scale(Vec3::splat(1.20)),
            FOREGROUND_RENDER_LAYER,
            PieceHalo::Rim,
        ));
    });
}

pub fn retarget_piece_halos<F: QueryFilter>(
    children: Option<&Children>,
    halo_q: &mut Query<(&PieceHalo, &mut Mesh2d, &mut MeshMaterial2d<ColorMaterial>), F>,
    materials: &PieceMaterials,
    piece: Piece,
) {
    let Some(children) = children else {
        return;
    };
    let mesh = shape_mesh(materials, piece.kind);
    let (rim, glow) = halo_materials(materials, piece);
    for child in children.iter() {
        let Ok((halo, mut child_mesh, mut child_mat)) = halo_q.get_mut(child) else {
            continue;
        };
        child_mesh.0 = mesh.clone();
        child_mat.0 = match *halo {
            PieceHalo::Rim => rim.clone(),
            PieceHalo::Glow => glow.clone().unwrap_or_else(|| rim.clone()),
        };
    }
}

fn setup_graphics(
    mut commands: Commands,
    mut config_store: ResMut<GizmoConfigStore>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(ClearColor(STAGE));

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

    let cell_mesh = meshes.add(Rectangle::new(1.0, 1.0));
    let quilt_a = materials.add(QUILT_LIGHT);
    let quilt_b = materials.add(QUILT_DARK);
    commands.spawn((
        Mesh2d(cell_mesh.clone()),
        MeshMaterial2d(materials.add(BED_FRAME)),
        Transform::from_xyz(0.0, 0.0, -0.2),
        BACKGROUND_RENDER_LAYER,
        QuiltFrame,
    ));
    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            let fill = if (x + y) % 2 == 0 {
                quilt_a.clone()
            } else {
                quilt_b.clone()
            };
            commands.spawn((
                Mesh2d(cell_mesh.clone()),
                MeshMaterial2d(fill),
                Transform::from_xyz(0.0, 0.0, -0.1),
                BACKGROUND_RENDER_LAYER,
                QuiltSquare { x, y },
            ));
        }
    }

    commands.insert_resource(PieceMaterials {
        cat_mesh: meshes.add(Circle::new(24.0)),
        kitten_mesh: meshes.add(Rectangle::new(16.0, 22.0)),
        first_kitten: materials.add(FIRST_KITTEN),
        first_cat: materials.add(FIRST_CAT),
        first_ghost: materials.add(FIRST_GHOST),
        second_kitten: materials.add(SECOND_KITTEN),
        second_cat: materials.add(SECOND_CAT),
        dark_rim: materials.add(DARK_RIM),
        dark_glow: materials.add(DARK_GLOW),
        light_rim: materials.add(LIGHT_RIM),
    });

    configure_grid_gizmos(&mut config_store, Some(BACKGROUND_RENDER_LAYER));
}

fn sync_quilt(
    scale_factor: Res<ScaleFactor>,
    mut frame: Query<&mut Transform, (With<QuiltFrame>, Without<QuiltSquare>)>,
    mut squares: Query<(&QuiltSquare, &mut Transform), Without<QuiltFrame>>,
) {
    if let Ok(mut transform) = frame.single_mut() {
        let size = scale_factor.board_half_extent() * 2.0 + scale_factor.spacing * 0.28;
        transform.scale = Vec3::new(size, size, 1.0);
        transform.translation.z = -0.2;
    }
    for (cell, mut transform) in squares.iter_mut() {
        transform.translation = scale_factor.screen_point(Coord {
            x: cell.x,
            y: cell.y,
        });
        transform.translation.z = -0.1;
        let size = scale_factor.spacing * 0.98;
        transform.scale = Vec3::new(size, size, 1.0);
    }
}

fn init_scale_factor(
    mut scale_factor: ResMut<ScaleFactor>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
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
                sync_quilt.after(ScaleFactorSet),
                draw_grid.after(ScaleFactorSet).after(sync_quilt),
            ),
        );
}

#[cfg(test)]
fn srgb_luma(color: Color) -> f32 {
    let c = color.to_srgba();
    0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue
}

#[cfg(test)]
mod contrast_tests {
    use super::*;

    #[test]
    fn charcoal_pieces_contrast_against_the_quilt() {
        let quilt = srgb_luma(QUILT_LIGHT).max(srgb_luma(QUILT_DARK));
        assert!(
            quilt - srgb_luma(FIRST_KITTEN) > 0.45,
            "dark kittens must sit well below the linen bed"
        );
        assert!(
            quilt - srgb_luma(FIRST_CAT) > 0.30,
            "dark cats must sit well below the linen bed"
        );
        assert!(
            srgb_luma(DARK_RIM) - srgb_luma(FIRST_KITTEN) > 0.70,
            "cream rim must separate charcoal pieces from the bed"
        );
    }

    #[test]
    fn ivory_pieces_contrast_against_the_quilt() {
        let quilt = srgb_luma(QUILT_DARK);
        assert!(
            srgb_luma(SECOND_CAT) - quilt > 0.12,
            "ivory cats need a lighter fill than the darker quilt square"
        );
        assert!(
            srgb_luma(SECOND_KITTEN) - srgb_luma(LIGHT_RIM) > 0.55,
            "espresso rim must outline ivory pieces"
        );
    }

    #[test]
    fn kitten_and_cat_fills_differ_for_each_player() {
        assert!((srgb_luma(FIRST_CAT) - srgb_luma(FIRST_KITTEN)).abs() > 0.05);
        assert!((srgb_luma(SECOND_CAT) - srgb_luma(SECOND_KITTEN)).abs() > 0.03);
    }
}
