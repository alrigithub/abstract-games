"""Blender --background --python render-boop-arena.py -- --arena ... --grid ... --output ...

Creates a registered orthographic plate, live column GLB, and alignment manifest.
The input files are read only. An inspectable Blender copy is saved beside the outputs.
"""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--arena', required=True)
parser.add_argument('--grid', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--source-copy', required=True)
parser.add_argument('--resolution', type=int, default=1536)
parser.add_argument('--allow-grid-offsets', action='store_true', help='Keep intentionally moved tile centers and record their reference offsets')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output = os.path.abspath(args.output)
os.makedirs(args.output, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=args.grid)
reference = {o.name: tuple(o.matrix_world.translation) for o in bpy.context.scene.objects if o.get('playable')}
bpy.ops.wm.open_mainfile(filepath=args.arena)
scene = bpy.context.scene
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
sun_data.energy = 2
sun_data.angle = math.radians(12)
sun_data.color = (1, .95, .88)
sun = bpy.data.objects.new('Boop matched daylight', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = Vector((-1, -1, -math.sqrt(2))).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('Boop soft studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .8, .8, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5

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
scene.cycles.use_denoising = True
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
stone.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb('72716e'), 1)
ground.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb('72716e'), 1)
scene.render.filepath = os.path.join(args.output, 'boop-dark.png')
bpy.ops.render.render(write_still=True)
