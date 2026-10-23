use std::collections::HashSet;

use bevy::prelude::*;
use bevy_tweening::{Tween, TweenAnim, lens::TransformPositionLens};
use yinsh::TurnMode;

use crate::board::BoardElement;
use crate::graphics::{
    ANIMATION_DURATION, BACKGROUND_RENDER_LAYER, COLOR_GRID, COLOR_WIN_GLOW, ScaleFactor,
    ScaleFactorSet,
};
use crate::state_update::{GameState, InteractionState, StateUpdateSet};

/// How long the score-line glow stays after markers and ring are removed.
pub const SCORE_LINGER_SECS: f32 = 0.9;

#[derive(Component)]
pub struct ScoreLineGlow;

#[derive(Component)]
pub struct RackedRing {
    pub player: yinsh::Player,
    pub slot: usize,
}

#[derive(Resource, Default)]
pub struct ScoringPresentation {
    /// The five cells of the line that was just scored (kept through linger).
    pub scored_line: Vec<yinsh::Coord>,
    pub linger: Option<Timer>,
    pub deferred_ai: bool,
}

impl ScoringPresentation {
    pub fn is_blocking(&self) -> bool {
        self.linger.is_some()
    }
}

#[derive(Resource)]
pub struct ScoringMaterials {
    pub glow_inner: Handle<ColorMaterial>,
    pub glow_outer: Handle<ColorMaterial>,
}

#[derive(Component)]
struct RackSlotOutline {
    player: yinsh::Player,
    slot: usize,
}

fn setup_scoring_materials(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    scale_factor: Res<ScaleFactor>,
) {
    commands.insert_resource(ScoringMaterials {
        glow_inner: materials.add(ColorMaterial {
            color: COLOR_WIN_GLOW.with_alpha(0.45),
            ..default()
        }),
        glow_outer: materials.add(ColorMaterial {
            color: COLOR_WIN_GLOW.with_alpha(0.18),
            ..default()
        }),
    });

    let outline = materials.add(ColorMaterial {
        color: COLOR_GRID.with_alpha(0.55),
        ..default()
    });

    for player in [yinsh::Player::A, yinsh::Player::B] {
        for slot in 0..3 {
            let position = rack_slot_position(&scale_factor, player, slot);
            commands.spawn((
                // Same annulus as board rings — empty scored-ring slot off the playfield.
                Mesh2d(meshes.add(Annulus::new(20., 25.))),
                MeshMaterial2d(outline.clone()),
                RackSlotOutline { player, slot },
                Transform::from_translation(position).with_scale(Vec3::splat(scale_factor.factor)),
                BACKGROUND_RENDER_LAYER,
            ));
        }
    }
}

pub fn rack_slot_position(scale_factor: &ScaleFactor, player: yinsh::Player, slot: usize) -> Vec3 {
    // Outside the playable hex footprint (outer ring ~±4.3× spacing in x).
    let side_x = scale_factor.spacing * 6.0;
    let base_y = scale_factor.spacing * 1.0;
    let step = scale_factor.spacing * 0.52;
    match player {
        yinsh::Player::A => Vec3::new(-side_x, base_y - slot as f32 * step, 0.0),
        yinsh::Player::B => Vec3::new(side_x, base_y - slot as f32 * step, 0.0),
    }
}

fn glow_coords_from_state(game_state: &GameState, scoring: &ScoringPresentation) -> Vec<yinsh::Coord> {
    if !scoring.scored_line.is_empty() {
        return scoring.scored_line.clone();
    }

    match game_state.turn_mode {
        TurnMode::WaitForRunRemoval(p) => dedupe_coords(game_state.board.run_coords(p)),
        TurnMode::RunRemoval(_) => dedupe_coords(game_state.board.run_coords(game_state.active_player)),
        _ => Vec::new(),
    }
}

fn dedupe_coords(coords: Vec<yinsh::Coord>) -> Vec<yinsh::Coord> {
    coords.into_iter().collect::<HashSet<_>>().into_iter().collect()
}

fn coord_from_world(scale_factor: &ScaleFactor, world: Vec3) -> yinsh::Coord {
    yinsh::all_coords()
        .into_iter()
        .min_by(|a, b| {
            let da = (scale_factor.screen_point(*a).truncate() - world.truncate()).length_squared();
            let db = (scale_factor.screen_point(*b).truncate() - world.truncate()).length_squared();
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap()
}

fn sync_score_line_glow(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    scoring: Res<ScoringPresentation>,
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    materials: Res<ScoringMaterials>,
    q_glow: Query<(Entity, &Transform), With<ScoreLineGlow>>,
) {
    let desired: HashSet<yinsh::Coord> = if scoring.is_blocking() {
        scoring.active_glow_coords()
    } else {
        glow_coords_from_state(&game_state, &scoring).into_iter().collect()
    };

    let existing: HashSet<yinsh::Coord> = q_glow
        .iter()
        .map(|(_, t)| coord_from_world(&scale_factor, t.translation))
        .collect();

    if desired == existing {
        return;
    }

    for (entity, _) in q_glow.iter() {
        commands.entity(entity).despawn();
    }

    let piece_scale = scale_factor.factor;
    for coord in desired {
        let center = scale_factor.screen_point(coord);
        for (radius, mat) in [
            (26.0, materials.glow_outer.clone()),
            (18.0, materials.glow_inner.clone()),
        ] {
            commands.spawn((
                Mesh2d(meshes.add(Circle::new(radius))),
                MeshMaterial2d(mat),
                Transform::from_translation(center + Vec3::new(0.0, 0.0, -0.2))
                    .with_scale(Vec3::splat(piece_scale)),
                ScoreLineGlow,
                BACKGROUND_RENDER_LAYER,
            ));
        }
    }
}

impl ScoringPresentation {
    fn active_glow_coords(&self) -> HashSet<yinsh::Coord> {
        self.scored_line.iter().copied().collect()
    }
}

fn scoring_linger_tick(
    time: Res<Time>,
    mut scoring: ResMut<ScoringPresentation>,
    mut interaction_state: ResMut<InteractionState>,
    mut ai_events: MessageWriter<crate::ai::AiComputationEvent>,
    game_state: Res<GameState>,
    q_glow: Query<Entity, With<ScoreLineGlow>>,
    mut commands: Commands,
) {
    let Some(timer) = scoring.linger.as_mut() else {
        return;
    };

    *interaction_state = InteractionState::ScoringPause;
    timer.tick(time.delta());

    if !timer.is_finished() {
        return;
    }

    scoring.linger = None;
    scoring.scored_line.clear();
    for entity in q_glow.iter() {
        commands.entity(entity).despawn();
    }

    *interaction_state = InteractionState::from_game_state(&game_state);

    if scoring.deferred_ai {
        scoring.deferred_ai = false;
        if game_state.active_player == crate::PLAYER_AI && game_state.winner().is_none() {
            ai_events.write(crate::ai::AiComputationEvent::Start(
                crate::PLAYER_AI,
                (**game_state).clone(),
            ));
        }
    }
}

pub fn move_ring_to_rack(
    commands: &mut Commands,
    entity: Entity,
    player: yinsh::Player,
    slot: usize,
    from: Vec3,
    to: Vec3,
) {
    let tween = Tween::new(
        bevy::prelude::EaseFunction::QuadraticInOut,
        ANIMATION_DURATION,
        TransformPositionLens { start: from, end: to },
    );
    commands.entity(entity).insert((
        TweenAnim::new(tween),
        RackedRing { player, slot },
        Transform::from_translation(from),
    ));
    commands.entity(entity).remove::<BoardElement>();
}

fn sync_rack_slot_outlines(
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    mut q_slots: Query<(&RackSlotOutline, &mut Transform)>,
) {
    for (slot, mut transform) in q_slots.iter_mut() {
        let points = match slot.player {
            yinsh::Player::A => game_state.points_a,
            yinsh::Player::B => game_state.points_b,
        };
        transform.translation =
            rack_slot_position(&scale_factor, slot.player, slot.slot);
        transform.scale = if slot.slot < points {
            Vec3::splat(0.0)
        } else {
            Vec3::splat(scale_factor.factor)
        };
    }
}

pub fn sync_racked_rings(
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    mut q_racked: Query<(&RackedRing, &mut Transform), Without<TweenAnim>>,
) {
    for (racked, mut transform) in q_racked.iter_mut() {
        let points = match racked.player {
            yinsh::Player::A => game_state.points_a,
            yinsh::Player::B => game_state.points_b,
        };
        if racked.slot < points {
            transform.translation =
                rack_slot_position(&scale_factor, racked.player, racked.slot);
            transform.scale = Vec3::splat(scale_factor.factor);
        }
    }
}

pub fn plugin(app: &mut App) {
    app.init_resource::<ScoringPresentation>()
        .add_systems(Startup, setup_scoring_materials)
        .add_systems(
            Update,
            (
                sync_score_line_glow.after(ScaleFactorSet),
                scoring_linger_tick.after(StateUpdateSet),
                sync_racked_rings.after(ScaleFactorSet),
                sync_rack_slot_outlines.after(ScaleFactorSet),
            ),
        );
}
