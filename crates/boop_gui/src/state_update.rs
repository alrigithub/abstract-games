use std::collections::HashSet;
use std::ops::{Deref, DerefMut};

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use boop::{Board, Coord, Move, MoveEffects, Piece, PieceKind, Player};

use crate::line_feedback::{ActiveLineFeedback, LineCompletedEvent};

use crate::{
    PLAYER_AI, PLAYER_HUMAN,
    ai::AiComputationEvent,
    interaction::{BoardElement, CursorElement},
};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct StateUpdateSet;

#[derive(Resource)]
pub struct GameState(boop::GameState);

impl Deref for GameState {
    type Target = boop::GameState;

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
        Self(boop::GameState::new())
    }

    pub fn replace(&mut self, state: boop::GameState) {
        self.0 = state;
    }
}

#[derive(Resource, Default)]
pub struct UndoHistory(pub Vec<boop::GameState>);

#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct HumanPieceChoice(pub PieceKind);

#[derive(Resource, Debug, Clone, PartialEq, Eq)]
pub enum InteractionState {
    HumanPlace,
    HumanFullBed,
    HumanNoMoves,
    WaitForAI,
    Winner(Player),
}

impl InteractionState {
    pub fn from_game_state(game_state: &boop::GameState) -> Self {
        if let Some(winner) = game_state.winner() {
            Self::Winner(winner)
        } else if game_state.to_move() == PLAYER_AI {
            Self::WaitForAI
        } else if game_state.legal_moves().is_empty() {
            Self::HumanNoMoves
        } else if game_state.requires_alternate_graduation() {
            Self::HumanFullBed
        } else {
            Self::HumanPlace
        }
    }
}

#[derive(Message, Debug, Clone, Copy)]
pub enum BoardUpdateEvent {
    Spawn {
        coord: Coord,
        piece: Piece,
    },
    Move {
        from: Coord,
        to: Coord,
        piece: Piece,
    },
    Remove {
        coord: Coord,
        shrink: bool,
    },
    ExitBoard {
        from: Coord,
        piece: Piece,
        push: (i8, i8),
    },
}

#[derive(Message)]
pub struct PlayerMoveEvent(pub Player, pub Move);

#[derive(Message)]
pub struct BoardResyncEvent;

pub fn diff_board(old: &Board, new: &Board) -> Vec<BoardUpdateEvent> {
    let mut changes = Vec::new();
    let mut removed = Vec::new();
    let mut added = Vec::new();

    for y in 0..boop::BOARD_SIZE as u8 {
        for x in 0..boop::BOARD_SIZE as u8 {
            let coord = Coord { x, y };
            match (old.get(coord), new.get(coord)) {
                (None, None) => {}
                (Some(p), None) => removed.push((coord, p)),
                (None, Some(p)) => added.push((coord, p)),
                (Some(a), Some(b)) if a != b => {
                    removed.push((coord, a));
                    added.push((coord, b));
                }
                (Some(_), Some(_)) => {}
            }
        }
    }

    let mut used_added = vec![false; added.len()];
    for (from, piece) in removed {
        if let Some((idx, (to, _))) = added
            .iter()
            .enumerate()
            .find(|(idx, (_, p))| !used_added[*idx] && *p == piece)
        {
            used_added[idx] = true;
            changes.push(BoardUpdateEvent::Move {
                from,
                to: *to,
                piece,
            });
        } else {
            changes.push(BoardUpdateEvent::Remove {
                coord: from,
                shrink: false,
            });
        }
    }

    for (idx, (coord, piece)) in added.into_iter().enumerate() {
        if !used_added[idx] {
            changes.push(BoardUpdateEvent::Spawn { coord, piece });
        }
    }

    changes
}

/// Board visuals after a move: boop displacements, diff, then explicit graduation removes.
pub fn board_sync_events(
    before: &Board,
    after: &Board,
    effects: &MoveEffects,
    player_move: Move,
    acting_player: Player,
) -> Vec<BoardUpdateEvent> {
    let shrink_removals = effects.graduated_cells.is_some();

    let displaced_from: HashSet<Coord> = effects.displacements.iter().map(|d| d.from).collect();
    let displaced_to: HashSet<Coord> = effects.displacements.iter().map(|d| d.to).collect();
    let graduation_cells: HashSet<Coord> = effects
        .graduated_cells
        .into_iter()
        .flatten()
        .collect();

    let placed_this_turn = match player_move {
        Move::Place { coord, piece: kind } => Some((coord, Piece { player: acting_player, kind })),
        _ => None,
    };

    let mut events = Vec::new();

    for displacement in &effects.displacements {
        events.push(BoardUpdateEvent::Move {
            from: displacement.from,
            to: displacement.to,
            piece: displacement.piece,
        });
    }

    for change in diff_board(before, after) {
        match change {
            BoardUpdateEvent::Move { .. } => {}
            BoardUpdateEvent::Spawn { coord, .. } if displaced_to.contains(&coord) => {}
            BoardUpdateEvent::Remove { coord, .. } if displaced_from.contains(&coord) => {}
            BoardUpdateEvent::Remove { coord, .. } if graduation_cells.contains(&coord) => {}
            BoardUpdateEvent::Remove { coord, .. } => {
                if let Some(exit) = effects.off_board.iter().find(|e| e.from == coord) {
                    events.push(BoardUpdateEvent::ExitBoard {
                        from: exit.from,
                        piece: exit.piece,
                        push: exit.push,
                    });
                } else {
                    events.push(BoardUpdateEvent::Remove {
                        coord,
                        shrink: shrink_removals,
                    });
                }
            }
            other => events.push(other),
        }
    }

    if let Some(cells) = effects.graduated_cells {
        for coord in cells {
            if effects.off_board.iter().any(|e| e.from == coord) {
                continue;
            }
            if let Some((placed_coord, piece)) = placed_this_turn
                && placed_coord == coord
                && before.get(coord).is_none()
            {
                events.push(BoardUpdateEvent::Spawn { coord, piece });
            }
            events.push(BoardUpdateEvent::Remove {
                coord,
                shrink: true,
            });
        }
    }

    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use boop::{GameState, LineHighlight, PieceKind, Player};

    #[test]
    fn graduation_sync_removes_all_three_cells_including_placed_kitten() {
        let mut g = GameState::new();
        for x in 0..2 {
            g.set_piece(
                Coord::new(x, 0),
                Piece {
                    player: Player::First,
                    kind: PieceKind::Kitten,
                },
            );
        }
        g.set_to_move(Player::First);
        g.set_pool(
            Player::First,
            boop::Pool {
                kittens_in_hand: 6,
                cats_in_hand: 0,
                cats_in_reserve: 8,
            },
        );

        let before = g.board().clone();
        let player_move = Move::Place {
            coord: Coord::new(2, 0),
            piece: PieceKind::Kitten,
        };
        g.apply(player_move).unwrap();
        let effects = g.last_move_effects().clone();
        let after = g.board().clone();

        let events = board_sync_events(
            &before,
            &after,
            &effects,
            player_move,
            Player::First,
        );

        assert!(matches!(
            effects.line_highlight,
            Some(LineHighlight::Graduation(_))
        ));

        let grad_removals: HashSet<Coord> = events
            .iter()
            .filter_map(|event| match event {
                BoardUpdateEvent::Remove { coord, shrink: true } => Some(*coord),
                _ => None,
            })
            .collect();
        assert_eq!(
            grad_removals,
            HashSet::from([
                Coord::new(0, 0),
                Coord::new(1, 0),
                Coord::new(2, 0),
            ])
        );

        assert!(events.iter().any(|event| matches!(
            event,
            BoardUpdateEvent::Spawn {
                coord,
                piece,
            } if *coord == Coord::new(2, 0)
                && piece.kind == PieceKind::Kitten
                && piece.player == Player::First
        )));
    }
}

pub fn restore_board_from_game_state(
    game_state: &boop::GameState,
    commands: &mut Commands,
    resync_events: &mut MessageWriter<BoardResyncEvent>,
    q_board_elements: &Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    for entity in q_board_elements.iter() {
        commands.entity(entity).despawn();
    }
    resync_events.write(BoardResyncEvent);
    let _ = game_state;
}

fn state_update(
    mut player_move_events: MessageReader<PlayerMoveEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    mut undo_history: ResMut<UndoHistory>,
    mut ai_computation_events: MessageWriter<AiComputationEvent>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
    mut line_completed_events: MessageWriter<LineCompletedEvent>,
    mut commands: Commands,
) {
    for PlayerMoveEvent(player, player_move) in player_move_events.read() {
        let player = *player;
        let player_move = *player_move;

        if player == PLAYER_HUMAN {
            undo_history.0.push(game_state.0.clone());
        }

        let before = game_state.board().clone();
        if game_state.apply(player_move).is_err() {
            if player == PLAYER_HUMAN {
                undo_history.0.pop();
            }
            continue;
        }

        let effects = game_state.last_move_effects().clone();

        for event in board_sync_events(
            &before,
            game_state.board(),
            &effects,
            player_move,
            player,
        ) {
            board_update_events.write(event);
        }

        if let Some(highlight) = effects.line_highlight {
            line_completed_events.write(LineCompletedEvent(highlight));
        } else {
            commands.remove_resource::<ActiveLineFeedback>();
        }

        if game_state.winner().is_none()
            && game_state.to_move() == PLAYER_AI
            && player == PLAYER_HUMAN
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
        .insert_resource(HumanPieceChoice(PieceKind::Kitten))
        .insert_resource(initial_game_state)
        .init_resource::<UndoHistory>()
        .add_message::<PlayerMoveEvent>()
        .add_message::<BoardUpdateEvent>()
        .add_message::<BoardResyncEvent>()
        .add_systems(Update, state_update.in_set(StateUpdateSet));
}
