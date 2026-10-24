use std::collections::HashSet;

use bevy::prelude::*;
use bevy_tweening::{Tween, TweenAnim, lens::TransformPositionLens};
use yinsh::TurnMode;

use crate::board::BoardElement;
use abstract_gui_theme::{
    apply_glow_pulse, rack_outline, score_dust_rgb, score_dust_speck, setup_win_glow_materials,
    GlowPulse, WinGlowMaterials,
};
use crate::graphics::{
    ANIMATION_DURATION, BACKGROUND_RENDER_LAYER, FOREGROUND_RENDER_LAYER, ScaleFactor,
    ScaleFactorSet,
};
use crate::state_update::{GameState, InteractionState, StateUpdateSet};

/// How long the scored line stays highlighted after the ring is removed.
pub const SCORE_LINGER_SECS: f32 = 0.85;

#[derive(Component)]
pub struct ScoreLineGlow;

#[derive(Component)]
struct ScoreDust {
    velocity: Vec2,
    lifetime: Timer,
    start_alpha: f32,
}

const DUST_SPECKS_PER_CELL: usize = 16;
const DUST_LIFETIME_SECS: f32 = 0.75;

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

    /// Drop any in-flight score presentation (used on undo / reset).
    pub fn reset(&mut self) {
        self.scored_line.clear();
        self.linger = None;
        self.deferred_ai = false;
    }
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
    commands.insert_resource(setup_win_glow_materials(&mut materials));

    let outline = materials.add(ColorMaterial {
        color: rack_outline(),
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
    // Just inside the window edge (ring outer radius is 25 in mesh units).
    // `set_scale_factor` budgets the extra horizontal room so this clears the
    // board's widest row instead of landing off-screen.
    let side_x = scale_factor.half_width - 31.0 * scale_factor.factor;
    // Slots must be at least one ring diameter (50 units) apart.
    let step = scale_factor.spacing * 0.7;
    let base_y = step;
    match player {
        yinsh::Player::A => Vec3::new(-side_x, base_y - slot as f32 * step, 0.0),
        yinsh::Player::B => Vec3::new(side_x, base_y - slot as f32 * step, 0.0),
    }
}

fn glow_coords_from_state(
    game_state: &GameState,
    scoring: &ScoringPresentation,
) -> Vec<yinsh::Coord> {
    if !scoring.scored_line.is_empty() {
        return scoring.scored_line.clone();
    }

    match game_state.turn_mode {
        TurnMode::WaitForRunRemoval(p) => dedupe_coords(game_state.board.run_coords(p)),
        TurnMode::RunRemoval(_) => {
            dedupe_coords(game_state.board.run_coords(game_state.active_player))
        }
        _ => Vec::new(),
    }
}

fn dedupe_coords(coords: Vec<yinsh::Coord>) -> Vec<yinsh::Coord> {
    coords
        .into_iter()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
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
    materials: Res<WinGlowMaterials>,
    q_glow: Query<(Entity, &Transform), With<ScoreLineGlow>>,
) {
    let desired: HashSet<yinsh::Coord> = if scoring.is_blocking() {
        scoring.active_glow_coords()
    } else {
        glow_coords_from_state(&game_state, &scoring)
            .into_iter()
            .collect()
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
            (34.0, materials.halo.clone()),
            (18.0, materials.core.clone()),
        ] {
            commands.spawn((
                Mesh2d(meshes.add(Circle::new(radius))),
                MeshMaterial2d(mat),
                Transform::from_translation(center + Vec3::new(0.0, 0.0, -0.2))
                    .with_scale(Vec3::splat(piece_scale)),
                ScoreLineGlow,
                GlowPulse {
                    base_scale: piece_scale,
                },
                BACKGROUND_RENDER_LAYER,
            ));
        }
    }
}

fn pulse_score_line_glow(
    time: Res<Time>,
    scoring: Res<ScoringPresentation>,
    mut q: Query<(&GlowPulse, &mut Transform), With<ScoreLineGlow>>,
) {
    let intense = scoring.is_blocking();
    let active = intense || !scoring.scored_line.is_empty();
    apply_glow_pulse(time, intense, active, &mut q);
}

fn dust_rand(seed: u32) -> impl FnMut() -> f32 {
    let mut s = seed.max(1);
    move || {
        s = s.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        s as f32 / u32::MAX as f32
    }
}

fn spawn_score_dust_burst(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    scoring: Res<ScoringPresentation>,
    scale_factor: Res<ScaleFactor>,
    mut last_line: Local<Vec<yinsh::Coord>>,
) {
    if scoring.scored_line.is_empty() {
        *last_line = Vec::new();
        return;
    }
    if *last_line == scoring.scored_line {
        return;
    }
    *last_line = scoring.scored_line.clone();

    let mesh = meshes.add(Circle::new(2.8));
    let piece_scale = scale_factor.factor;
    let spread = scale_factor.spacing * 0.35;

    for (cell_index, coord) in scoring.scored_line.iter().copied().enumerate() {
        let origin = scale_factor.screen_point(coord);
        let seed = (coord.x as i32 as u32)
            .wrapping_mul(997)
            .wrapping_add(coord.y as u32)
            ^ cell_index as u32;
        let mut rand = dust_rand(seed);

        for speck in 0..DUST_SPECKS_PER_CELL {
            let angle = rand() * std::f32::consts::TAU;
            let speed = 55.0 + rand() * 95.0;
            let velocity = Vec2::new(angle.cos(), angle.sin()) * speed;
            let offset = Vec2::new((rand() - 0.5) * spread, (rand() - 0.5) * spread);
            let (r, g, b) = score_dust_rgb(&mut rand);
            let start_alpha = 0.55 + rand() * 0.4;
            let material = materials.add(ColorMaterial {
                color: score_dust_speck(r, g, b, start_alpha),
                ..default()
            });

            commands.spawn((
                Mesh2d(mesh.clone()),
                MeshMaterial2d(material),
                Transform::from_translation(origin + offset.extend(0.15))
                    .with_scale(Vec3::splat(piece_scale * (0.7 + rand() * 0.6))),
                ScoreDust {
                    velocity,
                    lifetime: Timer::from_seconds(DUST_LIFETIME_SECS, TimerMode::Once),
                    start_alpha,
                },
                FOREGROUND_RENDER_LAYER,
            ));
            let _ = speck;
        }
    }
}

fn tick_score_dust(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(
        Entity,
        &mut Transform,
        &mut ScoreDust,
        &MeshMaterial2d<ColorMaterial>,
    )>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    for (entity, mut transform, mut dust, mat) in q.iter_mut() {
        dust.lifetime.tick(time.delta());
        let t = dust.lifetime.fraction().clamp(0.0, 1.0);
        transform.translation.x += dust.velocity.x * time.delta_secs();
        transform.translation.y += dust.velocity.y * time.delta_secs();
        dust.velocity *= 0.92_f32.powf(time.delta_secs() * 60.0);

        if let Some(color_mat) = materials.get_mut(&mat.0) {
            let a = dust.start_alpha * (1.0 - t).powf(1.4);
            color_mat.color = color_mat.color.with_alpha(a);
        }

        if dust.lifetime.is_finished() {
            commands.entity(entity).despawn();
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
        TransformPositionLens {
            start: from,
            end: to,
        },
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
        transform.translation = rack_slot_position(&scale_factor, slot.player, slot.slot);
        transform.scale = if slot.slot < points {
            Vec3::splat(0.0)
        } else {
            Vec3::splat(scale_factor.factor)
        };
    }
}

pub fn sync_racked_rings(
    mut commands: Commands,
    game_state: Res<GameState>,
    scale_factor: Res<ScaleFactor>,
    mut q_racked: Query<(Entity, &RackedRing, &mut Transform), Without<TweenAnim>>,
) {
    for (entity, racked, mut transform) in q_racked.iter_mut() {
        let points = match racked.player {
            yinsh::Player::A => game_state.points_a,
            yinsh::Player::B => game_state.points_b,
        };
        if racked.slot < points {
            transform.translation = rack_slot_position(&scale_factor, racked.player, racked.slot);
            transform.scale = Vec3::splat(scale_factor.factor);
        } else {
            // Undo / reset rolled the score back; the board copy of this ring
            // is respawned by `restore_board_from_game_state`.
            commands.entity(entity).despawn();
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
                pulse_score_line_glow.after(sync_score_line_glow),
                spawn_score_dust_burst.after(StateUpdateSet),
                tick_score_dust,
                scoring_linger_tick.after(StateUpdateSet),
                sync_racked_rings.after(ScaleFactorSet),
                sync_rack_slot_outlines.after(ScaleFactorSet),
            ),
        );
}
