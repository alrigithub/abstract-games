use bevy::ecs::message::MessageWriter;
use bevy::prelude::*;

use crate::{
    ai::{AiComputationEvent, AiPlayerStrength, AiSet},
    ai_strength_ui::adjust_ai_strength,
    board::BoardElement,
    board_update_event::BoardUpdateEvent,
    graphics::ScaleFactorSet,
    interaction::CursorElement,
    scoring::ScoringPresentation,
    state_update::{GameState, StateUpdateSet, restore_board_from_game_state},
};

fn strength_key_pressed(keyboard: &ButtonInput<KeyCode>) -> Option<i32> {
    if keyboard.just_pressed(KeyCode::PageUp)
        || keyboard.just_pressed(KeyCode::Equal)
        || keyboard.just_pressed(KeyCode::NumpadAdd)
    {
        return Some(1);
    }
    if keyboard.just_pressed(KeyCode::PageDown)
        || keyboard.just_pressed(KeyCode::Minus)
        || keyboard.just_pressed(KeyCode::NumpadSubtract)
    {
        return Some(-1);
    }
    None
}

fn keyboard_control(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut exit: MessageWriter<AppExit>,
    mut ai_player_strength: ResMut<AiPlayerStrength>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
    mut commands: Commands,
    mut game_state: ResMut<GameState>,
    mut scoring: ResMut<ScoringPresentation>,
    q_board_elements: Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    let ctrl_pressed =
        keyboard.pressed(KeyCode::ControlLeft) || keyboard.pressed(KeyCode::ControlRight);

    if keyboard.just_pressed(KeyCode::Escape) || keyboard.just_pressed(KeyCode::KeyQ) {
        exit.write(AppExit::Success);
    } else if let Some(delta) = strength_key_pressed(&keyboard) {
        adjust_ai_strength(&mut ai_player_strength, delta);
    } else if ctrl_pressed && keyboard.just_pressed(KeyCode::KeyR) {
        ai_computation_events.write(AiComputationEvent::Cancel);
        scoring.reset();
        *game_state.as_deref_mut() = yinsh::GameState::initial();
        restore_board_from_game_state(
            &game_state,
            &mut commands,
            &mut board_update_events,
            &q_board_elements,
        );
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(
        Update,
        keyboard_control
            .ambiguous_with(AiSet)
            .before(StateUpdateSet)
            .after(ScaleFactorSet),
    );
}
