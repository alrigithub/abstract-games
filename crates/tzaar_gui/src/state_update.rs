use std::ops::{Deref, DerefMut};

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use tzaar::{Move, Player};

use crate::{
    PLAYER_AI, PLAYER_HUMAN,
    ai::AiPending,
    interaction::{BoardElement, CursorElement},
};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct StateUpdateSet;

#[derive(Resource)]
pub struct GameState(tzaar::GameState);

impl Deref for GameState {
    type Target = tzaar::GameState;

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
        Self(tzaar::GameState::new())
    }

    /// Clone of the rules-engine state (for undo, AI snapshots, etc.).
    pub fn snapshot(&self) -> tzaar::GameState {
        self.0.clone()
    }

    pub fn replace(&mut self, state: tzaar::GameState) {
        self.0 = state;
    }
}

#[derive(Resource, Default)]
pub struct UndoHistory(pub Vec<tzaar::GameState>);

#[derive(Resource, Debug, Clone, PartialEq, Eq)]
pub enum InteractionState {
    HumanTurn,
    WaitForAI,
    Winner(Player),
}

impl InteractionState {
    pub fn from_game_state(game_state: &tzaar::GameState) -> Self {
        if let Some(winner) = game_state.winner() {
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

fn queue_ai_if_needed(game_state: &GameState, pending: &mut AiPending) {
    pending.0 = game_state.winner().is_none() && game_state.to_move() == PLAYER_AI;
}

fn state_update(
    mut player_move_events: MessageReader<PlayerMoveEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut undo_history: ResMut<UndoHistory>,
    mut pending: ResMut<AiPending>,
    mut board_resync_events: MessageWriter<BoardResyncEvent>,
) {
    for PlayerMoveEvent(player, player_move) in player_move_events.read() {
        let player = *player;
        let player_move = *player_move;

        if player != PLAYER_HUMAN {
            continue;
        }

        undo_history.0.push(game_state.snapshot());

        if game_state.apply(player_move).is_err() {
            undo_history.0.pop();
            continue;
        }

        board_resync_events.write(BoardResyncEvent);
        queue_ai_if_needed(&game_state, &mut pending);
    }

    if game_state.winner().is_none() && game_state.to_move() == PLAYER_AI {
        pending.0 = true;
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
