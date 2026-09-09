# City Time Period Timelapse

A 3D city block that transforms across six eras — 1945, 1965, 1985, 2005, 2025, and 2055 — selected from a timeline slider. Polished, navigable, and procedural: every visual and audio asset is generated at runtime (canvas textures, WebAudio synthesis); there is no binary asset pipeline.

This repository is greenfield. The scaffold task established the one and only runnable foundation (Vite + TypeScript + Three.js) that all later era-system tasks build on in parallel.

## Prerequisites

- Node.js >= 22.12.0 (`engines` constraint in `package.json`)

## Scripts

| Script            | Command                     | Purpose                                                         |
| ----------------- | --------------------------- | --------------------------------------------------------------- |
| `dev`             | `npm run dev`               | Vite dev server at http://127.0.0.1:5173                        |
| `build`           | `npm run build`             | Strict typecheck (`tsc --noEmit`) + production bundle to `dist/` |
| `preview`         | `npm run preview`           | Serve the production build locally                              |
| `test`            | `npm test`                  | Run the Vitest suite once (jsdom environment)                   |
| `test:watch`      | `npm run test:watch`        | Run Vitest in watch mode                                        |
| `typecheck`       | `npm run typecheck`         | Strict `tsc --noEmit` check only                                |

## Project structure

| Path                          | Responsibility                                              |
| ----------------------------- | ----------------------------------------------------------- |
| `index.html`                  | Mounts `#app` full-viewport; loads `/src/main.ts`           |
| `src/main.ts`                 | `bootstrap` entrypoint: renderer, placeholder scene, resize |
| `src/app/renderLoop.ts`       | Shared RAF loop: `startRenderLoop(canvas, callbacks)`       |
| `src/app/__tests__/`          | Colocated Vitest suites (jsdom)                             |
| `src/styles/base.css`         | Global styles: full-viewport canvas mount, fallback notice  |
| `public/favicon.svg`          | Procedural SVG favicon                                      |
| `vite.config.ts` etc.         | Toolchain config (frozen)                                   |

## Frozen scaffold files

These files are owned by the scaffolding task. Later tasks must **not** re-create or rename them; the compose-scene-app task is the only task allowed to rewrite `src/main.ts` for application wiring:

- `package.json`, `package-lock.json`
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- `index.html`, `public/favicon.svg`
- `src/main.ts`, `src/app/renderLoop.ts`, `src/styles/base.css`
- `.gitignore`, `README.md`

## Shared contracts

### Render loop — `src/app/renderLoop.ts`

```ts
startRenderLoop(
  canvas: HTMLCanvasElement,
  callbacks: { update: (deltaSeconds: number) => void; onDispose?: () => void },
): RenderLoopHandle
```

- Owns the single `requestAnimationFrame` heartbeat for the app.
- Calls `update(deltaSeconds)` every frame with the elapsed time since the previous frame, in seconds. The first frame's delta is `0`; deltas are clamped to non-negative values.
- `RenderLoopHandle.running` reports whether a frame is scheduled; `dispose()` cancels the pending frame, invokes `onDispose` exactly once, and is idempotent.
- Every later system that needs per-frame work (atmosphere, buildings, vehicles, pedestrians, audio, UI) receives its tick through a callback supplied here; composition wires them together.

### Bootstrap — `src/main.ts`

```ts
bootstrap(mount: HTMLElement): { renderer, loop, dispose() }
```

Mounts the Three.js canvas into `#app`, creates the placeholder ground grid + block outline, handles viewport resize (`ResizeObserver` plus window resize), and starts the render loop through `startRenderLoop`. Falls back to a styled notice when WebGL is unavailable.

## Era-system architecture conventions

1. **One render loop.** All per-frame updates flow through `startRenderLoop` in `src/app/renderLoop.ts`; no system starts its own RAF loop.
2. **Module per system.** Each era system (atmosphere, buildings, audio, vehicles, pedestrians, UI, …) lives in its own module under `src/app/`, exposes a typed lifecycle (instantiate / attach / update / dispose) where relevant, and owns colocated tests in a `__tests__` folder using Vitest + jsdom.
3. **Procedural only.** All visual and audio assets are generated at runtime — canvas textures, geometry, WebAudio synthesis. Never add binary asset files or an asset-pipeline dependency.
4. **No UI frameworks / no new runtime dependencies.** The runtime surface stays Three.js plus the toolchain. UI is DOM + CSS.
5. **Frozen shared files.** Parallel tasks never edit the frozen scaffold files listed above; wiring is centralized in `bootstrap` / the compose-scene-app task.
6. **Strict TypeScript.** `npm run build` runs `tsc --noEmit` with the strict tsconfig before bundling; keep `noUnusedLocals` / `noUnusedParameters` clean.