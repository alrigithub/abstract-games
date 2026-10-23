use abstract_gui_theme::{
    ai_variant, apply_stage_clear_color, cap_accent, configure_grid_gizmos, human_ghost_alpha,
    human_variant, insert_player_color_materials, BACKGROUND, FOREGROUND,
};
use bevy::prelude::*;
use bevy::window::PrimaryWindow;
#[cfg(not(target_arch = "wasm32"))]
use bevy::{post_process::bloom::Bloom, render::view::Hdr};
use tak::{BOARD_SIZE, Coord, Player, StoneKind};

use crate::grid::draw_grid;

pub use abstract_gui_theme::{
    BACKGROUND as BACKGROUND_RENDER_LAYER, FOREGROUND as FOREGROUND_RENDER_LAYER,
};

pub const ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(500);

pub const CELL_PICK_RADIUS_FRAC: f32 = 0.62;

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
}

impl ScaleFactor {
    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        let half = BOARD_SIZE as f32 / 2.0;
        Vec3::new(
            (coord.x as f32 + 0.5 - half) * self.spacing,
            (half - coord.y as f32 - 0.5) * self.spacing,
            0.,
        )
    }

    pub fn board_half_extent(&self) -> f32 {
        BOARD_SIZE as f32 / 2.0 * self.spacing
    }

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

impl Default for ScaleFactor {
    fn default() -> Self {
        Self {
            spacing: 72.0,
            factor: 1.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coord_at_world_inverts_cell_center() {
        let sf = ScaleFactor {
            spacing: 72.0,
            factor: 1.0,
        };
        let coord = Coord { x: 2, y: 3 };
        let world = sf.screen_point(coord).truncate();
        assert_eq!(sf.coord_at_world(world), Some(coord));
    }

    #[test]
    fn cell_center_hits_easier_than_old_grid_crossing() {
        let sf = ScaleFactor {
            spacing: 72.0,
            factor: 1.0,
        };
        let half = sf.board_half_extent();
        let between_cells = Vec2::new(-half + sf.spacing * 2.5, half - sf.spacing * 2.5);
        assert_eq!(sf.coord_at_world(between_cells), Some(Coord { x: 2, y: 2 }));
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
            clear_color: ClearColorConfig::None,
            ..default()
        },
        FOREGROUND,
        MainCamera,
    ));
    #[cfg(not(target_arch = "wasm32"))]
    fg_camera.insert((Hdr, Bloom::default(), Msaa::Sample8));

    let base = insert_player_color_materials(&mut commands, &mut materials);

    commands.insert_resource(PieceMaterials {
        human_flat: base.human.clone(),
        human_wall: materials.add(human_variant(0.85)),
        human_cap: materials.add(cap_accent()),
        human_ghost: materials.add(human_ghost_alpha(0.35)),
        human_highlighted: base.human_highlighted.clone(),
        ai_flat: base.ai.clone(),
        ai_wall: materials.add(ai_variant(0.75)),
        ai_cap: materials.add(cap_accent()),
    });

    configure_grid_gizmos(&mut config_store, Some(BACKGROUND));
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
