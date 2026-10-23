use std::task::Poll;

use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
#[cfg(not(target_arch = "wasm32"))]
use bevy_async_task::TaskRunner;
use tzaar::{GameState as RulesState, Move};

use crate::graphics::ANIMATION_DURATION;
use crate::state_update::{BoardResyncEvent, GameState, InteractionState, StateUpdateSet};

#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct AiSet;

#[derive(Resource)]
pub struct AiPlayerStrength(pub u32);

/// Set by `state_update` when the rules engine is waiting on the AI.
#[derive(Resource, Default)]
pub struct AiPending(pub bool);

#[derive(Message)]
pub enum AiComputationEvent {
    #[allow(unused)]
    Cancel,
}

fn pick_ai_move(state: &RulesState, search_depth: u32) -> Option<Move> {
    tzaar_ai::choose_move(state, search_depth).or_else(|| state.legal_moves().first().copied())
}

fn apply_one_ai_submove(
    game_state: &mut GameState,
    strength: u32,
    board_resync_events: &mut MessageWriter<BoardResyncEvent>,
) -> bool {
    if game_state.winner().is_some() || game_state.to_move() != crate::PLAYER_AI {
        return false;
    }

    let Some(player_move) = pick_ai_move(game_state, strength) else {
        return false;
    };

    if game_state.apply(player_move).is_err() {
        let Some(fallback) = game_state.legal_moves().first().copied() else {
            return false;
        };
        if game_state.apply(fallback).is_err() {
            return false;
        }
    }

    board_resync_events.write(BoardResyncEvent);
    true
}

#[cfg(target_arch = "wasm32")]
#[derive(Resource, Default)]
struct WasmAiDelay {
    timer: Option<Timer>,
}

#[cfg(target_arch = "wasm32")]
fn perform_ai_moves(
    time: Res<Time>,
    mut pending: ResMut<AiPending>,
    mut delay: ResMut<WasmAiDelay>,
    mut cancel: MessageReader<AiComputationEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    strength: Res<AiPlayerStrength>,
    mut board_resync_events: MessageWriter<BoardResyncEvent>,
) {
    for event in cancel.read() {
        if matches!(event, AiComputationEvent::Cancel) {
            pending.0 = false;
            delay.timer = None;
        }
    }

    if !pending.0 {
        delay.timer = None;
        return;
    }

    if delay.timer.is_none() {
        delay.timer = Some(Timer::new(ANIMATION_DURATION, TimerMode::Once));
    }

    let Some(timer) = delay.timer.as_mut() else {
        return;
    };
    timer.tick(time.delta());
    if !timer.is_finished() {
        return;
    }

    delay.timer = None;

    if !apply_one_ai_submove(&mut game_state, strength.0, &mut board_resync_events) {
        pending.0 = false;
    } else if game_state.winner().is_none() && game_state.to_move() == crate::PLAYER_AI {
        pending.0 = true;
        delay.timer = Some(Timer::new(ANIMATION_DURATION, TimerMode::Once));
    } else {
        pending.0 = false;
    }

    *interaction_state = InteractionState::from_game_state(&game_state);
}

#[cfg(not(target_arch = "wasm32"))]
fn perform_ai_moves(
    mut pending: ResMut<AiPending>,
    mut task_runner: TaskRunner<Option<Move>>,
    mut cancel: MessageReader<AiComputationEvent>,
    mut game_state: ResMut<GameState>,
    mut interaction_state: ResMut<InteractionState>,
    strength: Res<AiPlayerStrength>,
    mut board_resync_events: MessageWriter<BoardResyncEvent>,
) {
    for event in cancel.read() {
        if matches!(event, AiComputationEvent::Cancel) {
            pending.0 = false;
            task_runner.start(async move { None });
        }
    }

    if task_runner.is_idle() && pending.0 {
        pending.0 = false;
        let snapshot = game_state.0.clone();
        let search_depth = strength.0;
        task_runner.start(async move {
            std::thread::sleep(ANIMATION_DURATION);
            pick_ai_move(&snapshot, search_depth)
        });
    }

    if let Poll::Ready(Some(player_move)) = task_runner.poll() {
        if game_state.apply(player_move).is_err() {
            let _ = game_state
                .legal_moves()
                .first()
                .copied()
                .and_then(|fallback| game_state.apply(fallback).ok());
        }
        board_resync_events.write(BoardResyncEvent);

        if game_state.winner().is_none() && game_state.to_move() == crate::PLAYER_AI {
            pending.0 = true;
        }
    }

    *interaction_state = InteractionState::from_game_state(&game_state);
}

pub fn plugin(app: &mut App) {
    #[cfg(target_arch = "wasm32")]
    let default_strength = 2u32;
    #[cfg(not(target_arch = "wasm32"))]
    let default_strength = if cfg!(debug_assertions) { 3 } else { 4 };

    app.init_resource::<AiPending>()
        .insert_resource(AiPlayerStrength(default_strength))
        .add_message::<AiComputationEvent>();

    #[cfg(target_arch = "wasm32")]
    app.init_resource::<WasmAiDelay>();

    app.add_systems(Update, perform_ai_moves.in_set(AiSet).after(StateUpdateSet));
}
