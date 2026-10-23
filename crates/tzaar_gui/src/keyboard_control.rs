use bevy::ecs::message::MessageWriter;
use bevy::prelude::*;

use crate::{
    ai::{AiComputationEvent, AiPending, AiPlayerStrength, AiSet},
    board_entity::{BoardElement, CursorElement},
    graphics::ScaleFactorSet,
    state_update::{
        BoardResyncEvent, GameState, InteractionState, StateUpdateSet, UndoHistory,
        restore_board_from_game_state,
    },
};

#[allow(clippy::too_many_arguments)]
fn keyboard_control(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut commands: Commands,
    mut exit: MessageWriter<AppExit>,
    mut ai_player_strength: ResMut<AiPlayerStrength>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut ai_pending: ResMut<AiPending>,
    mut board_resync_events: MessageWriter<BoardResyncEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut undo_history: ResMut<UndoHistory>,
    q_board_elements: Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    let ctrl_pressed =
        keyboard.pressed(KeyCode::ControlLeft) || keyboard.pressed(KeyCode::ControlRight);

    if keyboard.just_pressed(KeyCode::Escape) || keyboard.just_pressed(KeyCode::KeyQ) {
        exit.write(AppExit::Success);
    } else if keyboard.just_pressed(KeyCode::PageUp) {
        ai_player_strength.0 = ai_player_strength.0.saturating_add(1);
    } else if keyboard.just_pressed(KeyCode::PageDown) {
        ai_player_strength.0 = ai_player_strength.0.saturating_sub(1).max(1);
    } else if keyboard.just_pressed(KeyCode::KeyU)
        || (ctrl_pressed && keyboard.just_pressed(KeyCode::KeyZ))
    {
        if let Some(previous_state) = undo_history.0.pop() {
            ai_computation_events.write(AiComputationEvent::Cancel);
            ai_pending.0 = false;
            game_state.replace(previous_state);
            restore_board_from_game_state(
                &mut commands,
                &q_board_elements,
                &mut board_resync_events,
            );
            *interaction_state = InteractionState::from_game_state(&game_state);
        }
    } else if ctrl_pressed && keyboard.just_pressed(KeyCode::KeyR) {
        ai_computation_events.write(AiComputationEvent::Cancel);
        ai_pending.0 = false;
        game_state.replace(tzaar::GameState::new());
        undo_history.0.clear();
        restore_board_from_game_state(&mut commands, &q_board_elements, &mut board_resync_events);
        *interaction_state = InteractionState::from_game_state(&game_state);
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
