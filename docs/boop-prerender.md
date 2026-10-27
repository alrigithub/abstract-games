# Boop pre-rendered arena

Boop now uses a fixed orthographic camera and a Blender-rendered arena image.
The playable vases and complete column assemblies remain 3D. Columns occlude
pieces normally through the depth buffer. Column shadows are baked into the
plate; moving pieces cast live shadows on the floor, tile proxies, and columns.
The existing full 3D arena is available for comparison with `?arena=3d`.
Viewport-hidden meshes, including Boolean cutters, are also hidden from the
rendered export. Their Boolean modifiers still affect the visible stone geometry.

## Grid registration

The supplied `boop_grid.blend` contains the same 36 named cell objects as
`ari+6X6.blend`. Cell names preserve the reference grid's row and column identity.
The latest saved arena intentionally offsets some tile centers. Rendering with
`--allow-grid-offsets` retains these edits and records the reference displacement.
Placement and picking use the exported positions. Without this flag, horizontal
registration must still match the reference exactly.
The manifest records the current top of each tile, clamped to the recessed floor
for buried tiles, and reports the largest source height change.
The authored pitch is 1.05 Blender units; the entire scene is uniformly scaled
by 1/1.05 to match the game's one-unit pitch. Intentional tile offsets are retained.
Blender +Z maps to game +Y, and Blender +Y maps to game -Z. Grid row labels are
therefore reversed when converting to game row indices.

`web-3d/games/boop/src/game/boop-arena-manifest.json` records every registered
cell center and surface height, the live column names, and the exact camera.
Piece placement, picking, and screen coordinates use this registration. Exterior
pool cells keep the existing coordinates. Two batched tile surfaces provide
depth and live contact shadows without rendering the original tile meshes.
The surrounding ground is at zero with a rectangular opening and a lowered
arena floor. Both invisible depth and shadow receivers share this opening;
there is no zero-height floor covering pieces placed inside the recess.

## Camera and color

The image spans an 18×18 world-unit square. A centered 14×10 region frames the
game; resizing expands the orthographic viewport to contain this region without
stretching. Orbit, pan, and camera presets stay locked. The mouse wheel, trackpad
pinch, and two-finger pinch zoom that view (about 0.85× to 1.3× on the 1536px
plate) with eased orthographic zoom, so the plate, pieces, ghosts, shadows, and
picking stay registered. Gameplay outcomes and new games do not reframe it.

The light plate uses Blender's Standard output. The shared game pipeline
applies its final AgX/sRGB conversion once to the image and live objects.
Do not bake AgX into these plates, or the game will tone-map them twice.
The plate's corner color supplies the surrounding canvas backdrop.
The pre-rendered mode omits realtime N8AO because the scenery already contains
baked occlusion; SMAA, final color conversion, and live soft shadows remain.
Its rendering buffer is capped at 1.5 million pixels and 1.5× device scale.

## Regeneration

From `web-3d`, with Blender and Python/Pillow installed:

```powershell
# First run: register the saved arena and reference grid on this machine.
npm run export:boop -- --arena 'PATH/ari+6X6.blend' --grid 'PATH/boop_grid.blend'
# Later: save Blender, then rebuild the complete export.
npm run export:boop
```

If Blender is not discovered automatically, pass `--blender 'PATH/blender.exe'`.
Paths and contrast are remembered in ignored `.boop-export.local.json`. Raw
images and an inspectable aligned Blender copy are kept in ignored `.boop-export/`.
The command renders the light plate in a fresh staging folder, then updates the
WebP, live columns and the placement manifest. It never overwrites the source
arena or grid. Hidden Boolean cutters remain excluded. It does not commit, push,
or deploy; save Blender before running it.

Default `--contrast 1.06` slightly increases the key-to-fill lighting ratio;
`--contrast 1` restores the original lighting. It keeps the same soft shadow size
and material colors. `--resolution` (1536) and `--threads` (6) are optional.

For the individual rendering/conversion steps:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 6 --python scripts/render-arena-plate.py -- --arena 'PATH/ari+6X6.blend' --grid 'PATH/boop_grid.blend' --output games/boop/public/prerender --source-copy 'PATH/boop-prerender-aligned.blend'
python scripts/prepare-arena-plates.py games/boop/public/prerender
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python scripts/build-boop-shadow-proxies.py -- --pieces lib/pieces --output games/boop/public/prerender
```

Keep the raw PNGs and aligned Blender copy outside the runtime directory after
conversion. Commit the two WebPs, the column GLB, and the JSON manifest. The
renderer does not overwrite either input Blender file. The saved copy contains
an alignment collection with 36 labeled center markers and the complete arena.

Changing the arena, its registration, or the camera requires regenerating the
plates and matching column export together. The two offline vase shadow proxies
avoid running mesh simplification during page initialization. Their geometry is
already scaled to game units before attachment, so their parent transform is
cancelled; invisible shadow meshes are also excluded from picking.
This is an orthographic image
workflow; arbitrary camera movement is intentionally unavailable.

## Baked vase runtime assets

Boop loads the four `boop-vase-*-baked.glb` files. The original vase GLBs remain
unchanged in `web-3d/lib/pieces` as regeneration sources. Each runtime vase has
2,000 triangles and one 512 x 512 baked diffuse texture. The glTF unlit extension
keeps the captured lighting from being applied twice. This is a fixed-light
appearance: the baked shading moves with the vase during animations rather than
being recalculated. The geometry remains genuinely 3D for silhouettes and depth.

Live drop shadows use the existing 999/1,000-triangle proxies as separate sibling
meshes. They move with the vase but write neither visible color nor scene depth;
they are excluded from picking and bounds. The visible vase does not enter the
VSM shadow pass. Its baked surface does not receive additional dynamic shadows.

Regenerate from `web-3d` with Blender 5.2:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 6 --python scripts/bake-boop-vases.py -- --source lib/pieces --output .boop-vases-baked
Copy-Item .boop-vases-baked/*-baked.glb lib/pieces/
```

The helper `scripts/unlit_export.py` converts Blender's exported emission bake to
an explicit unlit base-color map. It preserves the binary geometry/image payload.
Inspect the regenerated assets in the game before adopting a new bake. The
bake uses the inverse of the fixed vase yaw, the game's warm directional key,
and neutral ambient fill. It approximates the original diffuse lighting without
runtime PBR or normal-map evaluation; it does not bake view-dependent highlights.
