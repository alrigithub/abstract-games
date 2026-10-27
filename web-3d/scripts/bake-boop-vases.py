"""Bake fixed-light Boop vase appearance and export separate low-poly GLBs.

Original source GLBs are never overwritten. Run with Blender in background.
"""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unlit_export import finalize_unlit

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--resolution', type=int, default=512)
parser.add_argument('--triangles', type=int, default=2000)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.source = os.path.abspath(args.source)
args.output = os.path.abspath(args.output)
os.makedirs(args.output, exist_ok=True)
report = []

for size in ['large', 'small']:
    for color in ['white', 'black']:
        stem = f'boop-vase-{size}-{color}'
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(args.source, stem + '.glb'))
        scene = bpy.context.scene
        meshes = [obj for obj in scene.objects if obj.type == 'MESH']
        original_tris = sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in meshes)
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
        scene.cycles.bake_type = 'DIFFUSE'
        scene.render.bake.use_pass_direct = True
        scene.render.bake.use_pass_indirect = True
        scene.render.bake.use_pass_color = True
        scene.render.bake.margin = 12
        scene.world = bpy.data.worlds.new('Neutral baked fill')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
        light_data = bpy.data.lights.new('Boop key', 'SUN')
        light_data.energy = 1.72
        light_data.color = (1, .9047, .7835)
        light_data.angle = math.radians(8)
        light = bpy.data.objects.new('Boop key', light_data)
        scene.collection.objects.link(light)
        # Runtime meshes rotate -45 degrees around up. Bake the inverse-rotated
        # world key into authored local coordinates: Blender +Y, +Z equally.
        direction = Vector((0, 1, 1)).normalized()
        light.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
        for obj in meshes:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            image = bpy.data.images.new(stem + '-baked', width=args.resolution, height=args.resolution, alpha=False)
            image.colorspace_settings.name = 'sRGB'
            for slot in obj.material_slots:
                material = slot.material
                image_node = material.node_tree.nodes.new('ShaderNodeTexImage')
                image_node.image = image
                material.node_tree.nodes.active = image_node
            bpy.ops.object.bake(type='DIFFUSE')
            image.filepath_raw = os.path.join(args.output, stem + '-baked.png')
            image.file_format = 'PNG'
            image.save()
            material = bpy.data.materials.new(stem + '-baked-unlit')
            material.use_nodes = True
            nodes = material.node_tree.nodes
            nodes.clear()
            texture = nodes.new('ShaderNodeTexImage')
            texture.image = image
            emission = nodes.new('ShaderNodeEmission')
            output = nodes.new('ShaderNodeOutputMaterial')
            material.node_tree.links.new(texture.outputs['Color'], emission.inputs['Color'])
            material.node_tree.links.new(emission.outputs['Emission'], output.inputs['Surface'])
            obj.data.materials.clear()
            obj.data.materials.append(material)
            for poly in obj.data.polygons:
                poly.material_index = 0
            modifier = obj.modifiers.new('Runtime silhouette reduction', 'DECIMATE')
            modifier.ratio = min(1, args.triangles / max(1, original_tris))
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj['boopBakedAppearance'] = True
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        output_path = os.path.join(args.output, stem + '-baked.glb')
        bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', use_selection=True, export_extras=True)
        finalize_unlit(output_path)
        tris = sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in meshes)
        report.append({'file': os.path.basename(output_path), 'original_triangles': original_tris, 'triangles': tris, 'bytes': os.path.getsize(output_path), 'texture_resolution': args.resolution})
        print('BOOP_BAKE', json.dumps(report[-1]), flush=True)
        with open(os.path.join(args.output, 'report.json'), 'w') as file:
            json.dump(report, file, indent=2)
