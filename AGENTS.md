# AGENTS.md

## Cursor Cloud specific instructions

`pension-road` (연금로드) is a fully client-side, serverless Vite + TypeScript educational game. There is no backend, database, login, or environment variable — all app state lives in browser LocalStorage. This means any single service ("the app") is the Vite dev server.

- Node 22+ is required and is already available on the VM. Dependencies are installed by the startup update script (`npm install`), so you do not need to reinstall them.
- Standard commands are defined in `package.json` scripts and documented in `README.md`; use those rather than duplicating them here. Key ones: `npm run dev` (dev server), `npm run lint`, `npm run typecheck`, `npm run test` (Vitest), `npm run build`, and `npm run simulate -- --runs=1000` (headless balance simulator).
- The dev server (`npm run dev`) binds to `http://localhost:5173/` by default and does not expose a network host. For browser/computer-use testing, use the localhost URL directly.
- `npm run test` uses Vitest in a Node environment (`vite.config.ts` sets `test.environment: 'node'`); engine code is pure and does not touch the DOM/LocalStorage, so tests run headlessly without a browser.
- The game is seed-based and deterministic (`src/engine/random-engine.ts`), so `npm run simulate` reproduces the numbers recorded in `IMPLEMENTATION_NOTES.md`; a mismatch there is a signal of a real behavioral change.
