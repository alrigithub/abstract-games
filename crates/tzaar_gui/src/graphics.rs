use bevy::{
    camera::visibility::RenderLayers, prelude::*, render::view::NoIndirectDrawing,
    window::PrimaryWindow,
};
use tzaar::Coord;

use crate::grid::draw_grid;
use crate::hex_layout;

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

pub const COLOR_GRID: Color = Color::srgb(0.42, 0.38, 0.32);
pub const COLOR_INTERSECTION: Color = Color::srgb(0.52, 0.48, 0.40);
pub const COLOR_BACKGROUND: Color = Color::srgb(0.82, 0.76, 0.66);

pub const ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(500);

/// Intersection-to-intersection distance in world units (`factor == 1`).
pub const BASE_SPACING: f32 = 58.0;

pub const PIECE_RADIUS_FRAC: f32 = hex_layout::PIECE_RADIUS_FRAC;

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
    origin: Vec2,
}

pub fn hex_to_pixel(coord: Coord, spacing: f32) -> Vec2 {
    let p = hex_layout::hex_to_pixel(coord, spacing);
    Vec2::new(p.x, p.y)
}

impl ScaleFactor {
    pub fn world_spacing(&self) -> f32 {
        self.spacing * self.factor
    }

    pub fn screen_point(&self, coord: Coord) -> Vec3 {
        let p = hex_to_pixel(coord, self.world_spacing());
        Vec3::new(
            self.origin.x * self.factor + p.x,
            self.origin.y * self.factor + p.y,
            0.,
        )
    }
}

impl Default for ScaleFactor {
    fn default() -> Self {
        let spacing = BASE_SPACING;
        let origin = hex_layout::origin_to_center(spacing);
        Self {
            spacing,
            factor: 1.0,
            origin: Vec2::new(origin.x, origin.y),
        }
    }
}

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ScaleFactorSet;

fn setup_graphics(mut commands: Commands, mut config_store: ResMut<GizmoConfigStore>) {
    commands.insert_resource(ClearColor(COLOR_BACKGROUND));

    commands.spawn((
        Camera2d,
        Camera {
            order: 1,
            ..default()
        },
        BACKGROUND_RENDER_LAYER,
        NoIndirectDrawing,
    ));

    commands.spawn((
        Camera2d,
        Camera {
            order: 2,
            clear_color: ClearColorConfig::None,
            ..default()
        },
        MainCamera,
        FOREGROUND_RENDER_LAYER,
        NoIndirectDrawing,
    ));

    let (config, _) = config_store.config_mut::<DefaultGizmoConfigGroup>();
    config.line.width = 2.25;
    config.render_layers = BACKGROUND_RENDER_LAYER;
}

fn fit_camera_to_board(
    mut scale_factor: ResMut<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    mut q_proj: Query<&mut Projection>,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let width = window.resolution.width();
    let height = window.resolution.height();
    // World layout stays at BASE_SPACING; the camera zooms so the hull + margin fits.
    scale_factor.factor = 1.0;
    let scale = hex_layout::ortho_scale_to_fit(width, height, scale_factor.spacing);
    for mut projection in &mut q_proj {
        if let Projection::Orthographic(ortho) = &mut *projection {
            ortho.scale = scale;
        }
    }
}

pub fn plugin(app: &mut App) {
    app.init_resource::<ScaleFactor>()
        .add_systems(PreStartup, setup_graphics)
        .add_systems(
            Update,
            (fit_camera_to_board.in_set(ScaleFactorSet), draw_grid),
        );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hex_layout::{BOARD_CORNERS, LATTICE_STEPS};
    use tzaar::step;

    fn approx(a: f32, b: f32) -> bool {
        (a - b).abs() < 1e-4
    }

    #[test]
    fn neighbors_are_equal_length_at_sixty_degrees() {
        let spacing = 10.0;
        let origin = Coord::new(4, 3);
        let mut vecs = Vec::new();
        for dir in LATTICE_STEPS {
            let delta = hex_to_pixel(step(origin, dir), spacing) - hex_to_pixel(origin, spacing);
            assert!(
                approx(delta.length(), spacing),
                "dir {dir:?} length {}",
                delta.length()
            );
            vecs.push(delta);
        }
        for v in &vecs {
            let angles: Vec<f32> = vecs
                .iter()
                .map(|w| {
                    let c = (v.dot(*w) / (v.length() * w.length())).clamp(-1.0, 1.0);
                    c.acos().to_degrees()
                })
                .collect();
            assert!(
                angles.iter().any(|a| approx(*a, 60.0)),
                "expected a 60° neighbor of {v:?}, got {angles:?}"
            );
        }
    }

    #[test]
    fn board_corners_are_equidistant_from_centre() {
        let spacing = 10.0;
        let centre = hex_to_pixel(Coord::new(4, 4), spacing);
        let radii: Vec<f32> = BOARD_CORNERS
            .iter()
            .map(|c| (hex_to_pixel(*c, spacing) - centre).length())
            .collect();
        let r0 = radii[0];
        for r in &radii {
            assert!(approx(*r, r0), "radii {radii:?}");
        }
    }
}
