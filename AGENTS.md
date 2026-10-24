# AGENTS.md

Guidance for coding agents working in this repository.

## Product

TypeScript + **three.js** abstract board games. Human vs AI, offline, in the browser.
Feel target: polished 3D boards, async minimax in Web Workers, smooth piece motion.

## Games

| Game | Package |
|------|---------|
| Yinsh | `web-3d/games/yinsh` (`@abstract/yinsh`) |
| Gomoku | `web-3d/games/gomoku` (`@abstract/gomoku`) |
| Boop | `web-3d/games/boop` (`@abstract/boop`) |
| Tak | `web-3d/games/tak` (`@abstract/tak`) |
| Tzaar | `web-3d/games/tzaar` (`@abstract/tzaar`) |

Shared rendering and UI: `web-3d/engine` (`@abstract/three-engine`).

## Commands

```bash
cd web-3d
npm ci
npm test
npm run build
npx playwright test
```

Stage a static hosting tree (hub + all game bundles):

```bash
./scripts/stage_web3d_hosting.sh
```

Hub page: `web-3d/hub/index.html` (copied to staging root by the script above).

## Patterns

- Pure game rules in each game package’s `src/game/` (no three.js imports in engine modules when possible)
- AI via dedicated workers (`*.worker.ts`); never block the render loop
- Shared UI: `createGameButtons`, themes, camera presets, placement SFX in `@abstract/three-engine`
- Vitest unit tests per package; Playwright e2e under `web-3d/e2e/`

## Do not

- Add online multiplayer in v1
- Reintroduce Rust/Bevy/WASM game shells for these titles
- Commit secrets or large binary assets without need

## Attribution

Yinsh logic traces to [sharkdp/yinsh](https://github.com/sharkdp/yinsh). See [NOTICE](./NOTICE).
