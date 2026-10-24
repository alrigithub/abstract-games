"""One-command Blender arena export. Remembers machine-local paths after success."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent.parent
config_path = root / '.boop-export.local.json'
config = json.loads(config_path.read_text()) if config_path.exists() else {}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--arena', type=Path, default=config.get('arena'))
parser.add_argument('--grid', type=Path, default=config.get('grid'))
parser.add_argument('--blender', default=os.environ.get('BLENDER_PATH') or config.get('blender') or shutil.which('blender'))
parser.add_argument('--contrast', type=float, default=config.get('contrast', 1.06))
parser.add_argument('--resolution', type=int, default=1536)
parser.add_argument('--threads', type=int, default=6)
args = parser.parse_args()
if not args.blender and os.name == 'nt':
    candidates = list(Path(os.environ.get('ProgramFiles', 'C:/Program Files')).glob('Blender Foundation/Blender */blender.exe'))
    if candidates:
        args.blender = str(max(candidates, key=lambda path: path.stat().st_mtime))
if not args.arena or not args.grid or not args.blender:
    parser.error('First run needs --arena FILE --grid FILE and, if not discovered, --blender FILE')
for name in ('arena', 'grid'):
    path = getattr(args, name).resolve()
    if not path.is_file():
        parser.error(f'{name} file does not exist: {path}')
    setattr(args, name, path)
if args.resolution <= 0 or args.threads <= 0:
    parser.error('Resolution and thread count must be positive')
work = root / '.boop-export'
work.mkdir(exist_ok=True)
runtime = root / 'games/boop/public/prerender'
manifest = root / 'games/boop/src/game/boop-arena-manifest.json'
# A fresh staging folder prevents stale files from a failed render being installed.
with tempfile.TemporaryDirectory(prefix='render-', dir=work) as temporary:
    stage = Path(temporary)
    subprocess.run([
        args.blender, '--background', '--factory-startup', '--threads', str(args.threads),
        '--python-exit-code', '1', '--python', str(root / 'scripts/render-boop-arena.py'), '--',
        '--arena', str(args.arena), '--grid', str(args.grid), '--output', str(stage),
        '--source-copy', str(work / 'boop-prerender-aligned.blend'),
        '--resolution', str(args.resolution), '--contrast', str(args.contrast), '--allow-grid-offsets',
    ], check=True)
    for name in ('boop-light.png', 'boop-dark.png', 'boop-columns.glb', 'boop-arena.json'):
        if not (stage / name).is_file():
            raise RuntimeError(f'Blender did not produce {name}; runtime assets were not changed')
    subprocess.run([
        sys.executable, str(root / 'scripts/prepare-boop-plates.py'), str(stage),
        '--output-directory', str(runtime), '--manifest-output', str(manifest),
    ], check=True)
    shutil.copy2(stage / 'boop-columns.glb', runtime / 'boop-columns.glb')
    for theme in ('light', 'dark'):
        shutil.copy2(stage / f'boop-{theme}.png', work / f'boop-{theme}.png')
config_path.write_text(json.dumps({
    'arena': str(args.arena), 'grid': str(args.grid), 'blender': args.blender,
    'contrast': args.contrast,
}, indent=2) + '\n')
print(f'Updated both plates, columns and grid data. Blender preview: {work / "boop-prerender-aligned.blend"}')
