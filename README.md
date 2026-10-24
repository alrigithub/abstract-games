# Abstract Games

Abstract board games with human-vs-AI play in the browser. Built with TypeScript, Vite, and three.js.

The Yinsh rules and AI approach trace to [sharkdp/yinsh](https://github.com/sharkdp/yinsh) by David Peter and contributors. Gomoku, Boop, Tak, and Tzaar are implemented in the shared `web-3d` workspace.

Agent and contributor guidance: [AGENTS.md](./AGENTS.md).

## Games

| Game | Path |
|------|------|
| Yinsh | `web-3d/games/yinsh` |
| Gomoku | `web-3d/games/gomoku` |
| Boop | `web-3d/games/boop` |
| Tak | `web-3d/games/tak` |
| Tzaar | `web-3d/games/tzaar` |

## Development

```bash
cd web-3d
npm ci
npm test
npm run build
npx playwright test
```

Serve a single game locally (example — Tak):

```bash
cd web-3d/games/tak && npm run dev
```

Stage all games plus the lobby hub for static hosting:

```bash
./scripts/stage_web3d_hosting.sh
```

## Attribution

See [NOTICE](./NOTICE). Licensed under **MIT OR Apache-2.0** ([LICENSE-MIT](./LICENSE-MIT), [LICENSE-APACHE](./LICENSE-APACHE)).
