"""Export separate lit Boop vase detail assets without changing source GLBs.

Run with Blender in background, for example:
  blender --background --python prepare-boop-vases.py -- \
    --source web-3d/lib/pieces --output web-3d/lib/pieces \
    --work output/vase-quality

Only geometry and image encodings change. Original UVs, the open rim, and the
authored Principled material remain; no lighting or ambient occlusion is baked.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import struct
import sys

import bmesh
import bpy


def triangle_count(mesh):
    return sum(len(face.vertices) - 2 for face in mesh.polygons)


def protected_vertices(mesh):
    """Keep the top rim, UV boundaries, and bounding extrema unchanged."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    protected = {v.index for edge in bm.edges if edge.is_boundary for v in edge.verts}
    lo = [min(v.co[axis] for v in bm.verts) for axis in range(3)]
    hi = [max(v.co[axis] for v in bm.verts) for axis in range(3)]
    rim_start = hi[2] - (hi[2] - lo[2]) * 0.02
    for vertex in bm.verts:
        if vertex.co.z >= rim_start or any(
            abs(vertex.co[axis] - bound) < 1e-9
            for axis in range(3) for bound in (lo[axis], hi[axis])
        ):
            protected.add(vertex.index)
    bm.free()
    return protected


def reduce_mesh(obj, target):
    """Decimate selected body vertices only; unselected rim/seams cannot collapse."""
    original = obj.data
    original_tris = triangle_count(original)
    protected = protected_vertices(original)
    required = collections.Counter(tuple(original.vertices[i].co) for i in protected)
    best_mesh, best_count, best_ratio = None, original_tris, 1.0
    low, high = 0.0, 1.0
    bpy.context.view_layer.objects.active = obj
    for _ in range(16):
        ratio = (low + high) / 2
        candidate = original.copy()
        obj.data = candidate
        for face in candidate.polygons:
            face.select = False
        for edge in candidate.edges:
            edge.select = False
        for vertex in candidate.vertices:
            vertex.select = vertex.index not in protected
        bpy.context.tool_settings.mesh_select_mode = (True, False, False)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.decimate(ratio=ratio, use_vertex_group=False, use_symmetry=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        count = triangle_count(candidate)
        if abs(count - target) < abs(best_count - target):
            if best_mesh is not None:
                bpy.data.meshes.remove(best_mesh)
            best_mesh, best_count, best_ratio = candidate, count, ratio
        else:
            obj.data = original
            bpy.data.meshes.remove(candidate)
        if count == target:
            break
        if count < target:
            low = ratio
        else:
            high = ratio
    if best_mesh is None or abs(best_count - target) > 2:
        raise RuntimeError(f'{obj.name}: could not reach {target} triangles; best {best_count}')
    obj.data = best_mesh
    surviving = collections.Counter(tuple(v.co) for v in best_mesh.vertices)
    if required - surviving:
        raise RuntimeError(f'{obj.name}: {sum((required - surviving).values())} protected rim or seam vertices moved')
    if len(best_mesh.uv_layers) != len(original.uv_layers):
        raise RuntimeError(f'{obj.name}: UV layers lost')
    return {'original_triangles': original_tris, 'triangles': best_count,
            'protected_vertices': len(protected), 'collapse_ratio': best_ratio,
            'uv_layers': len(best_mesh.uv_layers)}


def convert_images(material, work, stem, jpeg_quality):
    nodes = material.node_tree.nodes
    principled = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    color_node = principled.inputs['Base Color'].links[0].from_node
    normal_node = principled.inputs['Normal'].links[0].from_node
    if color_node.type != 'TEX_IMAGE' or normal_node.type != 'NORMAL_MAP':
        raise RuntimeError('Expected original textured Principled material')
    normal_image_node = normal_node.inputs['Color'].links[0].from_node
    for node, suffix, resolution, image_format in (
        (color_node, 'basecolor', 1024, 'JPEG'),
        (normal_image_node, 'normal', 512, 'PNG'),
    ):
        image = node.image.copy()
        image.scale(resolution, resolution)
        image.file_format = image_format
        path = work / f'{stem}-{suffix}.{"jpg" if image_format == "JPEG" else "png"}'
        image.filepath_raw = str(path)
        image.save(quality=jpeg_quality)
        # Reload the exact encoded asset, so the exporter can preserve its bytes.
        replacement = bpy.data.images.load(str(path), check_existing=False)
        replacement.colorspace_settings.name = 'sRGB' if suffix == 'basecolor' else 'Non-Color'
        node.image = replacement


def image_dimensions(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack_from('>II', data, 16)
    if data[:2] != b'\xff\xd8':
        raise RuntimeError('Unexpected exported image format')
    offset = 2
    while offset < len(data):
        if data[offset] != 255:
            offset += 1
            continue
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length = struct.unpack_from('>H', data, offset)[0]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack_from('>HH', data, offset + 3)
            return width, height
        offset += length
    raise RuntimeError('JPEG dimensions missing')


def inspect_export(path):
    raw = path.read_bytes()
    offset, chunks = 12, {}
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        chunks[kind] = raw[offset + 8:offset + 8 + length]
        offset += 8 + length
    gltf = json.loads(chunks[0x4E4F534A])
    if 'KHR_materials_unlit' in gltf.get('extensionsUsed', []):
        raise RuntimeError('Export unexpectedly became unlit')
    materials = gltf['materials']
    if len(materials) != 1 or 'normalTexture' not in materials[0]:
        raise RuntimeError('Original PBR material/normal missing')
    images = []
    for image in gltf['images']:
        view = gltf['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        data = chunks[0x004E4942][start:start + view['byteLength']]
        images.append({'name': image.get('name'), 'mime': image['mimeType'],
                       'size': image_dimensions(data), 'bytes': len(data)})
    material = materials[0]
    pbr = material['pbrMetallicRoughness']
    color_index = gltf['textures'][pbr['baseColorTexture']['index']]['source']
    normal_index = gltf['textures'][material['normalTexture']['index']]['source']
    if images[color_index]['mime'] != 'image/jpeg' or images[color_index]['size'] != (1024, 1024):
        raise RuntimeError('Expected 1024 JPEG albedo')
    if images[normal_index]['mime'] != 'image/png' or images[normal_index]['size'] != (512, 512):
        raise RuntimeError('Expected 512 PNG normal')
    tris = sum(gltf['accessors'][primitive['indices']]['count'] // 3
               for mesh in gltf['meshes'] for primitive in mesh['primitives'])
    return {'bytes': len(raw), 'exported_triangles': tris,
            'images': images, 'material': material}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--triangles', type=int, default=4000)
    parser.add_argument('--jpeg-quality', type=int, choices=(92, 95), default=95)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    report = []
    for size in ('large', 'small'):
        for color in ('white', 'black'):
            stem = f'boop-vase-{size}-{color}'
            source = args.source / f'{stem}.glb'
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(source))
            meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
            if len(meshes) != 1 or len(meshes[0].data.materials) != 1:
                raise RuntimeError(f'{stem}: expected one mesh and material')
            obj = meshes[0]
            geometry = reduce_mesh(obj, args.triangles)
            material = obj.data.materials[0]
            convert_images(material, args.work, stem, args.jpeg_quality)
            obj.name = stem + '-detail'
            obj.data.name = obj.name
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            output = args.output / f'{stem}-detail.glb'
            bpy.ops.export_scene.gltf(
                filepath=str(output), export_format='GLB', use_selection=True,
                export_image_format='AUTO', export_jpeg_quality=args.jpeg_quality,
                export_image_quality=args.jpeg_quality, export_animations=False,
                export_extras=False,
            )
            exported = inspect_export(output)
            if exported['exported_triangles'] != geometry['triangles']:
                raise RuntimeError(f'{stem}: exporter changed triangle count')
            if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
                raise RuntimeError('Source file changed')
            entry = {'file': output.name, 'source_sha256': source_hash,
                     'jpeg_quality': args.jpeg_quality, **geometry, **exported}
            report.append(entry)
            print('BOOP_DETAIL', json.dumps(entry), flush=True)
            (args.work / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
