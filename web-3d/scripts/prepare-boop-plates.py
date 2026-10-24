"""Convert Blender plates to runtime WebP. Run with Python + Pillow after rendering."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args()
for theme in ('light', 'dark'):
    source = args.directory / f'boop-{theme}.png'
    target = args.directory / f'boop-{theme}.webp'
    with Image.open(source) as image:
        image.save(target, quality=94, method=6)
    print(f'{target.name}: {target.stat().st_size:,} bytes')
manifest = args.directory / 'boop-arena.json'
target = args.directory.parent.parent / 'src/game/boop-arena-manifest.json'
target.write_bytes(manifest.read_bytes())
manifest.unlink()
