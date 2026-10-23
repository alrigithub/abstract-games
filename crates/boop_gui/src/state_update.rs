use std::collections::HashSet;
use std::ops::{Deref, DerefMut};

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use boop::{Board, Coord, Move, MoveEffects, Piece, PieceKind, Player, TurnMode};

use crate::line_feedback::{ActiveLineFeedback, LineCompletedEvent};

use crate::{
    ai::AiComputationEvent,
    interaction::{BoardElement, CursorElement},
    PLAYER_AI, PLAYER_HUMAN,
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
    /// The human's placement completed several lines; they pick which one graduates.
    HumanChooseGraduation,
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
        } else {
            match game_state.turn_mode() {
                TurnMode::ChooseGraduation(_) => Self::HumanChooseGraduation,
                TurnMode::AlternateGraduation => Self::HumanFullBed,
                TurnMode::Place => Self::HumanPlace,
            }
        }
    }

    /// States in which board clicks are routed to the engine.
    pub fn accepts_board_clicks(&self) -> bool {
        matches!(
            self,
            Self::HumanPlace | Self::HumanChooseGraduation | Self::HumanFullBed
        )
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
    _player_move: Move,
    _acting_player: Player,
) -> Vec<BoardUpdateEvent> {
    let shrink_removals = effects.graduated_cells.is_some();

    let displaced_from: HashSet<Coord> = effects.displacements.iter().map(|d| d.from).collect();
    let displaced_to: HashSet<Coord> = effects.displacements.iter().map(|d| d.to).collect();
    let graduation_cells: HashSet<Coord> = effects.graduated_cells.into_iter().flatten().collect();

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
            // Do not spawn the completing piece only to despawn it — graduation clears
            // the bed immediately; the line overlay marks the three cells instead.
            events.push(BoardUpdateEvent::Remove {
                coord,
                shrink: false,
            });
        }
    }

    events
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

#[allow(clippy::too_many_arguments)]
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

        for event in board_sync_events(&before, game_state.board(), &effects, player_move, player) {
            board_update_events.write(event);
        }

        if let Some(highlight) = effects.line_highlight {
            line_completed_events.write(LineCompletedEvent(highlight));
        } else {
            commands.remove_resource::<ActiveLineFeedback>();
        }

        // The AI also moves again right after its own placement when it has to pick one of
        // several graduating lines (the mover keeps the turn in that case).
        if game_state.winner().is_none() && game_state.to_move() == PLAYER_AI {
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

        let events = board_sync_events(&before, &after, &effects, player_move, Player::First);

        assert!(matches!(
            effects.line_highlight,
            Some(LineHighlight::Graduation(_))
        ));

        let grad_removals: HashSet<Coord> = events
            .iter()
            .filter_map(|event| match event {
                BoardUpdateEvent::Remove { coord, .. } => Some(*coord),
                _ => None,
            })
            .collect();
        assert_eq!(
            grad_removals,
            HashSet::from([Coord::new(0, 0), Coord::new(1, 0), Coord::new(2, 0),])
        );

        assert!(
            !events
                .iter()
                .any(|event| matches!(event, BoardUpdateEvent::Spawn { .. })),
            "graduation should not spawn pieces that are removed in the same sync"
        );
    }

    fn two_line_setup(player: Player) -> GameState {
        let mut g = GameState::new();
        let kitten = Piece {
            player,
            kind: PieceKind::Kitten,
        };
        g.set_piece(Coord::new(0, 0), kitten);
        g.set_piece(Coord::new(1, 0), kitten);
        g.set_piece(Coord::new(2, 1), kitten);
        g.set_piece(Coord::new(2, 2), kitten);
        g.set_to_move(player);
        g.set_pool(
            player,
            boop::Pool {
                kittens_in_hand: 4,
                cats_in_hand: 0,
                cats_in_reserve: 8,
            },
        );
        g
    }

    #[test]
    fn placing_eighth_piece_enters_full_bed_on_the_same_turn() {
        let coords = [(0, 0), (2, 0), (4, 0), (0, 2), (2, 2), (4, 2), (0, 4)];
        let mut g = GameState::new();
        for (x, y) in coords {
            g.set_piece(
                Coord::new(x, y),
                Piece {
                    player: PLAYER_HUMAN,
                    kind: PieceKind::Kitten,
                },
            );
        }
        g.set_to_move(PLAYER_HUMAN);
        g.set_pool(
            PLAYER_HUMAN,
            boop::Pool {
                kittens_in_hand: 1,
                cats_in_hand: 0,
                cats_in_reserve: 8,
            },
        );
        g.apply(Move::Place {
            coord: Coord::new(4, 4),
            piece: PieceKind::Kitten,
        })
        .unwrap();

        assert_eq!(g.to_move(), PLAYER_HUMAN);
        let state = InteractionState::from_game_state(&g);
        assert_eq!(state, InteractionState::HumanFullBed);
        assert!(state.accepts_board_clicks());
    }

    #[test]
    fn human_multi_line_placement_enters_choose_graduation_state() {
        let mut g = two_line_setup(PLAYER_HUMAN);
        g.apply(Move::Place {
            coord: Coord::new(2, 0),
            piece: PieceKind::Kitten,
        })
        .unwrap();

        let state = InteractionState::from_game_state(&g);
        assert_eq!(state, InteractionState::HumanChooseGraduation);
        assert!(state.accepts_board_clicks());
    }

    #[test]
    fn ai_multi_line_placement_keeps_waiting_for_ai() {
        let mut g = two_line_setup(PLAYER_AI);
        g.apply(Move::Place {
            coord: Coord::new(2, 0),
            piece: PieceKind::Kitten,
        })
        .unwrap();

        assert_eq!(g.to_move(), PLAYER_AI);
        assert_eq!(
            InteractionState::from_game_state(&g),
            InteractionState::WaitForAI
        );
    }

    #[test]
    fn placement_with_pending_choice_spawns_piece_and_choice_removes_only_chosen_line() {
        let mut g = two_line_setup(PLAYER_HUMAN);
        let before = g.board().clone();
        let place = Move::Place {
            coord: Coord::new(2, 0),
            piece: PieceKind::Kitten,
        };
        g.apply(place).unwrap();
        let events = board_sync_events(
            &before,
            g.board(),
            g.last_move_effects(),
            place,
            PLAYER_HUMAN,
        );
        assert!(matches!(
            events.as_slice(),
            [BoardUpdateEvent::Spawn { coord, .. }] if *coord == Coord::new(2, 0)
        ));

        let column = [Coord::new(2, 0), Coord::new(2, 1), Coord::new(2, 2)];
        let before = g.board().clone();
        let graduate = Move::Graduate { line: column };
        g.apply(graduate).unwrap();
        let events = board_sync_events(
            &before,
            g.board(),
            g.last_move_effects(),
            graduate,
            PLAYER_HUMAN,
        );

        let removed: HashSet<Coord> = events
            .iter()
            .filter_map(|event| match event {
                BoardUpdateEvent::Remove { coord, .. } => Some(*coord),
                _ => None,
            })
            .collect();
        assert_eq!(removed, HashSet::from(column));
        assert_eq!(events.len(), 3);
        assert_eq!(
            g.last_move_effects().line_highlight,
            Some(LineHighlight::Graduation(column))
        );
    }
}
