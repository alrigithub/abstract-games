# AGENTS.md

Guidance for coding agents working in this repository.

## Product

**TypeScript + three.js only** — browser games, human vs AI, offline. No Rust, Bevy, or WASM game shells.

Polished 3D boards, minimax AI in **Web Workers**, smooth piece motion via the shared engine.

## Layout

| Path | Package / role |
|------|----------------|
| `web-3d/engine` | `@abstract/three-engine` — scene, camera, picking, lighting, themes, GLB loading |
| `web-3d/games/<g>` | `@abstract/<g>` — rules, AI worker, Vite app (`yinsh`, `gomoku`, `boop`, `tak`, `tzaar`) |
| `web-3d/hub` | Static lobby (`index.html`, rules TL;DR SVGs) |
| `web-3d/e2e` | One Playwright smoke spec per game |
| `web-3d/scripts` | `compress-glb.mjs` (manual, Alex-only) and workspace utilities |
| `scripts/stage_web3d_hosting.sh` | Build all games + copy hub into `hosting-staging/` |

## Commands

From `web-3d`:

```bash
npm ci
npm run dev -w @abstract/tak    # example; each game has its own Vite port
npm test
npm run build
npm run test:e2e
```

Stage for hosting:

```bash
./scripts/stage_web3d_hosting.sh
```

Deploy the **entire** `hosting-staging/` tree to Firebase Hosting site **bimsavage-games** (atomic upload so hashed assets stay in sync with `index.html`).

## Patterns

- **Rules** live in each game’s `src/game/` (pure TypeScript; no three.js in rule modules when possible).
- **Game state** (authoritative rules) stays separate from **interaction state** (selection, drag, drafts, UI) — e.g. `GameState` / `snapshot` vs `game-ui`, bridge, or engine `BoardSnapshot`.
- **AI** only in `*.worker.ts`; never block the render loop.
- **Tests:** Vitest for rules/engine per package; Playwright smoke in `web-3d/e2e/` (`data-testid="board"`). No committed screenshot baselines — Playwright may capture on failure only.
- **GLBs:** Never run `compress-glb` unless Alex explicitly asks for it. Commit GLBs exactly as provided. At runtime, load with the engine meshopt-capable loader (`ensureMeshoptDecoderReady`, `loadGltfAsync` / `createMeshoptGltfLoader` in `@abstract/three-engine`) so meshopt-compressed assets still work when present.
- **Lighting:** Shared sun direction `LIGHT_DIR = normalize(1, √2, -1)` in `board-lighting.ts`; directional light with **real drop shadows** on every piece (shadow map fitted to playfield).
- **Look:** Line-drawn boards on a large white playfield ground; **dark theme** is a full token inversion of the light palette (`invertThemeTokens`), not a separate art pass.

## Do not

- Add online multiplayer in v1
- Reintroduce Rust/Bevy/WASM shells or old `crates/` / `web/` hub layouts
- Commit secrets
- Run `npm run compress-glb` or wire it into install/build/CI/hooks unless Alex explicitly requests it

## Attribution

Yinsh logic traces to [sharkdp/yinsh](https://github.com/sharkdp/yinsh). See [NOTICE](./NOTICE).
