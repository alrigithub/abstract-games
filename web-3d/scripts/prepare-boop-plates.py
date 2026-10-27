"""Convert Blender plates to runtime WebP. Run with Python + Pillow after rendering."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
parser.add_argument('--output-directory', type=Path)
parser.add_argument('--manifest-output', type=Path)
args = parser.parse_args()
output = args.output_directory or args.directory
output.mkdir(parents=True, exist_ok=True)
source = args.directory / 'boop-light.png'
plate = output / 'boop-light.webp'
with Image.open(source) as image:
    image.save(plate, quality=94, method=6)
print(f'{plate.name}: {plate.stat().st_size:,} bytes')
manifest = args.directory / 'boop-arena.json'
manifest_target = args.manifest_output or args.directory.parent.parent / 'src/game/boop-arena-manifest.json'
manifest_target.write_bytes(manifest.read_bytes())
if args.manifest_output is None:
    manifest.unlink()
