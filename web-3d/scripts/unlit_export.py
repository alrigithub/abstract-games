"""Make the Blender emission bake an explicit glTF unlit base-color texture."""
import json
import struct
from pathlib import Path

def finalize_unlit(path):
    path = Path(path)
    data = path.read_bytes()
    json_length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    for material in document['materials']:
        texture = material.pop('emissiveTexture')
        material.pop('emissiveFactor', None)
        material['pbrMetallicRoughness'] = {
            'baseColorFactor': [1, 1, 1, 1],
            'baseColorTexture': texture,
            'metallicFactor': 0,
            'roughnessFactor': 1,
        }
        material.setdefault('extensions', {})['KHR_materials_unlit'] = {}
    for key in ['extensionsUsed', 'extensionsRequired']:
        document[key] = list(dict.fromkeys(document.get(key, []) + ['KHR_materials_unlit']))
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    tail = data[20 + json_length:]
    result = struct.pack('<III', 0x46546C67, 2, 20 + len(encoded) + len(tail))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + tail
    path.write_bytes(result)

if __name__ == '__main__':
    import sys
    for file in Path(sys.argv[1]).glob('*-baked.glb'):
        finalize_unlit(file)
