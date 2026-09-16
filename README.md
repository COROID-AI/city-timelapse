# City Time Period Timelapse

A polished high-end 3D city block that transforms in front of your eyes across
five eras — 1945, 1965, 1985, 2005 and 2025.

Create a 3D scene of a city block. Emphasis on detail is very important.

The scene has a timeline slider at the top with five stops: **1945, 1965,
1985, 2005, 2025**. Selecting any stop transforms the scene to that time
period: buildings, vehicles, storefronts, advertisements, pedestrian outfits,
street props, atmosphere and audio all change in lockstep.

Time period affects all aspects of the city block — the buildings, the
vehicles, the storefronts, advertisements, outfits of the pedestrians,
everything. The scene is polished and high-end, with procedural SFX
(transition whoosh, era ambience), the ability to navigate around and look at
things (orbit / pan / zoom + per-era viewpoints), and go-all-out visual
quality.

> Note: the original brief mentioned 2055; the implemented slider ships the
> five stops above (the era registry intentionally has exactly five eras).

## Getting started

Prerequisites: Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (opens at http://localhost:5173)
npm run dev

# 3. Production build (outputs to dist/)
npm run build

# 4. Preview the production build
npm run preview

# 5. Run the automated test suite (era system, every content layer,
#    composition integration and the final QA era walk)
npm test

# 6. Type-check the whole project
npm run typecheck
```

## Using the timelapse

- **Timeline slider** — drag or click any of the five stops; the scene
  visibly morphs over a ~2s eased transition with a whoosh SFX and the era's
  ambience.
- **Navigation** — drag to orbit, scroll to zoom, and use the era viewpoint
  presets to fly to each period's best angle. Navigation damping keeps it
  smooth.
- **SFX** — procedural Web Audio ambience per era (traffic, crowds, electrical
  hums, music beds). Browsers gate audio on a user gesture: click anywhere to
  unlock.

## Project anatomy

```
src/
  core/        SceneRuntime (headless scene graph + frame loop), block layout
  eras/        EraSystem — the single source of truth for the five eras
  block/       Buildings, storefronts, advertisements, street surface
  props/       Street props: lamps, trees, hydrants, benches, meters, kiosks, chargers
  vehicles/    Era vehicle fleets, traffic loop and parked cars
  pedestrians/ Procedural pedestrians with era outfits and walk routes
  atmosphere/  Per-era sky, fog, sun, ambient light and postprocessing
  audio/       Procedural SFX and era ambience (Web Audio API, headless fake)
  navigation/  Orbit/pan/zoom controls and era viewpoint presets
  ui/          Top timeline slider with the five era stops
  app/         AppComposition — composes all layers, binds slider/SFX/navigation
  quality/     Renderer quality config + performance/memory report + QA suite
```

## Quality configuration

`src/quality/qualityConfig.ts` owns the renderer quality knobs:

- **pixel-ratio cap** — bounds the antialias resolve resolution on high-DPI
  displays (default 2x).
- **antialias** — MSAA on/off (default on).
- **geometry / material reuse** — shared cached assets across the era scene
  (default on).
- **instancing** — prefer instanced rendering for repeated props (default on).

The same module exposes `createPerformanceReport()`, a lightweight
performance/memory reporting hook (mesh counts, unique vs shared
geometry/material, estimated memory) that the browser entry can seed per
frame and the QA suite asserts against the headless scene.

## QA suite

`npm test` runs unit tests for every layer plus `src/quality/qa.test.ts`, the
final acceptance suite that:

- boots the composed `AppComposition` headlessly and walks all five eras
  end-to-end through the exact slider code path;
- asserts content counts (buildings, storefronts, advertisements, street
  props, vehicles, pedestrians, atmosphere) and era integrity (registry
  order, validity, frozen definitions);
- asserts no runtime errors across the walk (including idempotent teardown);
- asserts the README documents install/run/build/test instructions.

## Scripts

| Script           | Purpose                                     |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Start the Vite dev server                   |
| `npm run build`  | Production build to `dist/`                 |
| `npm run preview`| Serve the production build                  |
| `npm run typecheck` | TypeScript check without emitting        |
| `npm test`       | Full Vitest suite                           |
| `npm run test:watch` | Run Vitest in watch mode                |
| `npm run test:era` | Era-system tests only                    |