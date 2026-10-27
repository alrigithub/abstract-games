"""Blender --background --python render-arena-plate.py -- --output ...

Boop: --arena FILE.blend --grid FILE.blend --source-copy FILE.blend
Gomoku: --glb web-3d/lib/maps/go-map.glb

Creates a registered orthographic plate, live column GLB, and alignment manifest.
Inputs are read only. An inspectable Blender copy is saved beside the outputs.
"""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--arena')
parser.add_argument('--grid')
parser.add_argument('--glb', help='glTF arena (Gomoku go-map). Omit for the Boop blend export.')
parser.add_argument('--output', required=True)
parser.add_argument('--source-copy')
parser.add_argument('--resolution', type=int, default=1536)
parser.add_argument('--contrast', type=float, default=1.06, help='Key-to-fill lighting ratio multiplier; 1 restores the original lighting')
parser.add_argument('--allow-grid-offsets', action='store_true', help='Keep intentionally moved tile centers and record their reference offsets')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
assert math.isfinite(args.contrast) and args.contrast > 0, 'Contrast must be positive and finite'
args.output = os.path.abspath(args.output)
os.makedirs(args.output, exist_ok=True)

def render_gomoku_glb():
    """Import go-map and register it in the same camera convention as the Boop plate."""
    if not args.source_copy:
        raise SystemExit('Gomoku plate export needs --source-copy')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.glb))
    scene = bpy.context.scene
    scale = 1 / 1.05
    # glTF import is Z-up: (x, y, z) = (gltfX, -gltfZ, gltfY).
    # Game scale (s, s, -s) then maps to Blender (s, -s, s), which is the same
    # axis swap the Boop plate uses (Blender +Z = game +Y, Blender +Y = game -Z).
    for obj in [o for o in scene.objects if o.parent is None]:
        obj.matrix_world = Matrix.Diagonal((scale, -scale, scale, 1)) @ obj.matrix_world
    bpy.context.view_layer.update()
    cells = [o for o in scene.objects if o.type == 'MESH' and o.name.lower().startswith('cell ')]
    assert len(cells) == 225, f'Expected 225 go cells, found {len(cells)}'
    center = next(o for o in cells if int(o['row']) == 7 and int(o['column']) == 7)
    center_top = max((center.matrix_world @ Vector(corner)).z for corner in center.bound_box)
    for obj in [o for o in scene.objects if o.parent is None]:
        obj.matrix_world = Matrix.Translation((0, 0, -center_top)) @ obj.matrix_world
    bpy.context.view_layer.update()

    def is_live_column(obj):
        return obj.type == 'MESH' and 'column' in obj.name.lower()

    def is_infinite_ground(obj):
        return 'infinite' in obj.name.lower() and 'ground' in obj.name.lower()

    for obj in scene.objects:
        if is_infinite_ground(obj):
            obj.hide_render = True
            obj.hide_set(True)

    stone = matte('Go pale stone', 'f4f4f2')
    ground_mat = matte('Go field', 'd9dad3')
    meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render and not o.hide_get()]
    for obj in meshes:
        obj.data = obj.data.copy()
        obj.data.materials.clear()
        obj.data.materials.append(stone)

    floor_z = min(min((o.matrix_world @ Vector(corner)).z for corner in o.bound_box) for o in cells) - 0.004
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, floor_z))
    floor = bpy.context.active_object
    floor.name = 'Plate field'
    floor.data.materials.append(ground_mat)

    # Boolean operands sit on the same towers. Hide every column from the plate and
    # keep one live copy so the towers occlude pieces without z-fighting.
    hidden_columns = [o for o in meshes if is_live_column(o)]
    columns = [o for o in hidden_columns if not o.name.lower().startswith('union operand')]
    assert columns, 'Expected corner columns to stay live, as Boop columns do'
    records = []
    max_grid_error = 0
    for obj in cells:
        row, col = int(obj['row']), int(obj['column'])
        center_point = obj.matrix_world.translation
        top = max((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)
        game_x, game_z = center_point.x, -center_point.y
        max_grid_error = max(max_grid_error, math.hypot(game_x - (col - 7), game_z - (row - 7)))
        records.append({'name': obj.name, 'row': row, 'col': col, 'x': game_x, 'y': top, 'z': game_z})
    assert max_grid_error < 0.02, f'Cell registration drifted by {max_grid_error}'

    # Same sun, elevation, and Standard view as the Boop plate. Ortho size comes
    # from this arena so the 15×15 field, not Boop's 6×6 frame, fills the image.
    for obj in scene.objects:
        if obj.type == 'LIGHT':
            obj.hide_render = True
    sun_data = bpy.data.lights.new('Matched daylight', 'SUN')
    sun_data.energy = 2 * math.sqrt(args.contrast)
    sun_data.angle = math.radians(12)
    sun_data.color = (1, .95, .88)
    sun = bpy.data.objects.new('Matched daylight', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = Vector((-1, -1, -math.sqrt(2))).to_track_quat('-Z', 'Y').to_euler()
    scene.world = bpy.data.worlds.new('Soft studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('d9dad3'), 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5 / math.sqrt(args.contrast)

    distance, elevation = 22, math.radians(35)
    position = (distance * math.cos(elevation) / math.sqrt(2), -distance * math.cos(elevation) / math.sqrt(2), distance * math.sin(elevation))
    camera_data = bpy.data.cameras.new('Locked orthographic')
    camera = bpy.data.objects.new('Locked orthographic', camera_data)
    scene.collection.objects.link(camera)
    camera.location = position
    camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.clip_start = 0.1
    camera_data.clip_end = 200
    scene.camera = camera
    bpy.context.view_layer.update()
    view = camera.matrix_world.inverted()
    xs, ys = [], []
    for obj in cells:
        for corner in obj.bound_box:
            point = view @ obj.matrix_world @ Vector(corner)
            xs.append(point.x)
            ys.append(point.y)
    # Extra room so the live corner towers stay inside the locked frame.
    frame_w = (max(xs) - min(xs)) * 1.42
    # Tall live columns need more vertical frame than the paving alone.
    frame_h = (max(ys) - min(ys)) * 2.15
    # Cover a 16:9 contain-fit of that frame, matching how the game letterboxes.
    half_h = max(frame_h / 2, frame_w / (2 * 16 / 9))
    plate = max(half_h * 2 * 16 / 9, half_h * 2) * 1.04
    camera_data.ortho_scale = plate
    # Fill the sensor. A finite ground plane misses rays that start below it.
    bpy.ops.mesh.primitive_plane_add(size=plate * 1.08)
    backdrop = bpy.context.active_object
    backdrop.name = 'Plate backdrop'
    backdrop.parent = camera
    backdrop.location = (0, 0, -48)
    backdrop.rotation_euler = (math.pi, 0, 0)
    backdrop.scale = (3, 3, 3)
    emit = bpy.data.materials.new('Plate backdrop')
    emit.use_nodes = True
    nodes = emit.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (*srgb('d9dad3'), 1)
    emission.inputs['Strength'].default_value = 1
    emit.node_tree.links.new(emission.outputs['Emission'], out.inputs['Surface'])
    backdrop.data.materials.append(emit)

    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = bool(getattr(getattr(bpy.app, 'build_options', None), 'openimagedenoise', False))
    scene.render.resolution_x = scene.render.resolution_y = args.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    bpy.ops.object.select_all(action='DESELECT')
    for obj in columns:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = columns[0]
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(args.output, 'gomoku-columns.glb'),
        export_format='GLB', use_selection=True, export_apply=True,
    )
    for obj in hidden_columns:
        obj.visible_camera = False
    report = {
        'lightingContrast': args.contrast,
        'referenceCellCount': len(cells),
        'maxSourceAlignmentError': max_grid_error,
        'sourcePitch': 1.05,
        'worldScale': scale,
        'cells': sorted(records, key=lambda cell: (cell['row'], cell['col'])),
        'camera': {
            'position': [position[0], position[2], -position[1]],
            'target': [0, 0, 0],
            'width': plate, 'height': plate,
            'frameWidth': frame_w, 'frameHeight': frame_h,
        },
        'liveColumns': [obj.name for obj in columns],
        'staticMeshCount': len(meshes) - len(columns),
        'note': 'Blender +Z becomes game +Y; Blender +Y becomes game -Z. go-map.glb bytes are not modified.',
    }
    with open(os.path.join(args.output, 'gomoku-arena.json'), 'w') as handle:
        json.dump(report, handle, indent=2)
    for obj in hidden_columns:
        obj.visible_camera = True
    bpy.ops.wm.save_as_mainfile(filepath=args.source_copy)
    for obj in hidden_columns:
        obj.visible_camera = False
    scene.render.filepath = os.path.join(args.output, 'gomoku-light.png')
    bpy.ops.render.render(write_still=True)

def srgb(hex_value):
    values = [int(hex_value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)

def matte(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*srgb(color), 1)
    bsdf.inputs['Roughness'].default_value = .88
    return mat

if args.glb:
    render_gomoku_glb()
    raise SystemExit(0)
if not args.arena or not args.grid or not args.source_copy:
    parser.error('Boop export needs --arena, --grid, and --source-copy')

bpy.ops.wm.open_mainfile(filepath=args.grid)
reference = {o.name: tuple(o.matrix_world.translation) for o in bpy.context.scene.objects if o.get('playable')}
bpy.ops.wm.open_mainfile(filepath=args.arena)
scene = bpy.context.scene
# Export what is visible in the saved viewport. Hidden Boolean cutters still
# evaluate their modifiers, but must not reappear as rendered geometry.
for o in scene.objects:
    if o.type == 'MESH' and o.hide_get():
        o.hide_render = True
cells = [o for o in scene.objects if o.name in reference]
assert len(cells) == 36, 'Expected all 36 reference cells'
# The supplied grid fixes the playable X/Y centers. Authored tile heights may
# change independently; sample their current surfaces below for game placement.
errors = [math.hypot(o.matrix_world.translation.x - reference[o.name][0],
                     o.matrix_world.translation.y - reference[o.name][1]) for o in cells]
height_changes = [abs(o.matrix_world.translation.z - reference[o.name][2]) for o in cells]
assert args.allow_grid_offsets or max(errors) < 1e-5, 'Grid and source arena differ horizontally; review alignment before rendering'

# The authored pitch is 1.05 m; the game's cell pitch is one world unit.
scale = 1 / 1.05
floor = next(o for o in scene.objects if o.name == 'Infinite light ground')
offset = -floor.matrix_world.translation.z
transform = Matrix.Scale(scale, 4) @ Matrix.Translation((0, 0, offset))
for o in list(scene.objects):
    if o.parent is None:
        o.matrix_world = transform @ o.matrix_world
bpy.context.view_layer.update()
recess = scene.objects.get('Arena recessed floor')
recess_z = recess.matrix_world.translation.z if recess else 0
ground_cutout = None
if recess:
    corners = [recess.matrix_world @ Vector(v) for v in recess.bound_box]
    ground_cutout = {'minX': min(p.x for p in corners), 'maxX': max(p.x for p in corners),
                     'minZ': -max(p.y for p in corners), 'maxZ': -min(p.y for p in corners),
                     'floorY': recess_z}

stone = matte('Boop pale avocado stone', 'cbd0be')
ground = matte('Boop gray ground', 'd9dad3')
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render and not o.hide_get()]
for o in meshes:
    o.data = o.data.copy()
    o.data.materials.clear()
    o.data.materials.append(ground if o == floor or o == recess or o.name == 'Arena recess inner sides' else stone)

# Retain complete column assemblies so moving pieces can pass behind their silhouettes.
columns = [o for o in meshes if any(s in o.name.lower() for s in ('column', 'capital'))]
overlay = bpy.data.collections.new('ALIGNMENT — 36 game cell centers (hidden in final render)')
scene.collection.children.link(overlay)
records = []
for o in cells:
    letter, number = o.name.split()[1][0], int(o.name.split()[1][1:])
    row, col = 6 - number, ord(letter) - ord('A')
    center = o.matrix_world.translation.copy()
    origin = o.matrix_world.inverted() @ Vector((center.x, center.y, 10))
    direction = o.matrix_world.to_3x3().inverted() @ Vector((0, 0, -1))
    hit, point, _, _ = o.ray_cast(origin, direction)
    top = max(recess_z, (o.matrix_world @ point).z if hit else center.z + o.dimensions.z / 2)
    records.append({'name': o.name, 'row': row, 'col': col, 'x': center.x, 'y': top, 'z': -center.y})
    marker = bpy.data.objects.new('Grid ' + o.name, None)
    marker.empty_display_type = 'SPHERE'
    marker.empty_display_size = .08
    marker.location = (center.x, center.y, top + .025)
    marker['game_row'], marker['game_col'] = row, col
    overlay.objects.link(marker)

for o in scene.objects:
    if o.type == 'LIGHT':
        o.hide_render = True
sun_data = bpy.data.lights.new('Boop matched daylight', 'SUN')
sun_data.energy = 2 * math.sqrt(args.contrast)
sun_data.angle = math.radians(12)
sun_data.color = (1, .95, .88)
sun = bpy.data.objects.new('Boop matched daylight', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = Vector((-1, -1, -math.sqrt(2))).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('Boop soft studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .8, .8, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5 / math.sqrt(args.contrast)

camera_data = bpy.data.cameras.new('Boop locked orthographic')
camera = bpy.data.objects.new('Boop locked orthographic', camera_data)
scene.collection.objects.link(camera)
distance, elevation = 22, math.radians(35)
position = (distance * math.cos(elevation) / math.sqrt(2), -distance * math.cos(elevation) / math.sqrt(2), distance * math.sin(elevation))
camera.location = position
camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 18
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = bool(getattr(getattr(bpy.app, 'build_options', None), 'openimagedenoise', False))
scene.render.resolution_x = scene.render.resolution_y = args.resolution
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
# Store the plate without AgX: the game applies the same final AgX transform as live objects.
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

bpy.ops.object.select_all(action='DESELECT')
for o in columns:
    o.select_set(True)
bpy.context.view_layer.objects.active = columns[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(args.output, 'boop-columns.glb'), export_format='GLB', use_selection=True, export_apply=True)
for o in columns:
    o.visible_camera = False

report = {
    'lightingContrast': args.contrast,
    'referenceCellCount': len(cells), 'maxSourceAlignmentError': max(errors),
    'maxSourceHeightChange': max(height_changes),
    'groundCutout': ground_cutout,
    'sourcePitch': 1.05, 'worldScale': scale, 'cells': sorted(records, key=lambda c: (c['row'], c['col'])),
    'camera': {'position': [position[0], position[2], -position[1]], 'target': [0, 0, 0], 'width': 18, 'height': 18, 'frameWidth': 14, 'frameHeight': 10},
    'liveColumns': [o.name for o in columns], 'staticMeshCount': len(meshes) - len(columns),
    'note': 'Blender +Z becomes game +Y; Blender +Y becomes game -Z. Grid row labels are flipped to game row order.'
}
with open(os.path.join(args.output, 'boop-arena.json'), 'w') as f:
    json.dump(report, f, indent=2)
for o in columns:
    o.visible_camera = True
bpy.ops.wm.save_as_mainfile(filepath=args.source_copy)
for o in columns:
    o.visible_camera = False
scene.render.filepath = os.path.join(args.output, 'boop-light.png')
bpy.ops.render.render(write_still=True)
