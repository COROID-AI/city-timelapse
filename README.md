# Walkable Procedural City

A complete, walkable 3D city built with [three.js](https://threejs.org/), Vite and
TypeScript. A deterministic seeded generator produces a street grid with
buildings, sidewalks, road markings and street props; animated traffic drives
the streets; a daytime sky dome and sun shadows light the scene; and a HUD
overlay (crosshair, controls hint, minimap) tracks the player. Explore on foot
with Pointer Lock or from above with orbit controls.

## Feature modules

- **`src/city`** — procedural city generation. Deterministic `mulberry32` PRNG
  seeded generation (default seed `20260804`) builds a `blocksPerSide ×
  blocksPerSide` street grid (default 5×5): ground plane, instanced roads,
  sidewalks, lane markings, crosswalks, and 1–3 instanced buildings per block.
  Exports plain-number `collisionData` bounding boxes used by the walk
  controls, plus a `grid` of street segments shared with the detail layer and
  the minimap. The same seed always reproduces the same city.
- **`src/controls`** — first-person `WalkControls` (WASD/arrows, sprint, jump,
  collision-aware movement against building boxes) built on
  `PointerLockControls`, plus an `OrbitControls` fallback with an `R` key mode
  toggle.
- **`src/lighting`** — daytime atmosphere: gradient sky dome with a sun disc,
  a shadow-casting directional sun, and ambient/hemisphere fill.
- **`src/detail`** — instanced street props along every sidewalk and an
  animated `TrafficSystem` (vehicles + pedestrians) that reuses the city seed
  and street grid so everything stays aligned. Decorative only — walk-control
  collision data is untouched.
- **`src/overlay`** — HUD overlay: centered crosshair, live controls hint and
  a canvas minimap that shares the generator's coordinate system.

## Requirements

- Node.js 20+ (Vite 8 and Vitest 4 require a recent LTS)
- npm (any recent version)
- A browser with WebGL support for running the experience

## Install

```sh
npm install
```

## Run the dev server

```sh
npm run dev
```

Serves the app at <http://localhost:5173> (configured in `vite.config.ts`).
Click the canvas to capture the mouse and start walking.

## Build for production

```sh
npm run build
```

Type-checks the project (`tsc -b`) and bundles with Vite, emitting static
assets to `dist/`.

## Preview the production build

```sh
npm run preview
```

Serves the built `dist/` output locally (Vite preview default:
<http://localhost:4173>). Run `npm run build` first so `dist/` is up to date.

## Test

```sh
npm test
```

Runs the Vitest suite headlessly (no browser, no WebGL context required). The
suite covers deterministic seeded city generation, block counts and layout
invariants, collision-box alignment, controls, lighting, detail and overlay
units.

## Scripts

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm install`      | Install dependencies                            |
| `npm run dev`      | Start the Vite dev server (port 5173)           |
| `npm run build`    | Type-check and produce `dist/`                  |
| `npm run preview`  | Serve the production build (default port 4173)  |
| `npm test`         | Run the headless Vitest suite                   |

## Controls

**Walk mode (default, Pointer Lock):**

- Click the canvas to lock the pointer and capture the mouse
- Mouse — look around
- `W` / `A` / `S` / `D` or arrow keys — walk (collision-aware, stays on the
  ground)
- `Shift` — sprint
- `Space` — jump
- `Esc` — release the pointer (also exits Pointer Lock in the browser)

**Orbit mode (fallback / aerial view):**

- `R` — toggle between walk mode and orbit mode
- Drag — rotate the view around the city
- Scroll — zoom
- `R` — return to walk mode

If the browser blocks Pointer Lock (e.g. the page runs in an iframe without
the `allow="pointer-lock"` permission), the app automatically falls back to
orbit mode so the city stays viewable. An on-screen prompt in the top-left
always shows the active controls.

## How generation works

`generateCity(options)` (in `src/city`) takes a `seed` and produces a
fully deterministic city: the same seed yields the same block layout, building
counts, footprints, heights and facade colors every run. Options include
`blocksPerSide`, `blockSize`, `sidewalkWidth`, `streetWidth`,
`buildingHeight` and `buildingFootprint`. The walkable area is the sidewalk
ring around every block; building bounding boxes are exported as
`collisionData` so movement never walks through walls.

## Troubleshooting

- **Nothing renders / black screen** — the browser needs WebGL. Check the
  console for a `WebGLRenderer` context error and try a WebGL-enabled browser.
- **Clicking does not capture the mouse** — Pointer Lock requires a user
  gesture and may be blocked inside iframes without the `pointer-lock`
  permission. The app falls back to orbit mode (`R` still toggles); in your
  own embedding, add `allow="pointer-lock"` to the iframe.
- **Port already in use** — Vite picks the next free port automatically;
  check the terminal output for the actual dev/preview URL.
