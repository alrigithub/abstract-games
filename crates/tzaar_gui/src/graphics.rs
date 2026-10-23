use abstract_gui_theme::{apply_stage_clear_color, configure_grid_gizmos, BACKGROUND, FOREGROUND};
use bevy::{
    prelude::*,
    render::view::NoIndirectDrawing,
    window::PrimaryWindow,
};

use crate::grid::draw_grid;

pub use abstract_gui_theme::{
    BACKGROUND as BACKGROUND_RENDER_LAYER, FOREGROUND as FOREGROUND_RENDER_LAYER,
};

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
    pub fn screen_point(&self, coord: tzaar::Coord) -> Vec3 {
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
        for coord in tzaar::all_playable_coords() {
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

fn setup_graphics(mut commands: Commands, mut config_store: ResMut<GizmoConfigStore>) {
    apply_stage_clear_color(&mut commands);

    commands.spawn((
        Camera2d,
        Camera {
            order: 1,
            ..default()
        },
        BACKGROUND,
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
        FOREGROUND,
        NoIndirectDrawing,
    ));

    configure_grid_gizmos(&mut config_store, Some(BACKGROUND));
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
