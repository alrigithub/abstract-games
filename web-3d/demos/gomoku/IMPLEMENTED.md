# Gomoku 3D — implemented dimensions

World scale: **1 unit = one intersection spacing** (~40 mm). Board slab **0.25** units ≈ **10 mm** (“flat 10mm”).

| Element | Value (units) | Notes |
|---------|---------------|--------|
| Grid | 15 × 15 intersections | Lines at indices 0…14 |
| Board slab thickness | 0.25 | Thin panel, not a thick block |
| Board margin (past outer lines) | 0.55 | Per side |
| Grid line width | 0.018 | |
| Star point (hoshi) radius | 0.055 | Five points on 15×15 |
| Go stone max radius | 0.47 | Slightly under one spacing |
| Go stone height | 0.21 | Biconvex lens |
| Stone floor gap above board | 0.018 | Matches engine `ANIMATION.FLOOR` |
| Bowl center offset (X) | ±9.2 | Left = black, right = white |
| Bowl rim radius (top) | ~1.75 | Lathe profile in `createGoBowlGeometry` |
| Reserve stack count (visual) | 12 | Per bowl, decorative |

Star points (row, col), 0-based from top-left of playable grid: (3,3), (3,11), (7,7), (11,3), (11,11).

Materials: black stone matte slate (`roughness` ~0.88); white stone shell (`roughness` ~0.32, slight `metalness`).
