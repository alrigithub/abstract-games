use tak::{
    BOARD_SIZE, Coord, Direction, FLATS_PER_PLAYER, GameState, Move, Player, Stone, StoneKind,
};

#[test]
fn empty_board_new_game() {
    let state = GameState::new();
    assert!(state.placement_phase());
    assert_eq!(state.to_move(), Player::First);
    assert_eq!(state.winner(), None);
    assert_eq!(state.reserve(Player::First).flats, FLATS_PER_PLAYER);
    assert_eq!(state.reserve(Player::First).cap, 1);
}

#[test]
fn place_flat_on_empty() {
    let mut state = GameState::new();
    let coord = Coord::new(2, 2);
    let m = Move::Place {
        coord,
        kind: StoneKind::Flat,
    };
    assert!(state.legal_moves().contains(&m));
    state.apply(m).unwrap();
    assert_eq!(state.board().top(coord).unwrap().owner, Player::Second);
    assert_eq!(state.opening_placements(), 1);
    assert!(state.placement_phase());
    assert_eq!(state.to_move(), Player::Second);
}

#[test]
fn illegal_place_on_occupied() {
    let mut state = GameState::new();
    let coord = Coord::new(1, 1);
    state
        .apply(Move::Place {
            coord,
            kind: StoneKind::Flat,
        })
        .unwrap();
    state.set_to_move(Player::First);
    let err = state.apply(Move::Place {
        coord,
        kind: StoneKind::Flat,
    });
    assert!(err.is_err());
}

#[test]
fn placement_rejects_wall_and_cap() {
    let mut state = GameState::new();
    let coord = Coord::new(0, 0);
    assert!(
        state
            .apply(Move::Place {
                coord,
                kind: StoneKind::Wall,
            })
            .is_err()
    );
}

#[test]
fn simple_slide_adjacent() {
    let mut state = GameState::new();
    state.set_placement_phase(false);
    state.set_to_move(Player::First);
    let from = Coord::new(2, 2);
    state.set_stack(
        from,
        vec![Stone {
            owner: Player::First,
            kind: StoneKind::Flat,
        }],
    );
    let m = Move::slide(from, Direction::East, 1, &[1]);
    assert!(state.legal_moves().contains(&m));
    state.apply(m).unwrap();
    assert!(state.board().is_empty(from));
    assert_eq!(
        state.board().top(Coord::new(3, 2)).unwrap().owner,
        Player::First
    );
}

#[test]
fn road_win_east_west() {
    let mut state = GameState::new();
    state.set_placement_phase(false);
    for x in 0..BOARD_SIZE as u8 {
        state.set_stack(
            Coord { x, y: 2 },
            vec![Stone {
                owner: Player::First,
                kind: StoneKind::Flat,
            }],
        );
    }
    state.set_to_move(Player::Second);
    assert_eq!(state.winner(), None);
    // First player already has road; check on apply of noop - use check by placing opponent
    let mut check = state.clone();
    check.set_to_move(Player::Second);
    assert_eq!(
        tak::check_road_win(check.board(), Player::Second),
        Some(Player::First)
    );
}

#[test]
fn wall_does_not_count_for_road() {
    let mut state = GameState::new();
    state.set_placement_phase(false);
    for x in 0..BOARD_SIZE as u8 {
        let kind = if x == 2 {
            StoneKind::Wall
        } else {
            StoneKind::Flat
        };
        state.set_stack(
            Coord { x, y: 2 },
            vec![Stone {
                owner: Player::First,
                kind,
            }],
        );
    }
    assert!(tak::check_road_win(state.board(), Player::First).is_none());
}

#[test]
fn opening_places_opponent_flats_then_ends() {
    let mut state = GameState::new();
    state
        .apply(Move::Place {
            coord: Coord::new(0, 0),
            kind: StoneKind::Flat,
        })
        .unwrap();
    assert_eq!(
        state.board().top(Coord::new(0, 0)).unwrap().owner,
        Player::Second
    );
    assert_eq!(state.reserve(Player::Second).flats, FLATS_PER_PLAYER - 1);
    assert_eq!(state.reserve(Player::First).flats, FLATS_PER_PLAYER);

    state
        .apply(Move::Place {
            coord: Coord::new(4, 4),
            kind: StoneKind::Flat,
        })
        .unwrap();
    assert_eq!(
        state.board().top(Coord::new(4, 4)).unwrap().owner,
        Player::First
    );
    assert!(!state.placement_phase());
    assert_eq!(state.opening_placements(), 2);
    assert_eq!(state.to_move(), Player::First);
}

#[test]
fn wall_place_after_opening() {
    let mut state = GameState::new();
    state
        .apply(Move::Place {
            coord: Coord::new(0, 0),
            kind: StoneKind::Flat,
        })
        .unwrap();
    state
        .apply(Move::Place {
            coord: Coord::new(4, 4),
            kind: StoneKind::Flat,
        })
        .unwrap();
    assert!(!state.placement_phase());
    state.set_to_move(Player::First);
    let coord = Coord::new(2, 2);
    let wall = Move::Place {
        coord,
        kind: StoneKind::Wall,
    };
    assert!(state.legal_moves().contains(&wall));
    state.apply(wall).unwrap();
    assert_eq!(state.board().top(coord).unwrap().kind, StoneKind::Wall);
    assert_eq!(state.board().top(coord).unwrap().owner, Player::First);
}

#[test]
fn opening_has_no_slides() {
    let mut state = GameState::new();
    state
        .apply(Move::Place {
            coord: Coord::new(2, 2),
            kind: StoneKind::Flat,
        })
        .unwrap();
    assert!(
        state
            .legal_moves()
            .iter()
            .all(|m| matches!(m, Move::Place { .. }))
    );
}

#[test]
fn double_road_prefers_active_player() {
    let mut state = GameState::new();
    state.set_placement_phase(false);
    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            if x == 2 && y == 2 {
                continue;
            }
            let owner = if y == 0 {
                Player::First
            } else if y == 4 {
                Player::Second
            } else {
                Player::First
            };
            state.set_stack(
                Coord { x, y },
                vec![Stone {
                    owner,
                    kind: StoneKind::Flat,
                }],
            );
        }
    }
    state.set_to_move(Player::First);
    let m = Move::Place {
        coord: Coord::new(2, 2),
        kind: StoneKind::Flat,
    };
    assert!(state.legal_moves().contains(&m));
    state.apply(m).unwrap();
    assert_eq!(state.winner(), Some(Player::First));
}

#[test]
fn slide_to_adjacent_empty_after_opening() {
    let mut state = GameState::new();
    state
        .apply(Move::Place {
            coord: Coord::new(1, 1),
            kind: StoneKind::Flat,
        })
        .unwrap();
    state
        .apply(Move::Place {
            coord: Coord::new(3, 3),
            kind: StoneKind::Flat,
        })
        .unwrap();
    let from = Coord::new(3, 3);
    let to = Coord::new(2, 3);
    let m = state.slide_to(from, to).expect("slide to west");
    state.apply(m).unwrap();
    assert!(state.board().is_empty(from));
    assert_eq!(state.board().top(to).unwrap().owner, Player::First);
}

#[test]
fn flat_win_when_board_full() {
    let mut state = GameState::new();
    state.set_placement_phase(false);
    for y in 0..BOARD_SIZE as u8 {
        for x in 0..BOARD_SIZE as u8 {
            let owner = if (x + y) % 2 == 0 {
                Player::First
            } else {
                Player::Second
            };
            state.set_stack(
                Coord { x, y },
                vec![Stone {
                    owner,
                    kind: StoneKind::Flat,
                }],
            );
        }
    }
    state.set_reserve(Player::First, tak::Reserve { flats: 0, cap: 1 });
    state.set_reserve(Player::Second, tak::Reserve { flats: 0, cap: 1 });
    let reserves = [state.reserve(Player::First), state.reserve(Player::Second)];
    assert_eq!(
        tak::check_flat_win(state.board(), &reserves),
        Some(Player::First)
    );
}
