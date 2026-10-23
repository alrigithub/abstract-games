use std::f32::consts::TAU;

use bevy::{
    asset::RenderAssetUsages, mesh::Indices, prelude::*, render::render_resource::PrimitiveTopology,
};
use tzaar::{Piece, PieceKind, Player};

use crate::board_entity::{BoardElement, CursorElement};
use crate::graphics::{BASE_SPACING, FOREGROUND_RENDER_LAYER, PIECE_RADIUS_FRAC};

/// Shared outer radius in mesh space (`transform.scale` applies `ScaleFactor::factor`).
pub const PIECE_RADIUS: f32 = BASE_SPACING * PIECE_RADIUS_FRAC;

pub const INK: Color = Color::srgb(0.06, 0.06, 0.07);
pub const PAPER: Color = Color::srgb(0.96, 0.94, 0.88);
pub const MARK_ON_DARK: Color = Color::srgb(0.92, 0.90, 0.84);

const RING_SEGMENTS: u32 = 40;
const STROKE: f32 = 2.4;

#[derive(Resource)]
pub struct PieceDrawMaterials {
    pub fill_dark: Handle<ColorMaterial>,
    pub fill_light: Handle<ColorMaterial>,
    pub mark_dark: Handle<ColorMaterial>,
    pub mark_light: Handle<ColorMaterial>,
}

#[derive(Resource)]
pub struct PieceMeshes {
    pub fill: Handle<Mesh>,
    pub outline: Handle<Mesh>,
    pub inner_ring: Handle<Mesh>,
    pub center_dot: Handle<Mesh>,
}

fn ring_mesh(inner_radius: f32, outer_radius: f32) -> Mesh {
    let mut positions = Vec::with_capacity(RING_SEGMENTS as usize * 4);
    let mut indices = Vec::with_capacity(RING_SEGMENTS as usize * 6);
    for i in 0..RING_SEGMENTS {
        let a0 = i as f32 / RING_SEGMENTS as f32 * TAU;
        let a1 = (i + 1) as f32 / RING_SEGMENTS as f32 * TAU;
        let (s0, c0) = a0.sin_cos();
        let (s1, c1) = a1.sin_cos();
        let base = positions.len() as u32;
        positions.push([c0 * outer_radius, s0 * outer_radius, 0.0]);
        positions.push([c1 * outer_radius, s1 * outer_radius, 0.0]);
        positions.push([c0 * inner_radius, s0 * inner_radius, 0.0]);
        positions.push([c1 * inner_radius, s1 * inner_radius, 0.0]);
        indices.extend_from_slice(&[base, base + 1, base + 2, base + 1, base + 3, base + 2]);
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_indices(Indices::U32(indices));
    mesh
}

pub fn setup_piece_assets(
    mut commands: Commands,
    mut materials: ResMut<Assets<ColorMaterial>>,
    mut meshes: ResMut<Assets<Mesh>>,
) {
    commands.insert_resource(PieceDrawMaterials {
        fill_dark: materials.add(ColorMaterial::from(INK)),
        fill_light: materials.add(ColorMaterial::from(PAPER)),
        mark_dark: materials.add(ColorMaterial::from(INK)),
        mark_light: materials.add(ColorMaterial::from(MARK_ON_DARK)),
    });

    commands.insert_resource(PieceMeshes {
        fill: meshes.add(Circle::new(PIECE_RADIUS)),
        outline: meshes.add(ring_mesh(PIECE_RADIUS - STROKE, PIECE_RADIUS)),
        inner_ring: meshes.add(ring_mesh(PIECE_RADIUS * 0.48, PIECE_RADIUS * 0.58)),
        center_dot: meshes.add(Circle::new(PIECE_RADIUS * 0.16)),
    });
}

fn spawn_part(
    commands: &mut Commands,
    mesh: Handle<Mesh>,
    material: Handle<ColorMaterial>,
    transform: Transform,
    visibility: Visibility,
    board: BoardElement,
    cursor: bool,
) {
    if cursor {
        commands.spawn((
            Mesh2d(mesh),
            MeshMaterial2d(material),
            transform,
            visibility,
            FOREGROUND_RENDER_LAYER,
            board,
            CursorElement,
        ));
    } else {
        commands.spawn((
            Mesh2d(mesh),
            MeshMaterial2d(material),
            transform,
            visibility,
            FOREGROUND_RENDER_LAYER,
            board,
        ));
    }
}

/// Top-of-stack glyph. Every type uses the same outer radius; markings differ.
pub fn spawn_stack_piece_at(
    commands: &mut Commands,
    piece_meshes: &PieceMeshes,
    materials: &PieceDrawMaterials,
    piece: Piece,
    ghost: bool,
    transform: Transform,
    board: BoardElement,
    cursor: bool,
) {
    let z = transform.translation.z;
    let visibility = if cursor {
        Visibility::Hidden
    } else {
        Visibility::Visible
    };

    let spawn_layer =
        |commands: &mut Commands, mesh: Handle<Mesh>, mat: Handle<ColorMaterial>, dz: f32| {
            let mut t = transform;
            t.translation.z = z + dz;
            spawn_part(commands, mesh, mat, t, visibility, board, cursor);
        };

    let (fill, mark) = match piece.player {
        Player::Second => (materials.fill_dark.clone(), materials.mark_light.clone()),
        Player::First => (materials.fill_light.clone(), materials.mark_dark.clone()),
    };

    if ghost {
        spawn_layer(commands, piece_meshes.outline.clone(), mark, 0.02);
        return;
    }

    spawn_layer(commands, piece_meshes.fill.clone(), fill, 0.01);

    if piece.player == Player::First {
        spawn_layer(
            commands,
            piece_meshes.outline.clone(),
            materials.mark_dark.clone(),
            0.02,
        );
    }

    match piece.kind {
        PieceKind::Tott => {}
        PieceKind::Tzarra => {
            spawn_layer(commands, piece_meshes.inner_ring.clone(), mark, 0.03);
        }
        PieceKind::Tzaar => {
            spawn_layer(
                commands,
                piece_meshes.inner_ring.clone(),
                mark.clone(),
                0.03,
            );
            spawn_layer(commands, piece_meshes.center_dot.clone(), mark, 0.04);
        }
    }
}

pub fn plugin(app: &mut App) {
    app.add_systems(PreStartup, setup_piece_assets);
}
