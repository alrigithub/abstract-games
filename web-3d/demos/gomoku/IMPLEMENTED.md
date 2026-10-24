# Gomoku 3D — implemented dimensions

World scale: **1 unit = one intersection spacing** (~40 mm). Board slab **0.25** units ≈ **10 mm** (“flat 10mm”).

| Element | Value (units) | Notes |
|---------|---------------|--------|
| Grid | 15 × 15 intersections | Lines at indices 0…14 |
| Board slab thickness | 0.25 | Thin panel |
| Board margin (past outer lines) | 0.55 | Per side |
| Grid line width | 0.018 | |
| Star point (hoshi) radius | 0.055 | Five points on 15×15 |
| Go stone max radius | 0.47 | |
| Go stone height | 0.21 | Biconvex lens (geometry unchanged) |
| Stone center Y (rest) | 0.0525 | `STONE_H/2 − 0.25×STONE_H` (seated 25% lower) |
| Contact shadow Y | 0.003 | Flattened stone mesh on board surface |

Star points (row, col), 0-based: (3,3), (3,11), (7,7), (11,3), (11,11).

Win highlight accent: `#3b82f6`.

Materials: black stone matte slate; white stone shell with subtle sheen.

Interaction: click/tap intersection to place (no drag, no reserve trays).
