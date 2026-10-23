use std::time::Duration;

use bevy::math::{Isometry2d, Rot2};
use bevy::prelude::*;
use boop::{Coord, LineHighlight, BOARD_SIZE};

use crate::graphics::{ScaleFactor, ScaleFactorSet};

/// Keep highlights visible through graduation shrink + a short beat afterward.
pub const LINE_FEEDBACK_DURATION: Duration = Duration::from_millis(2400);

#[derive(Resource)]
pub struct ActiveLineFeedback {
    pub highlight: LineHighlight,
    pub timer: Timer,
}

#[derive(Message, Clone, Copy)]
pub struct LineCompletedEvent(pub LineHighlight);

fn on_line_completed(mut events: MessageReader<LineCompletedEvent>, mut commands: Commands) {
    for LineCompletedEvent(highlight) in events.read() {
        commands.insert_resource(ActiveLineFeedback {
            highlight: *highlight,
            timer: Timer::new(LINE_FEEDBACK_DURATION, TimerMode::Once),
        });
    }
}

fn tick_line_feedback(
    time: Res<Time>,
    mut feedback: Option<ResMut<ActiveLineFeedback>>,
    mut commands: Commands,
) {
    let Some(ref mut feedback) = feedback else {
        return;
    };
    feedback.timer.tick(time.delta());
    if feedback.timer.is_finished() {
        commands.remove_resource::<ActiveLineFeedback>();
    }
}

fn draw_line_feedback(
    mut gizmos: Gizmos,
    scale_factor: Res<ScaleFactor>,
    feedback: Option<Res<ActiveLineFeedback>>,
) {
    let Some(feedback) = feedback else {
        return;
    };

    let t = feedback.timer.elapsed_secs();
    let pulse = (t * 3.5).sin() * 0.5 + 0.5;
    let fade = (1.0 - feedback.timer.fraction()).max(0.0);
    let strength = 0.65 + 0.35 * pulse;

    match feedback.highlight {
        LineHighlight::Graduation(cells) => {
            let fill = Color::srgba(1.0, 0.88, 0.15, (0.38 + 0.32 * strength) * fade);
            let border = Color::srgba(1.0, 0.95, 0.45, (0.85 + 0.15 * pulse) * fade);
            for coord in cells {
                draw_cell_glow(&mut gizmos, &scale_factor, coord, fill, border);
            }
            draw_win_connector(
                &mut gizmos,
                &scale_factor,
                cells,
                Color::srgba(1.0, 0.92, 0.35, 0.95 * fade),
            );
        }
        LineHighlight::Win(cells) => {
            let fill = Color::srgba(0.15, 0.95, 0.55, (0.35 + 0.35 * strength) * fade);
            let border = Color::srgba(0.35, 1.0, 0.65, (0.9 + 0.1 * pulse) * fade);
            for coord in cells {
                draw_cell_glow(&mut gizmos, &scale_factor, coord, fill, border);
            }
            draw_win_connector(
                &mut gizmos,
                &scale_factor,
                cells,
                Color::srgba(0.25, 1.0, 0.55, 0.95 * fade),
            );
        }
        LineHighlight::EightCatsOnBed => {
            let fill = Color::srgba(0.95, 0.55, 0.15, (0.28 + 0.22 * strength) * fade);
            let border = Color::srgba(1.0, 0.7, 0.25, (0.75 + 0.25 * pulse) * fade);
            let last = (BOARD_SIZE - 1) as u8;
            for coord in [
                Coord::new(0, 0),
                Coord::new(last, 0),
                Coord::new(last, last),
                Coord::new(0, last),
            ] {
                draw_cell_glow(&mut gizmos, &scale_factor, coord, fill, border);
            }
        }
    }
}

fn draw_cell_glow(
    gizmos: &mut Gizmos,
    scale_factor: &ScaleFactor,
    coord: Coord,
    fill: Color,
    border: Color,
) {
    let center = scale_factor.screen_point(coord).truncate();
    let half = scale_factor.spacing * 0.46;
    let size = Vec2::splat(half * 2.0);
    let iso = Isometry2d::new(center, Rot2::IDENTITY);

    let inner = half * 0.9;
    for i in -5..=5 {
        let y = center.y + (i as f32 / 5.0) * inner;
        gizmos.line_2d(
            Vec2::new(center.x - inner, y),
            Vec2::new(center.x + inner, y),
            fill,
        );
    }

    gizmos.rect_2d(iso, size, border);
    gizmos.rect_2d(
        Isometry2d::new(center, Rot2::IDENTITY),
        size * 0.88,
        border.with_alpha(border.alpha() * 0.55),
    );
}

fn draw_win_connector(
    gizmos: &mut Gizmos,
    scale_factor: &ScaleFactor,
    cells: [Coord; 3],
    color: Color,
) {
    let a = scale_factor.screen_point(cells[0]).truncate();
    let c = scale_factor.screen_point(cells[2]).truncate();
    let dir = (c - a).normalize_or_zero();
    let perp = Vec2::new(-dir.y, dir.x);
    for offset in [-2.8, 0.0, 2.8] {
        let shift = perp * offset;
        gizmos.line_2d(a + shift, c + shift, color);
    }
}

pub fn plugin(app: &mut App) {
    app.add_message::<LineCompletedEvent>()
        .add_systems(Update, on_line_completed)
        .add_systems(
            Update,
            (
                tick_line_feedback,
                draw_line_feedback.after(ScaleFactorSet),
            ),
        );
}
