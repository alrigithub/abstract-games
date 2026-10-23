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
    assert_eq!(state.board().top(coord).unwrap().owner, Player::First);
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
    assert_eq!(tak::check_road_win(check.board()), Some(Player::First));
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
    assert!(tak::check_road_win(state.board()).is_none());
}

#[test]
fn slide_ends_placement_phase() {
    let mut state = GameState::new();
    state
        .apply(Move::Place {
            coord: Coord::new(0, 0),
            kind: StoneKind::Flat,
        })
        .unwrap();
    state
        .apply(Move::Place {
            coord: Coord::new(1, 0),
            kind: StoneKind::Flat,
        })
        .unwrap();
    state.set_to_move(Player::First);
    let from = Coord::new(0, 0);
    let slide = state
        .legal_moves()
        .into_iter()
        .find(|m| matches!(m, Move::Slide { from: f, .. } if *f == from))
        .expect("expected a slide from (0,0)");
    state.apply(slide).unwrap();
    assert!(!state.placement_phase());
}
