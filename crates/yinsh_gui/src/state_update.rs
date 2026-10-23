use std::ops::{Deref, DerefMut};

use std::collections::HashMap;

use yinsh::{Coord, Move, Player, TurnMode};

use crate::scoring::SCORE_LINGER_SECS;

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;

use crate::PLAYER_HUMAN;

use crate::{
    PLAYER_AI,
    ai::{AiComputationEvent, AiSet},
    board::BoardElement,
    board_update_event::BoardUpdateEvent,
    interaction::CursorElement,
    scoring::ScoringPresentation,
};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct StateUpdateSet;

/// Applies `PlayerMoveEvent`s from human input (runs after interaction each frame).
#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct MoveApplicationSet;

/// AI search result waiting to be applied (separate from human move messages).
#[derive(Resource, Default)]
pub struct PendingAiMove(pub Option<(Player, Move)>);

#[derive(Resource)]
pub struct GameState(yinsh::GameState);

impl Deref for GameState {
    type Target = yinsh::GameState;

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
        Self(yinsh::GameState::initial())
    }
}

#[derive(Resource)]
pub enum InteractionState {
    RingPlacement(Vec<Coord>),
    MarkerPlacement(Vec<Coord>),
    /// Ring is highlighted but not yet committed for movement (click ring to confirm).
    RingSelect(Coord),
    RingMovement(Coord, Vec<Coord>),
    RunRemoval {
        all_run_coords: Vec<Coord>,
        run_from_seed: HashMap<Coord, Vec<Coord>>,
    },
    RingRemoval(Vec<Coord>),
    AutoMove,
    WaitForAI,
    /// Brief beat after a score so the line glow stays readable.
    ScoringPause,
    Winner(Player),
}

impl InteractionState {
    pub fn from_game_state(game_state: &yinsh::GameState) -> Self {
        if let Some(winner) = game_state.winner() {
            Self::Winner(winner)
        } else if game_state.active_player == PLAYER_AI {
            Self::WaitForAI
        } else {
            match game_state.turn_mode {
                TurnMode::RingPlacement => {
                    Self::RingPlacement(game_state.board.free_coords().collect())
                }
                TurnMode::MarkerPlacement => {
                    Self::MarkerPlacement(game_state.board.marker_moves(PLAYER_HUMAN).collect())
                }
                TurnMode::WaitForRingMovement(start) => Self::RingSelect(start),
                TurnMode::RingMovement(start) => {
                    Self::RingMovement(start, game_state.board.ring_moves(start))
                }
                TurnMode::RunRemoval(_) => {
                    let all_run_coords = game_state.board.run_coords(PLAYER_HUMAN);
                    Self::RunRemoval {
                        all_run_coords: all_run_coords.clone(),
                        run_from_seed: all_run_coords
                            .into_iter()
                            .map(|seed| (seed, game_state.board.run_coords_from(seed).unwrap()))
                            .collect(),
                    }
                }
                TurnMode::RingRemoval(_) => {
                    Self::RingRemoval(game_state.board.ring_coords(PLAYER_HUMAN).collect())
                }
                TurnMode::WaitForRunRemoval(_)
                | TurnMode::WaitForMarkerPlacement
                | TurnMode::WaitForRingRemoval(_) => Self::AutoMove,
            }
        }
    }
}

pub fn restore_board_from_game_state(
    game_state: &yinsh::GameState,
    commands: &mut Commands,
    board_update_events: &mut MessageWriter<BoardUpdateEvent>,
    q_board_elements: &Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    // Despawn all board elements
    for entity in q_board_elements.iter() {
        commands.entity(entity).despawn();
    }

    // Respawn board elements from game state
    for p in [Player::A, Player::B] {
        for coord in game_state.board.ring_coords(p) {
            board_update_events.write(BoardUpdateEvent::AddRing(coord, p));
        }
        for coord in game_state.board.marker_coords(p) {
            board_update_events.write(BoardUpdateEvent::AddMarker(coord, p));
        }
    }
}

#[derive(Message)]
pub struct PlayerMoveEvent(pub Player, pub Move);

#[derive(Message)]
pub struct CancelRingSelectionEvent;

fn cancel_ring_selection(
    mut events: MessageReader<CancelRingSelectionEvent>,
    mut game_state: ResMut<GameState>,
) {
    for _ in events.read() {
        if let TurnMode::RingMovement(start) = game_state.turn_mode {
            game_state.turn_mode = TurnMode::WaitForRingMovement(start);
        }
    }
}

fn queue_ai_turn(
    game_state: &GameState,
    ai_computation_events: &mut MessageWriter<AiComputationEvent>,
) {
    ai_computation_events.write(AiComputationEvent::Start(PLAYER_AI, game_state.0.clone()));
}

fn apply_player_move(
    player: Player,
    player_move: Move,
    game_state: &mut GameState,
    board_update_events: &mut MessageWriter<BoardUpdateEvent>,
    scoring: &mut ScoringPresentation,
) {
    assert_eq!(player, game_state.active_player);

    match &player_move {
        Move::PlaceRing(coord) => {
            board_update_events.write(BoardUpdateEvent::AddRing(*coord, player));
        }
        Move::PlaceMarker(coord) => {
            board_update_events.write(BoardUpdateEvent::AddMarker(*coord, player));
        }
        Move::MoveRing(start, end) => {
            board_update_events.write(BoardUpdateEvent::MoveRing(*start, *end));
            board_update_events.write(BoardUpdateEvent::FlipMarkers(
                *start,
                *end,
                Coord::between(*start, *end)
                    .into_iter()
                    .filter(|&coord| game_state.board.has_marker_at(coord))
                    .collect(),
            ));
        }
        Move::RemoveRun(seed) => {
            let line = game_state.board.run_coords_from(*seed).unwrap();
            scoring.scored_line = line.clone();
            board_update_events.write(BoardUpdateEvent::RemoveRun(line));
        }
        Move::RemoveRing(coord) => {
            if matches!(game_state.turn_mode, TurnMode::RingRemoval(_)) {
                scoring.linger = Some(Timer::from_seconds(SCORE_LINGER_SECS, TimerMode::Once));
            }
            let slot = match player {
                Player::A => game_state.points_a.saturating_sub(1),
                Player::B => game_state.points_b.saturating_sub(1),
            };
            board_update_events.write(BoardUpdateEvent::RemoveRingToRack(*coord, player, slot));
        }
        Move::Wait => {}
    }

    game_state.perform_move(&player_move);
}

fn sync_interaction(
    game_state: &GameState,
    interaction_state: &mut InteractionState,
    scoring: &ScoringPresentation,
) {
    if !scoring.is_blocking() {
        *interaction_state = InteractionState::from_game_state(game_state);
    }
}

fn apply_human_moves(
    mut player_move_events: MessageReader<PlayerMoveEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
    mut scoring: ResMut<ScoringPresentation>,
) {
    for PlayerMoveEvent(player, player_move) in player_move_events.read() {
        apply_player_move(
            *player,
            *player_move,
            &mut game_state,
            &mut board_update_events,
            &mut scoring,
        );

        if game_state.active_player == PLAYER_AI && game_state.winner().is_none() {
            if scoring.is_blocking() {
                scoring.deferred_ai = true;
            } else {
                queue_ai_turn(&game_state, &mut ai_computation_events);
            }
        }
    }

    sync_interaction(&game_state, &mut interaction_state, &scoring);
}

fn apply_pending_ai_move(
    mut pending: ResMut<PendingAiMove>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
    mut scoring: ResMut<ScoringPresentation>,
) {
    let Some((player, player_move)) = pending.0.take() else {
        return;
    };

    apply_player_move(
        player,
        player_move,
        &mut game_state,
        &mut board_update_events,
        &mut scoring,
    );

    if game_state.active_player == PLAYER_AI && game_state.winner().is_none() {
        if scoring.is_blocking() {
            scoring.deferred_ai = true;
        } else {
            queue_ai_turn(&game_state, &mut ai_computation_events);
        }
    }

    sync_interaction(&game_state, &mut interaction_state, &scoring);
}

pub fn plugin(app: &mut App) {
    let initial_game_state = GameState::initial();
    app.insert_resource(InteractionState::from_game_state(&initial_game_state))
        .insert_resource(initial_game_state)
        .add_message::<PlayerMoveEvent>()
        .add_message::<CancelRingSelectionEvent>()
        .add_message::<BoardUpdateEvent>()
        .init_resource::<PendingAiMove>()
        .add_systems(
            Update,
            (
                cancel_ring_selection.in_set(StateUpdateSet),
                apply_human_moves
                    .in_set(MoveApplicationSet)
                    .after(crate::interaction::InteractionInputSet),
                apply_pending_ai_move.after(AiSet),
            ),
        );
}
