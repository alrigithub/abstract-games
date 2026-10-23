use std::ops::{Deref, DerefMut};

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use tak::{Move, Player};

use crate::{
    PLAYER_AI, PLAYER_HUMAN,
    ai::AiComputationEvent,
    interaction::{BoardElement, CursorElement},
};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct StateUpdateSet;

#[derive(Resource)]
pub struct GameState(tak::GameState);

impl Deref for GameState {
    type Target = tak::GameState;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for GameState {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl GameState {
    pub fn initial() -> Self {
        Self(tak::GameState::new())
    }

    pub fn replace(&mut self, state: tak::GameState) {
        self.0 = state;
    }
}

#[derive(Resource, Default)]
pub struct UndoHistory(pub Vec<tak::GameState>);

#[derive(Resource, Debug, Clone, PartialEq, Eq)]
pub enum InteractionState {
    HumanTurn,
    WaitForAI,
    Winner(Player),
    Draw,
}

impl InteractionState {
    pub fn from_game_state(game_state: &tak::GameState) -> Self {
        if game_state.is_draw() {
            Self::Draw
        } else if let Some(winner) = game_state.winner() {
            Self::Winner(winner)
        } else if game_state.to_move() == PLAYER_AI {
            Self::WaitForAI
        } else {
            Self::HumanTurn
        }
    }
}

#[derive(Message)]
pub struct BoardResyncEvent;

#[derive(Message)]
pub struct PlayerMoveEvent(pub Player, pub Move);

pub fn restore_board_from_game_state(
    commands: &mut Commands,
    q_board_elements: &Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
    board_resync_events: &mut MessageWriter<BoardResyncEvent>,
) {
    for entity in q_board_elements.iter() {
        commands.entity(entity).despawn();
    }
    board_resync_events.write(BoardResyncEvent);
}

fn state_update(
    mut player_move_events: MessageReader<PlayerMoveEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut undo_history: ResMut<UndoHistory>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut board_resync_events: MessageWriter<BoardResyncEvent>,
) {
    for PlayerMoveEvent(player, player_move) in player_move_events.read() {
        let player = *player;
        let player_move = *player_move;

        if player == PLAYER_HUMAN {
            undo_history.0.push(game_state.0.clone());
        }

        if game_state.apply(player_move).is_err() {
            if player == PLAYER_HUMAN {
                undo_history.0.pop();
            }
            continue;
        }

        board_resync_events.write(BoardResyncEvent);

        if !game_state.is_finished() && game_state.to_move() == PLAYER_AI && player == PLAYER_HUMAN
        {
            ai_computation_events.write(AiComputationEvent::Start(
                PLAYER_AI,
                Box::new(game_state.0.clone()),
            ));
        }
    }

    *interaction_state = InteractionState::from_game_state(&game_state);
}

pub fn plugin(app: &mut App) {
    let initial_game_state = GameState::initial();
    app.insert_resource(InteractionState::from_game_state(&initial_game_state))
        .insert_resource(initial_game_state)
        .init_resource::<UndoHistory>()
        .add_message::<PlayerMoveEvent>()
        .add_message::<BoardResyncEvent>()
        .add_systems(Update, state_update.in_set(StateUpdateSet));
}
