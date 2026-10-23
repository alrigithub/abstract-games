use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use bevy_tweening::{
    EaseMethod, Tween, TweenAnim, TweenState, TweeningPlugin, lens::TransformPositionLens,
    lens::TransformScaleLens,
};
use boop::{Coord, Piece, PieceKind, BOARD_SIZE};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    graphics::{
        PLACE_ANIMATION_DURATION, PIECE_MOVE_ANIMATION_DURATION, FOREGROUND_RENDER_LAYER,
        MainCamera, PieceMaterials, ScaleFactor,
        ScaleFactorSet, material_for, piece_mesh,
    },
    state_update::{
        BoardResyncEvent, BoardUpdateEvent, GameState, InteractionState, PlayerMoveEvent,
        HumanPieceChoice, StateUpdateSet,
    },
};

#[derive(Component)]
pub struct BoardElement {
    pub coord: Coord,
    pub piece: Piece,
}

#[derive(Component)]
pub struct CursorElement;

#[derive(Component)]
struct DespawnWhenTweenDone;

#[derive(Resource, Default)]
pub struct CursorCoord(pub Option<Coord>);

fn viewport_to_coord(
    viewport_pos: Vec2,
    camera: &Camera,
    camera_transform: &GlobalTransform,
    scale_factor: &ScaleFactor,
) -> Option<Coord> {
    let world_pos = camera
        .viewport_to_world(camera_transform, viewport_pos)
        .map(|ray| ray.origin.truncate())
        .ok()?;

    scale_factor.coord_at_world(world_pos)
}

fn setup_cursor(
    mut commands: Commands,
    materials: Res<PieceMaterials>,
) {
    let ghost = Piece {
        player: PLAYER_HUMAN,
        kind: PieceKind::Kitten,
    };
    commands.spawn((
        piece_mesh(
            &materials,
            materials.first_ghost.clone(),
            PieceKind::Kitten,
            Visibility::Hidden,
        ),
        BoardElement {
            coord: Coord::new(0, 0),
            piece: ghost,
        },
        CursorElement,
        FOREGROUND_RENDER_LAYER,
        Transform::default(),
    ));
}

fn off_board_glide_target(scale_factor: &ScaleFactor, from: Coord, push: (i8, i8)) -> Vec3 {
    let origin = scale_factor.screen_point(from);
    let direction = Vec2::new(push.0 as f32, -(push.1 as f32));
    if direction.length_squared() < f32::EPSILON {
        return origin;
    }
    origin + direction.normalize().extend(0.0) * scale_factor.spacing * 3.2
}

fn spawn_piece(
    commands: &mut Commands,
    materials: &PieceMaterials,
    scale_factor: &ScaleFactor,
    coord: Coord,
    piece: Piece,
    animate_scale: bool,
) {
    let material = material_for(materials, piece);
    let mut entity = commands.spawn((
        piece_mesh(
            materials,
            material,
            piece.kind,
            Visibility::Visible,
        ),
        BoardElement { coord, piece },
        FOREGROUND_RENDER_LAYER,
        Transform::from_translation(scale_factor.screen_point(coord))
            .with_scale(Vec3::splat(if animate_scale {
                0.01 * scale_factor.factor
            } else {
                scale_factor.factor
            })),
    ));

    if animate_scale {
        entity.insert(TweenAnim::new(Tween::new(
            EaseMethod::default(),
            PLACE_ANIMATION_DURATION,
            TransformScaleLens {
                start: Vec3::splat(0.01 * scale_factor.factor),
                end: Vec3::splat(scale_factor.factor),
            },
        )));
    }
}

fn handle_board_updates(
    mut board_update_events: MessageReader<BoardUpdateEvent>,
    mut commands: Commands,
    scale_factor: Res<ScaleFactor>,
    materials: Res<PieceMaterials>,
    mut q_pieces: Query<(Entity, &mut BoardElement, &mut Transform), Without<CursorElement>>,
) {
    for event in board_update_events.read() {
        match *event {
            BoardUpdateEvent::Spawn { coord, piece } => {
                for (entity, element, _) in q_pieces.iter() {
                    if element.coord == coord {
                        commands.entity(entity).despawn();
                    }
                }
                spawn_piece(
                    &mut commands,
                    &materials,
                    &scale_factor,
                    coord,
                    piece,
                    true,
                );
            }
            BoardUpdateEvent::Move { from, to, piece } => {
                let mover = q_pieces
                    .iter()
                    .find(|(_, element, _)| element.coord == from && element.piece == piece)
                    .map(|(entity, _, _)| entity);
                if let Some(mover_entity) = mover {
                    for (entity, element, _) in q_pieces.iter() {
                        if element.coord == to && entity != mover_entity {
                            commands.entity(entity).despawn();
                        }
                    }
                    if let Ok((_, mut element, mut transform)) = q_pieces.get_mut(mover_entity) {
                        element.coord = to;
                        element.piece = piece;
                        let tween = Tween::new(
                            EaseMethod::default(),
                            PIECE_MOVE_ANIMATION_DURATION,
                            TransformPositionLens {
                                start: scale_factor.screen_point(from),
                                end: scale_factor.screen_point(to),
                            },
                        );
                        commands.entity(mover_entity).insert(TweenAnim::new(tween));
                        transform.translation = scale_factor.screen_point(from);
                        transform.scale = Vec3::splat(scale_factor.factor);
                    }
                } else {
                    for (entity, element, _) in q_pieces.iter() {
                        if element.coord == to || element.coord == from {
                            commands.entity(entity).despawn();
                        }
                    }
                    spawn_piece(
                        &mut commands,
                        &materials,
                        &scale_factor,
                        to,
                        piece,
                        false,
                    );
                }
            }
            BoardUpdateEvent::Remove { coord, shrink } => {
                let victims: Vec<Entity> = q_pieces
                    .iter()
                    .filter(|(_, element, _)| element.coord == coord)
                    .map(|(entity, _, _)| entity)
                    .collect();
                for entity in victims {
                    if shrink {
                        if let Ok((_, _, mut transform)) = q_pieces.get_mut(entity) {
                            let scale = scale_factor.factor;
                            commands.entity(entity).insert((
                                TweenAnim::new(Tween::new(
                                    EaseMethod::default(),
                                    PIECE_MOVE_ANIMATION_DURATION,
                                    TransformScaleLens {
                                        start: Vec3::splat(scale),
                                        end: Vec3::splat(0.01 * scale),
                                    },
                                )),
                                DespawnWhenTweenDone,
                            ));
                            transform.scale = Vec3::splat(scale);
                        }
                    } else {
                        commands.entity(entity).despawn();
                    }
                }
            }
            BoardUpdateEvent::ExitBoard { from, piece, push } => {
                let glider = q_pieces
                    .iter()
                    .find(|(_, element, _)| element.coord == from && element.piece == piece)
                    .map(|(entity, _, _)| entity);
                if let Some(entity) = glider {
                    for (other, element, _) in q_pieces.iter() {
                        if element.coord == from && other != entity {
                            commands.entity(other).despawn();
                        }
                    }
                    if let Ok((_, element, mut transform)) = q_pieces.get_mut(entity) {
                        let _ = element;
                        let start = scale_factor.screen_point(from);
                        let end = off_board_glide_target(&scale_factor, from, push);
                        commands.entity(entity).insert((
                            TweenAnim::new(Tween::new(
                                EaseMethod::default(),
                                PIECE_MOVE_ANIMATION_DURATION,
                                TransformPositionLens { start, end },
                            )),
                            DespawnWhenTweenDone,
                        ));
                        transform.translation = start;
                        transform.scale = Vec3::splat(scale_factor.factor);
                    }
                }
            }
        }
    }
}

fn handle_resync(
    mut resync_events: MessageReader<BoardResyncEvent>,
    game_state: Res<GameState>,
    mut board_update_events: MessageWriter<BoardUpdateEvent>,
) {
    for _ in resync_events.read() {
        for y in 0..BOARD_SIZE as u8 {
            for x in 0..BOARD_SIZE as u8 {
                let coord = Coord { x, y };
                if let Some(piece) = game_state.board().get(coord) {
                    board_update_events.write(BoardUpdateEvent::Spawn { coord, piece });
                }
            }
        }
    }
}

fn clear_animators(
    q: Query<(Entity, &TweenAnim, Option<&DespawnWhenTweenDone>)>,
    mut commands: Commands,
) {
    for (entity, animator, despawn) in q.iter() {
        if matches!(animator.tween_state(), TweenState::Completed) {
            if despawn.is_some() {
                commands.entity(entity).remove::<TweenAnim>();
                commands.entity(entity).despawn();
            } else {
                commands.entity(entity).remove::<TweenAnim>();
            }
        }
    }
}

fn move_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<(&BoardElement, &mut Transform), Without<TweenAnim>>,
) {
    for (element, mut transform) in query.iter_mut() {
        transform.translation = scale_factor.screen_point(element.coord);
    }
}

fn scale_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<&mut Transform, (With<BoardElement>, Without<TweenAnim>)>,
) {
    for mut transform in query.iter_mut() {
        transform.scale = Vec3::splat(scale_factor.factor);
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
fn update_cursor(
    scale_factor: Res<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    selected_piece: Res<HumanPieceChoice>,
    mut cursor_coord: ResMut<CursorCoord>,
    materials: Res<PieceMaterials>,
    mut cursor: Query<
        (
            &mut BoardElement,
            &mut Visibility,
            &mut Transform,
            &mut MeshMaterial2d<ColorMaterial>,
        ),
        With<CursorElement>,
    >,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let Ok((camera, camera_transform)) = q_camera.single() else {
        return;
    };

    cursor_coord.0 = window
        .cursor_position()
        .and_then(|pos| viewport_to_coord(pos, camera, camera_transform, &scale_factor));

    let Ok((mut element, mut visibility, mut transform, mut material)) = cursor.single_mut() else {
        return;
    };

    let human_turn = matches!(
        *interaction_state,
        InteractionState::HumanPlace | InteractionState::HumanFullBed
    );
    if !human_turn {
        *visibility = Visibility::Hidden;
        return;
    }

    let kind = selected_piece.0;

    if matches!(*interaction_state, InteractionState::HumanFullBed) {
        let Some(coord) = cursor_coord.0 else {
            *visibility = Visibility::Hidden;
            return;
        };
        let Some(piece) = game_state.board().get(coord) else {
            *visibility = Visibility::Hidden;
            return;
        };
        if piece.player != PLAYER_HUMAN {
            *visibility = Visibility::Hidden;
            return;
        }
        let legal = game_state
            .move_for_interaction(PLAYER_HUMAN, coord, kind)
            .is_some();
        if !legal {
            *visibility = Visibility::Hidden;
            return;
        }
        *visibility = Visibility::Visible;
        element.coord = coord;
        element.piece = piece;
        transform.translation = scale_factor.screen_point(coord);
        transform.scale = Vec3::splat(scale_factor.factor * 1.08);
        material.0 = materials.first_ghost.clone();
        return;
    }

    if let Some(coord) = cursor_coord.0
        && game_state.board().get(coord).is_none()
    {
        *visibility = Visibility::Visible;
        element.coord = coord;
        element.piece = Piece {
            player: PLAYER_HUMAN,
            kind,
        };
        transform.translation = scale_factor.screen_point(coord);
        transform.scale = Vec3::splat(scale_factor.factor);
        material.0 = if kind == PieceKind::Cat && game_state.pool(PLAYER_HUMAN).cats_in_hand > 0
        {
            materials.first_cat.clone()
        } else {
            materials.first_ghost.clone()
        };
        return;
    }

    *visibility = Visibility::Hidden;
}

fn handle_clicks(
    mouse: Res<ButtonInput<MouseButton>>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
    game_state: Res<GameState>,
    selected_piece: Res<HumanPieceChoice>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !mouse.just_pressed(MouseButton::Left) {
        return;
    }
    if !matches!(
        *interaction_state,
        InteractionState::HumanPlace | InteractionState::HumanFullBed
    ) {
        return;
    }
    let Some(coord) = cursor_coord.0 else {
        return;
    };

    let Some(player_move) =
        game_state.move_for_interaction(PLAYER_HUMAN, coord, selected_piece.0)
    else {
        return;
    };

    player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, player_move));
}

fn set_cursor_icon(
    interaction_state: Res<InteractionState>,
    q_window: Query<Entity, With<PrimaryWindow>>,
    mut commands: Commands,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let icon = if matches!(
        *interaction_state,
        InteractionState::HumanPlace | InteractionState::HumanFullBed | InteractionState::HumanNoMoves
    ) {
        CursorIcon::System(SystemCursorIcon::Pointer)
    } else {
        CursorIcon::System(SystemCursorIcon::Progress)
    };
    commands.entity(window).insert(icon);
}

pub fn plugin(app: &mut App) {
    app.init_resource::<CursorCoord>()
        .add_plugins(TweeningPlugin)
        .add_systems(Startup, setup_cursor)
        .add_systems(
            Update,
            (
                handle_resync.before(handle_board_updates),
                handle_board_updates
                    .after(StateUpdateSet)
                    .before(clear_animators),
                clear_animators,
                move_board_elements.after(ScaleFactorSet),
                scale_board_elements.after(ScaleFactorSet),
                update_cursor.after(ScaleFactorSet),
                handle_clicks.before(StateUpdateSet).ambiguous_with(AiSet),
                set_cursor_icon,
            ),
        );
}
