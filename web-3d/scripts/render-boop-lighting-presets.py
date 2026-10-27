"""Render registered Boop lighting plates without changing columns or the game manifest."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--arena', type=Path, required=True)
parser.add_argument('--grid', type=Path, required=True)
parser.add_argument('--blender', default=os.environ.get('BLENDER_PATH') or shutil.which('blender'))
parser.add_argument('--work', type=Path, default=ROOT.parent / 'output/lighting-presets')
parser.add_argument('--output', type=Path, default=ROOT / 'games/boop/public/prerender')
parser.add_argument('--resolution', type=int, default=1536)
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--threads', type=int, default=6)
parser.add_argument('--preset', action='append', help='Render selected keys; default renders every configured preset')
args = parser.parse_args()
if not args.blender:
    parser.error('Supply --blender FILE or set BLENDER_PATH')
if min(args.resolution, args.samples, args.threads) <= 0:
    parser.error('Resolution, samples and threads must be positive')
for name in ('arena', 'grid'):
    value = getattr(args, name).resolve()
    if not value.is_file():
        parser.error(f'{name} file does not exist: {value}')
    setattr(args, name, value)
config = json.loads((ROOT / 'games/boop/src/game/boop-lighting-presets.json').read_text(encoding='utf-8'))
keys = args.preset or list(config)
unknown = set(keys) - config.keys()
if unknown:
    parser.error(f'Unknown presets: {sorted(unknown)}')
reference = json.loads((ROOT / 'games/boop/src/game/boop-arena-manifest.json').read_text(encoding='utf-8'))


def differences(expected, actual, path=''):
    """Ignore lighting metadata; all geometry, placement and camera data must agree."""
    if isinstance(expected, dict) and isinstance(actual, dict):
        keys = (expected.keys() | actual.keys()) - {'lightingContrast', 'lightingPreset'}
        return [item for key in sorted(keys) for item in differences(expected.get(key), actual.get(key), f'{path}.{key}')]
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return [f'{path}: list lengths differ ({len(expected)} / {len(actual)})']
        return [item for index, (left, right) in enumerate(zip(expected, actual))
                for item in differences(left, right, f'{path}[{index}]')]
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return [] if abs(expected - actual) <= 1e-6 else [f'{path}: {expected} != {actual}']
    return [] if expected == actual else [f'{path}: {expected!r} != {actual!r}']


plates = []
for key in keys:
    stage = args.work.resolve() / key
    stage.mkdir(parents=True, exist_ok=True)
    print(f'Rendering {key}: {args.resolution}px, {args.samples} samples', flush=True)
    subprocess.run([
        args.blender, '--background', '--factory-startup', '--threads', str(args.threads),
        '--python-exit-code', '1', '--python', str(ROOT / 'scripts/render-arena-plate.py'), '--',
        '--arena', str(args.arena), '--grid', str(args.grid), '--output', str(stage),
        '--source-copy', str(stage / 'boop-prerender-aligned.blend'), '--resolution', str(args.resolution),
        '--samples', str(args.samples), '--lighting-preset', key, '--allow-grid-offsets',
    ], check=True)
    manifest = json.loads((stage / 'boop-arena.json').read_text(encoding='utf-8'))
    drift = differences(reference, manifest)
    (stage / 'registration-check.json').write_text(json.dumps({'preset': key, 'matches': not drift, 'differences': drift}, indent=2) + '\n', encoding='utf-8')
    if drift:
        raise RuntimeError(f'{key}: registration differs; no runtime plates were installed:\n' + '\n'.join(drift))
    stem = Path(config[key]['plate']).stem
    if Path(config[key]['plate']).name != config[key]['plate']:
        raise ValueError('Preset plate names must be plain filenames')
    shutil.copy2(stage / 'boop-light.png', stage / f'{stem}.png')
    # Keep Standard/sRGB display colors: the runtime plate is toneMapped=false.
    subprocess.run([
        sys.executable, str(ROOT / 'scripts/prepare-arena-plates.py'), str(stage),
        '--stem', stem, '--output-directory', str(stage / 'runtime'),
        '--manifest-output', str(stage / 'converted-manifest.json'),
    ], check=True)
    plates.append(stage / 'runtime' / config[key]['plate'])
    print(f'{key}: registration matches; plate staged', flush=True)

# Every selected render must pass registration before any runtime image changes.
args.output.mkdir(parents=True, exist_ok=True)
for plate in plates:
    shutil.copy2(plate, args.output / plate.name)
    print(f'Installed {plate.name}: {plate.stat().st_size:,} bytes', flush=True)
print('Columns, source blends and the game manifest were not changed.', flush=True)
