use bevy::ecs::message::MessageWriter;
use bevy::prelude::*;

use crate::{
    ai::{AiComputationEvent, AiPlayerStrength, AiSet},
    graphics::ScaleFactorSet,
    interaction::{BoardElement, CursorElement},
    state_update::{
        BoardResyncEvent, GameState, HumanPieceChoice, InteractionState, StateUpdateSet,
        UndoHistory, restore_board_from_game_state,
    },
};

#[allow(clippy::too_many_arguments)]
fn keyboard_control(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut commands: Commands,
    mut exit: MessageWriter<AppExit>,
    mut ai_player_strength: ResMut<AiPlayerStrength>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut resync_events: MessageWriter<BoardResyncEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut selected_piece: ResMut<HumanPieceChoice>,
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
    } else if keyboard.just_pressed(KeyCode::KeyC) {
        if game_state.pool(crate::PLAYER_HUMAN).cats_in_hand > 0 {
            selected_piece.0 = match selected_piece.0 {
                boop::PieceKind::Kitten => boop::PieceKind::Cat,
                boop::PieceKind::Cat => boop::PieceKind::Kitten,
            };
        }
    } else if keyboard.just_pressed(KeyCode::KeyU)
        || (ctrl_pressed && keyboard.just_pressed(KeyCode::KeyZ))
    {
        if let Some(previous_state) = undo_history.0.pop() {
            ai_computation_events.write(AiComputationEvent::Cancel);
            game_state.replace(previous_state);
            restore_board_from_game_state(
                &game_state,
                &mut commands,
                &mut resync_events,
                &q_board_elements,
            );
            *interaction_state = InteractionState::from_game_state(&game_state);
        }
    } else if ctrl_pressed && keyboard.just_pressed(KeyCode::KeyR) {
        ai_computation_events.write(AiComputationEvent::Cancel);
        game_state.replace(boop::GameState::new());
        undo_history.0.clear();
        restore_board_from_game_state(
            &game_state,
            &mut commands,
            &mut resync_events,
            &q_board_elements,
        );
        *interaction_state = InteractionState::from_game_state(&game_state);
        selected_piece.0 = boop::PieceKind::Kitten;
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
