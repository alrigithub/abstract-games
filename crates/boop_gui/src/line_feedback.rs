use std::time::Duration;

use bevy::math::Isometry3d;
use bevy::prelude::*;
use boop::{BOARD_SIZE, Coord, LineHighlight, TurnMode};

use crate::graphics::{ScaleFactor, ScaleFactorSet};
use crate::interaction::CursorCoord;
use crate::state_update::{GameState, InteractionState};

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
    mut feedback: ResMut<ActiveLineFeedback>,
    mut commands: Commands,
) {
    feedback.timer.tick(time.delta());
    if feedback.timer.is_finished() {
        commands.remove_resource::<ActiveLineFeedback>();
    }
}

/// Clear graduation/win connectors once the pulse has been seen, or on any click after game end.
fn dismiss_line_on_click(
    mouse: Res<ButtonInput<MouseButton>>,
    feedback: Option<Res<ActiveLineFeedback>>,
    mut commands: Commands,
) {
    let Some(feedback) = feedback else {
        return;
    };
    if !mouse.just_pressed(MouseButton::Left) {
        return;
    }
    if feedback.timer.elapsed() >= Duration::from_millis(300) {
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

/// While a graduation choice is pending, outline every candidate line; the line under the
/// cursor (when it is the human's choice) is drawn solid so the click target is unambiguous.
fn draw_graduation_choices(
    mut gizmos: Gizmos,
    time: Res<Time>,
    scale_factor: Res<ScaleFactor>,
    game_state: Res<GameState>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
) {
    let TurnMode::ChooseGraduation(lines) = game_state.turn_mode() else {
        return;
    };
    if game_state.winner().is_some() {
        return;
    }

    let pulse = (time.elapsed_secs() * 4.0).sin() * 0.5 + 0.5;
    let hovered = if matches!(*interaction_state, InteractionState::HumanChooseGraduation) {
        cursor_coord
            .0
            .and_then(|coord| game_state.graduation_choice_at(coord))
    } else {
        None
    };

    for line in lines {
        let is_hovered = hovered == Some(line);
        let (fill, border, connector) = if is_hovered {
            (
                Color::srgba(1.0, 0.88, 0.15, 0.55 + 0.2 * pulse),
                Color::srgba(1.0, 0.95, 0.45, 1.0),
                Color::srgba(1.0, 0.92, 0.35, 0.95),
            )
        } else {
            (
                Color::srgba(1.0, 0.88, 0.15, 0.10 + 0.08 * pulse),
                Color::srgba(1.0, 0.9, 0.4, 0.55 + 0.25 * pulse),
                Color::srgba(1.0, 0.9, 0.4, 0.45),
            )
        };
        for coord in line {
            draw_cell_glow(&mut gizmos, &scale_factor, coord, fill, border);
        }
        draw_win_connector(&mut gizmos, &scale_factor, line, connector);
    }
}

fn draw_cell_glow(
    gizmos: &mut Gizmos,
    scale_factor: &ScaleFactor,
    coord: Coord,
    fill: Color,
    border: Color,
) {
    let center = scale_factor.screen_point(coord);
    let half = scale_factor.spacing * 0.46;
    let size = Vec2::splat(half * 2.0);
    let iso = Isometry3d::new(center, Quat::IDENTITY);

    let inner = half * 0.9;
    for i in -5..=5 {
        let y = center.y + (i as f32 / 5.0) * inner;
        gizmos.line(
            Vec3::new(center.x - inner, y, center.z),
            Vec3::new(center.x + inner, y, center.z),
            fill,
        );
    }

    gizmos.rect(iso, size, border);
    gizmos.rect(
        Isometry3d::new(center, Quat::IDENTITY),
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
    let a = scale_factor.screen_point(cells[0]);
    let c = scale_factor.screen_point(cells[2]);
    let dir = (c - a).truncate().normalize_or_zero();
    let perp = Vec2::new(-dir.y, dir.x);
    for offset in [-2.8, 0.0, 2.8] {
        let shift = perp * offset;
        gizmos.line(
            a + Vec3::new(shift.x, shift.y, 0.0),
            c + Vec3::new(shift.x, shift.y, 0.0),
            color,
        );
    }
}

pub fn plugin(app: &mut App) {
    app.add_message::<LineCompletedEvent>()
        .add_systems(
            Update,
            on_line_completed.after(crate::state_update::StateUpdateSet),
        )
        .add_systems(
            Update,
            (
                tick_line_feedback.run_if(resource_exists::<ActiveLineFeedback>),
                dismiss_line_on_click.run_if(resource_exists::<ActiveLineFeedback>),
                draw_line_feedback
                    .after(ScaleFactorSet)
                    .after(tick_line_feedback),
            )
                .chain(),
        )
        .add_systems(
            Update,
            draw_graduation_choices
                .after(ScaleFactorSet)
                .after(crate::state_update::StateUpdateSet),
        );
}
