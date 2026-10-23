use bevy::{
    camera::visibility::RenderLayers, prelude::*, render::view::NoIndirectDrawing,
    window::PrimaryWindow,
};
use tzaar::Coord;

use crate::grid::draw_grid;

pub const FOREGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(2);
pub const BACKGROUND_RENDER_LAYER: RenderLayers = RenderLayers::layer(1);

pub const COLOR_GRID: Color = Color::srgb(0.42, 0.38, 0.32);
pub const COLOR_INTERSECTION: Color = Color::srgb(0.52, 0.48, 0.40);
pub const COLOR_BACKGROUND: Color = Color::srgb(0.82, 0.76, 0.66);

pub const ANIMATION_DURATION: std::time::Duration = std::time::Duration::from_millis(500);

/// Intersection-to-intersection distance at `factor == 1`.
pub const BASE_SPACING: f32 = 58.0;

/// Outer piece radius as a fraction of intersection spacing (all types share this).
pub const PIECE_RADIUS_FRAC: f32 = 0.40;

#[derive(Component)]
pub struct MainCamera;

#[derive(Resource, Debug, Clone, Copy)]
pub struct ScaleFactor {
    pub spacing: f32,
    pub factor: f32,
    origin: Vec2,
}

/// Flat-top axial layout: vertical columns (`coord.x`), 60° diagonals.
/// Adjacent playable neighbors are exactly `spacing` apart.
pub fn hex_to_pixel(coord: Coord, spacing: f32) -> Vec2 {
    let q = coord.x as f32;
    let r = coord.y as f32;
    let sqrt3 = 3.0_f32.sqrt();
    let size = spacing / sqrt3;
    let px = size * 1.5 * q;
    let py = size * (sqrt3 * 0.5 * q + sqrt3 * r);
    Vec2::new(px, -py)
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
        let mut min_x = f32::MAX;
        let mut max_x = f32::MIN;
        let mut min_y = f32::MAX;
        let mut max_y = f32::MIN;
        for coord in tzaar::all_playable_coords() {
            let p = hex_to_pixel(coord, spacing);
            min_x = min_x.min(p.x);
            max_x = max_x.max(p.x);
            min_y = min_y.min(p.y);
            max_y = max_y.max(p.y);
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
        .add_systems(PreStartup, setup_graphics)
        .add_systems(
            Update,
            (resize_scale_factor.in_set(ScaleFactorSet), draw_grid),
        );
}

#[cfg(test)]
mod tests {
    use super::*;
    use tzaar::{DIRECTIONS, step};

    fn approx(a: f32, b: f32) -> bool {
        (a - b).abs() < 1e-4
    }

    #[test]
    fn neighbors_are_equal_length_at_sixty_degrees() {
        let spacing = 10.0;
        let origin = Coord::new(4, 3);
        let mut vecs = Vec::new();
        for dir in DIRECTIONS {
            let delta = hex_to_pixel(step(origin, dir), spacing) - hex_to_pixel(origin, spacing);
            assert!(
                approx(delta.length(), spacing),
                "dir {dir:?} length {}",
                delta.length()
            );
            vecs.push(delta);
        }
        // Adjacent hex directions differ by 60°.
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
    fn columns_are_vertical() {
        let spacing = 10.0;
        let a = hex_to_pixel(Coord::new(2, 1), spacing);
        let b = hex_to_pixel(Coord::new(2, 3), spacing);
        assert!(approx(a.x, b.x), "same x-column must share pixel x");
        assert!(b.y < a.y, "increasing y walks down the column");
    }
}
