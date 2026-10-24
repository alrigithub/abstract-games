"""Blender --background --python build-boop-shadow-proxies.py -- --pieces ... --output ..."""
import argparse
import os
import sys
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--pieces', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
pieces, output = os.path.abspath(args.pieces), os.path.abspath(args.output)
os.makedirs(output, exist_ok=True)
for size, name in [('large', 'cat'), ('small', 'kitten')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(pieces, f'boop-vase-{size}-white.glb'))
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        obj.data.materials.clear()
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
        modifier = obj.modifiers.new('Offline shadow proxy', 'DECIMATE')
        modifier.ratio = min(1, 1000 / max(1, len(obj.data.polygons)))
        modifier.use_collapse_triangulate = True
    bpy.ops.export_scene.gltf(filepath=os.path.join(output, f'boop-{name}-shadow.glb'), export_format='GLB', export_apply=True)
