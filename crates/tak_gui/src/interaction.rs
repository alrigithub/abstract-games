use bevy::ecs::message::{MessageReader, MessageWriter};
use bevy::prelude::*;
use bevy::window::{CursorIcon, PrimaryWindow, SystemCursorIcon};
use bevy_tweening::{TweenAnim, TweenState, TweeningPlugin};
use tak::{BOARD_SIZE, Coord, Move, Player, StoneKind};

use crate::{
    PLAYER_HUMAN,
    ai::AiSet,
    graphics::{
        FOREGROUND_RENDER_LAYER, MainCamera, PieceMaterials, ScaleFactor, ScaleFactorSet,
        material_for, piece_mesh, piece_mesh2d,
    },
    state_update::{
        BoardResyncEvent, GameState, InteractionState, PlayerMoveEvent, StateUpdateSet,
    },
};

#[derive(Component)]
pub struct BoardElement {
    pub coord: Coord,
}

#[derive(Component)]
pub struct CursorElement;

#[derive(Component)]
struct CursorGhostKind(StoneKind);

#[derive(Resource, Default)]
pub struct CursorCoord(pub Option<Coord>);

#[derive(Resource, Default)]
pub struct SelectedStack(pub Option<Coord>);

#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlaceKind(pub StoneKind);

impl Default for PlaceKind {
    fn default() -> Self {
        Self(StoneKind::Flat)
    }
}

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
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
) {
    commands.spawn((
        piece_mesh(
            &mut meshes,
            materials.human_ghost.clone(),
            StoneKind::Flat,
            Visibility::Hidden,
        ),
        BoardElement {
            coord: Coord::new(0, 0),
        },
        CursorElement,
        CursorGhostKind(StoneKind::Flat),
        FOREGROUND_RENDER_LAYER,
    ));
}

fn spawn_stack_visual(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &PieceMaterials,
    scale_factor: &ScaleFactor,
    coord: Coord,
    game_state: &GameState,
) {
    let stack = game_state.board().stack(coord);
    let Some(top) = stack.last().copied() else {
        return;
    };
    let height = stack.len();
    let z_step = 3.0 * scale_factor.factor;
    for (i, stone) in stack.iter().enumerate() {
        let material = material_for(materials, stone.owner, stone.kind);
        let mut transform = Transform::from_translation(
            scale_factor.screen_point(coord) + Vec3::new(0., 0., i as f32 * z_step),
        );
        transform.scale = Vec3::splat(scale_factor.factor);
        commands.spawn((
            piece_mesh(meshes, material, stone.kind, Visibility::Visible),
            BoardElement { coord },
            FOREGROUND_RENDER_LAYER,
            transform,
        ));
    }
    let _ = top;
    let _ = height;
}

fn handle_resync(
    mut resync_events: MessageReader<BoardResyncEvent>,
    game_state: Res<GameState>,
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
    scale_factor: Res<ScaleFactor>,
    q_pieces: Query<Entity, (With<BoardElement>, Without<CursorElement>)>,
) {
    for _ in resync_events.read() {
        for entity in q_pieces.iter() {
            commands.entity(entity).despawn();
        }
        for y in 0..BOARD_SIZE as u8 {
            for x in 0..BOARD_SIZE as u8 {
                let coord = Coord { x, y };
                if !game_state.board().is_empty(coord) {
                    spawn_stack_visual(
                        &mut commands,
                        &mut meshes,
                        &materials,
                        &scale_factor,
                        coord,
                        &game_state,
                    );
                }
            }
        }
    }
}

fn startup_board(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    materials: Res<PieceMaterials>,
    scale_factor: Res<ScaleFactor>,
    game_state: Res<GameState>,
    mut resync: MessageWriter<BoardResyncEvent>,
) {
    let _ = (
        &mut commands,
        &mut meshes,
        &materials,
        &scale_factor,
        &game_state,
    );
    resync.write(BoardResyncEvent);
}

fn clear_animators(q: Query<(Entity, &TweenAnim)>, mut commands: Commands) {
    for (entity, animator) in q.iter() {
        if matches!(animator.tween_state(), TweenState::Completed) {
            commands.entity(entity).remove::<TweenAnim>();
        }
    }
}

fn move_board_elements(
    scale_factor: Res<ScaleFactor>,
    mut query: Query<(&BoardElement, &mut Transform), Without<TweenAnim>>,
) {
    for (element, mut transform) in query.iter_mut() {
        let base = scale_factor.screen_point(element.coord);
        transform.translation.x = base.x;
        transform.translation.y = base.y;
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

#[allow(clippy::too_many_arguments)]
fn update_cursor(
    scale_factor: Res<ScaleFactor>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    interaction_state: Res<InteractionState>,
    game_state: Res<GameState>,
    place_kind: Res<PlaceKind>,
    mut cursor_coord: ResMut<CursorCoord>,
    materials: Res<PieceMaterials>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut cursor: Query<
        (
            &mut BoardElement,
            &mut Visibility,
            &mut Transform,
            &mut MeshMaterial2d<ColorMaterial>,
            &mut Mesh2d,
            &mut CursorGhostKind,
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

    let Ok((mut element, mut visibility, mut transform, mut material, mut mesh, mut ghost_kind)) =
        cursor.single_mut()
    else {
        return;
    };

    if !matches!(*interaction_state, InteractionState::HumanTurn) {
        *visibility = Visibility::Hidden;
        return;
    }

    let kind = effective_place_kind(&game_state, place_kind.0);
    if ghost_kind.0 != kind {
        ghost_kind.0 = kind;
        *mesh = piece_mesh2d(&mut meshes, kind);
    }
    if let Some(coord) = cursor_coord.0
        && game_state.board().is_empty(coord)
        && can_place(&game_state, kind)
    {
        *visibility = Visibility::Visible;
        element.coord = coord;
        transform.translation = scale_factor.screen_point(coord);
        transform.scale = Vec3::splat(scale_factor.factor);
        material.0 = if game_state.placement_phase() {
            materials.human_ghost.clone()
        } else {
            material_for(&materials, PLAYER_HUMAN, kind)
        };
        return;
    }

    *visibility = Visibility::Hidden;
}

fn effective_place_kind(game_state: &GameState, kind: StoneKind) -> StoneKind {
    if game_state.placement_phase() {
        return StoneKind::Flat;
    }
    kind
}

fn can_place(game_state: &GameState, kind: StoneKind) -> bool {
    if game_state.placement_phase() {
        return matches!(kind, StoneKind::Flat)
            && game_state.reserve(game_state.to_move().opponent()).flats > 0;
    }
    let reserve = game_state.reserve(PLAYER_HUMAN);
    match kind {
        StoneKind::Flat | StoneKind::Wall => reserve.flats > 0,
        StoneKind::Cap => reserve.cap > 0,
    }
}

fn click_coord(
    mouse: &ButtonInput<MouseButton>,
    touches: &Touches,
    q_window: &Query<&Window, With<PrimaryWindow>>,
    q_camera: &Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    scale_factor: &ScaleFactor,
    cursor_coord: &CursorCoord,
) -> Option<Coord> {
    if let Some(touch) = touches.iter_just_pressed().next() {
        let Ok((camera, camera_transform)) = q_camera.single() else {
            return None;
        };
        return viewport_to_coord(touch.position(), camera, camera_transform, scale_factor);
    }
    if !mouse.just_pressed(MouseButton::Left) {
        return None;
    }
    let Ok(window) = q_window.single() else {
        return None;
    };
    let Ok((camera, camera_transform)) = q_camera.single() else {
        return None;
    };
    window
        .cursor_position()
        .and_then(|pos| viewport_to_coord(pos, camera, camera_transform, scale_factor))
        .or(cursor_coord.0)
}

fn handle_clicks(
    mouse: Res<ButtonInput<MouseButton>>,
    touches: Res<Touches>,
    q_window: Query<&Window, With<PrimaryWindow>>,
    q_camera: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    scale_factor: Res<ScaleFactor>,
    interaction_state: Res<InteractionState>,
    cursor_coord: Res<CursorCoord>,
    game_state: Res<GameState>,
    place_kind: Res<PlaceKind>,
    mut selected: ResMut<SelectedStack>,
    mut player_move_events: MessageWriter<PlayerMoveEvent>,
) {
    if !matches!(*interaction_state, InteractionState::HumanTurn) {
        return;
    }
    let Some(coord) = click_coord(
        &mouse,
        &touches,
        &q_window,
        &q_camera,
        &scale_factor,
        &cursor_coord,
    ) else {
        return;
    };

    if let Some(from) = selected.0 {
        if from == coord {
            selected.0 = None;
            return;
        }
        if let Some(m) = game_state.slide_to(from, coord) {
            player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, m));
            selected.0 = None;
            return;
        }
    }

    if game_state.board().controlled_by(coord) == Some(PLAYER_HUMAN) {
        selected.0 = Some(coord);
        return;
    }

    if game_state.board().is_empty(coord) {
        let kind = effective_place_kind(&game_state, place_kind.0);
        let m = Move::Place { coord, kind };
        if game_state.legal_moves().contains(&m) {
            player_move_events.write(PlayerMoveEvent(PLAYER_HUMAN, m));
            selected.0 = None;
        }
    }
}

fn set_cursor_icon(
    interaction_state: Res<InteractionState>,
    q_window: Query<Entity, With<PrimaryWindow>>,
    mut commands: Commands,
) {
    let Ok(window) = q_window.single() else {
        return;
    };
    let icon = if matches!(*interaction_state, InteractionState::HumanTurn) {
        CursorIcon::System(SystemCursorIcon::Pointer)
    } else {
        CursorIcon::System(SystemCursorIcon::Progress)
    };
    commands.entity(window).insert(icon);
}

pub fn plugin(app: &mut App) {
    app.init_resource::<CursorCoord>()
        .init_resource::<SelectedStack>()
        .init_resource::<PlaceKind>()
        .add_plugins(TweeningPlugin)
        .add_systems(Startup, (setup_cursor, startup_board))
        .add_systems(
            Update,
            (
                handle_resync.after(StateUpdateSet),
                clear_animators,
                move_board_elements.after(ScaleFactorSet),
                scale_board_elements.after(ScaleFactorSet),
                update_cursor.after(ScaleFactorSet),
                handle_clicks
                    .after(update_cursor)
                    .before(StateUpdateSet)
                    .ambiguous_with(AiSet),
                set_cursor_icon,
            ),
        );
}
