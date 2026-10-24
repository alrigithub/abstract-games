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
for theme in ('light', 'dark'):
    source = args.directory / f'boop-{theme}.png'
    target = output / f'boop-{theme}.webp'
    with Image.open(source) as image:
        image.save(target, quality=94, method=6)
    print(f'{target.name}: {target.stat().st_size:,} bytes')
manifest = args.directory / 'boop-arena.json'
target = args.manifest_output or args.directory.parent.parent / 'src/game/boop-arena-manifest.json'
target.write_bytes(manifest.read_bytes())
if args.manifest_output is None:
    manifest.unlink()
