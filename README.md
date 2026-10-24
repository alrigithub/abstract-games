# Abstract Games

Five abstract board games you can play against AI in the browser. Built with TypeScript, Vite, and three.js in the `web-3d` npm workspace.

Yinsh rules and AI approach trace to [sharkdp/yinsh](https://github.com/sharkdp/yinsh). Gomoku, Boop, Tak, and Tzaar share the same engine and hosting layout.

Coding agents: see [AGENTS.md](./AGENTS.md) (canonical). Claude: [CLAUDE.md](./CLAUDE.md).

## Games

| Game | Package | Dev port |
|------|---------|----------|
| Yinsh | `@abstract/yinsh` | 5196 |
| Gomoku | `@abstract/gomoku` | 5192 |
| Boop | `@abstract/boop` | 5194 |
| Tak | `@abstract/tak` | 5190 |
| Tzaar | `@abstract/tzaar` | 5199 |

## Quick start

```bash
cd web-3d
npm ci
npm run dev -w @abstract/tak   # pick any game package
npm test
npm run build
npm run test:e2e
```

## Repository layout

```
web-3d/
  engine/           @abstract/three-engine
  games/<game>/     @abstract/<game> — rules, worker AI, Vite entry
  hub/              lobby page linked from staging root
  e2e/              Playwright smoke tests (one spec per game)
  scripts/          GLB compression, etc.
scripts/
  stage_web3d_hosting.sh
```

## Deploy

Build and assemble a static tree:

```bash
./scripts/stage_web3d_hosting.sh
```

Upload **`hosting-staging/`** as a whole directory to Firebase Hosting site **bimsavage-games** (`/` → hub, `/tak`, `/gomoku`, … → each game’s `dist`).

## License

**MIT OR Apache-2.0** — [LICENSE-MIT](./LICENSE-MIT), [LICENSE-APACHE](./LICENSE-APACHE). Third-party notes: [NOTICE](./NOTICE).
