use std::time::Duration;

use bevy::prelude::*;
use boop::{Coord, LineHighlight, BOARD_SIZE};

use crate::graphics::{ScaleFactor, ScaleFactorSet};

pub const LINE_FEEDBACK_DURATION: Duration = Duration::from_millis(1600);

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

    let pulse = (feedback.timer.elapsed_secs() * 6.0).sin() * 0.5 + 0.5;
    let color = match feedback.highlight {
        LineHighlight::Graduation(_) => Color::srgba(0.95, 0.85, 0.2, 0.35 + 0.35 * pulse),
        LineHighlight::Win(_) => Color::srgba(0.2, 0.95, 0.45, 0.4 + 0.4 * pulse),
        LineHighlight::EightCatsOnBed => Color::srgba(0.95, 0.55, 0.15, 0.25 + 0.25 * pulse),
    };

    match feedback.highlight {
        LineHighlight::Graduation(cells) | LineHighlight::Win(cells) => {
            for coord in cells {
                draw_cell_highlight(&mut gizmos, &scale_factor, coord, color);
            }
            let a = scale_factor.screen_point(cells[0]);
            let c = scale_factor.screen_point(cells[2]);
            gizmos.line(a, c, color.with_alpha(0.9));
        }
        LineHighlight::EightCatsOnBed => {
            let last = (BOARD_SIZE - 1) as u8;
            for coord in [
                Coord::new(0, 0),
                Coord::new(last, 0),
                Coord::new(last, last),
                Coord::new(0, last),
            ] {
                draw_cell_highlight(&mut gizmos, &scale_factor, coord, color);
            }
        }
    }
}

fn draw_cell_highlight(
    gizmos: &mut Gizmos,
    scale_factor: &ScaleFactor,
    coord: Coord,
    color: Color,
) {
    let center = scale_factor.screen_point(coord).truncate();
    let half = scale_factor.spacing * 0.44;
    let corners = [
        center + Vec2::new(-half, -half),
        center + Vec2::new(half, -half),
        center + Vec2::new(half, half),
        center + Vec2::new(-half, half),
    ];
    for i in 0..4 {
        let a = corners[i].extend(0.0);
        let b = corners[(i + 1) % 4].extend(0.0);
        gizmos.line(a, b, color);
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
