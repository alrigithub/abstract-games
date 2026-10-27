"""Convert a Blender plate to runtime WebP. Run with Python + Pillow after rendering."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
parser.add_argument('--stem', default='boop-light', help='PNG/WebP stem, e.g. boop-light or gomoku-light')
parser.add_argument('--manifest', default='boop-arena.json')
parser.add_argument('--output-directory', type=Path)
parser.add_argument('--manifest-output', type=Path)
parser.add_argument('--quality', type=int, default=94)
parser.add_argument('--max-edge', type=int, default=0, help='Downsample the plate so its long edge is at most this many pixels')
args = parser.parse_args()
output = args.output_directory or args.directory
output.mkdir(parents=True, exist_ok=True)
source = args.directory / f'{args.stem}.png'
plate = output / f'{args.stem}.webp'
with Image.open(source) as image:
    if args.max_edge and max(image.size) > args.max_edge:
        image = image.resize((args.max_edge, args.max_edge), Image.Resampling.LANCZOS)
    image.save(plate, quality=args.quality, method=6)
    width, height = image.size
print(f'{plate.name}: {plate.stat().st_size:,} bytes ({width}×{height})')
manifest = args.directory / args.manifest
if args.manifest_output:
    manifest_target = args.manifest_output
elif args.stem == 'boop-light':
    manifest_target = args.directory.parent.parent / 'src/game/boop-arena-manifest.json'
else:
    manifest_target = output / args.manifest
manifest_target.parent.mkdir(parents=True, exist_ok=True)
manifest_target.write_bytes(manifest.read_bytes())
if args.manifest_output is None and manifest_target != manifest:
    manifest.unlink()
