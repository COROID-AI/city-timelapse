# City Era Timelapse

An interactive 3D city block that transforms across five time periods —
**1945, 1965, 1985, 2005, 2025** — as the user drags a timeline slider. The
scene updates buildings, vehicles, storefronts, advertisements, pedestrian
outfits, lighting, and sky to match the selected era.

This repository is the **foundation scaffold**: a runnable Vite + TypeScript +
three.js shell with shared era contracts and a directory layout that every
later feature task builds on. No era-specific visuals are implemented here —
those belong to their own tasks in later phases.

## Stack

- [Vite](https://vitejs.dev/) — dev server and production bundler
- [TypeScript](https://www.typescriptlang.org/) — strict, `noEmit` type-checking
- [three.js](https://threejs.org/) — WebGL rendering (direct lifecycle; no React)
- [Vitest](https://vitest.dev/) — unit tests
- [Playwright](https://playwright.dev/) — end-to-end browser tests
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) — linting and formatting

## Getting started

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
```

## Scripts

| Script              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server                                |
| `npm run build`     | Type-check (`tsc --noEmit`) then production build        |
| `npm run preview`   | Preview the production build locally                     |
| `npm run typecheck` | Run the TypeScript compiler with no emit                 |
| `npm run lint`      | Run ESLint over the project                              |
| `npm run format`    | Format all source files with Prettier                    |
| `npm run test`      | Run unit tests (Vitest) then e2e tests (Playwright)      |
| `npm run test:unit` | Run only the Vitest unit tests                           |
| `npm run test:e2e`  | Run only the Playwright e2e tests                        |

## Folder layout

```
src/
├── main.ts                 # Composition root: renderer, camera, rAF loop
├── styles.css              # Global styles, loading overlay
├── config/
│   └── paths.ts            # Shared mount selectors & directory constants
├── engine/                 # Core engine: era contract + scene registry
│   ├── eras.ts             # TimeEra contract (EraId, EraSpec, ERA_REGISTRY)
│   ├── SceneRegistry.ts    # SceneModule contract + era-module registry
│   ├── Scene.ts            # Boot scene (ground, sky, city block, lights)
│   ├── renderer.ts         # WebGLRenderer boot + animation loop
│   └── mount.ts            # Mount point & loading overlay helpers
├── data/
│   └── eras/               # Per-era content data (later tasks)
├── environment/            # Sky, sun, fog, atmosphere (later tasks)
├── buildings/              # Per-era building facades (later tasks)
├── props/                  # Lamp posts, billboards, street props (later)
├── vehicles/               # Era-specific vehicles (later tasks)
├── pedestrians/            # Era-specific pedestrian outfits (later tasks)
├── ui/                     # Timeline slider & HUD (later tasks)
├── assets/                 # Static/procedural assets (later tasks)
└── audio/                  # Procedural Web Audio SFX (later tasks)

tests/
├── unit/                   # Vitest unit tests
└── e2e/                    # Playwright end-to-end tests
```

## Shared era contract

`src/engine/eras.ts` defines the single source of truth every downstream task
uses:

- `EraId` — `'1945' | '1965' | '1985' | '2005' | '2025'`
- `EraSpec` — `id`, `year`, `label`, `description`
- `ERA_REGISTRY` — ordered array of all eras
- `ERA_IDS` — readonly list of every `EraId`
- `getEraSpec(id)` — lookup helper

Scene modules (environment, buildings, props, vehicles, pedestrians, ui)
implement the `SceneModule` contract in `src/engine/SceneRegistry.ts` and
register themselves per era. The composition root (`src/main.ts`) owns the
renderer, camera, and animation loop — modules never create their own.

## Renderer boot sequence

1. Locate the `#app` mount point.
2. Detect WebGL2 support (with a graceful DOM fallback).
3. Create the `WebGLRenderer`, scene, camera, and `requestAnimationFrame` loop.
4. Hide the loading overlay only after the first frame has actually rendered.
