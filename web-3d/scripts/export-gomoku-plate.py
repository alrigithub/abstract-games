"""Render the Gomoku plate from the committed go-map.glb. Does not modify that file."""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
glb = root / 'lib/maps/go-map.glb'
blender = os.environ.get('BLENDER_PATH') or shutil.which('blender')
if not blender:
    sys.exit('Blender was not found. Install it or set BLENDER_PATH.')
if not glb.is_file():
    sys.exit(f'Missing arena: {glb}')
runtime = root / 'games/gomoku/public/prerender'
manifest = root / 'games/gomoku/src/gomoku-arena-manifest.json'
work = root / '.gomoku-export'
work.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='render-', dir=work) as temporary:
    stage = Path(temporary)
    subprocess.run([
        blender, '--background', '--factory-startup', '--threads', '6',
        '--python-exit-code', '1', '--python', str(root / 'scripts/render-arena-plate.py'), '--',
        '--glb', str(glb), '--output', str(stage),
        '--source-copy', str(work / 'gomoku-prerender-aligned.blend'),
        '--resolution', '2048', '--contrast', '1.06',
    ], check=True)
    for name in ('gomoku-light.png', 'gomoku-columns.glb', 'gomoku-arena.json'):
        if not (stage / name).is_file():
            raise SystemExit(f'Blender did not produce {name}')
    subprocess.run([
        sys.executable, str(root / 'scripts/prepare-arena-plates.py'), str(stage),
        '--stem', 'gomoku-light', '--manifest', 'gomoku-arena.json',
        '--output-directory', str(runtime), '--manifest-output', str(manifest),
    ], check=True)
    shutil.copy2(stage / 'gomoku-columns.glb', runtime / 'gomoku-columns.glb')
print(f'Updated the Gomoku plate, columns, and manifest. go-map.glb was not modified.')
