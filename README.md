# City Time Period Timelapse

A 3D city block that transforms across five time periods (1945, 1965, 1985,
2005, 2025). This repository contains the **foundation scaffold**: a runnable
Vite + TypeScript (strict) + Three.js app shell, the era domain (registry +
reactive state), a data-driven city-block layout, camera navigation, and
placeholder light/sky/vehicle/audio hooks.

> **Status:** Greenfield foundation. Downstream era tasks replace the placeholder
> grey building shells with full period-specific content on the stable lot
> anchors defined here.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start the Vite dev server (http://127.0.0.1:5173)
npm run build        # production build (emits to dist/)
npm run preview      # serve the production build (http://127.0.0.1:4173)
npm run typecheck    # TypeScript strict type-check (tsc --noEmit)
npm test             # run the Vitest unit test suite
```

Health check endpoint (dev + preview): `GET /healthz` → `200 {"status":"ok"}`.

## Controls

- **WASD** — free-fly move (relative to camera facing).
- **Mouse drag** — look around (pointer down + move).
- **Orbit button** — toggle an orbit preset that circles the block.
- **Mobile joystick** (pinned bottom-left) — touch movement.
- **Timeline slider** (top) — snap between 1945/1965/1985/2005/2025.
- **Time of day** slider (bottom-right) — preview day/night lighting.

## Architecture

```
src/
  main.ts                  createApp bootstrap (scene, renderer, controls)
  styles.css               UI overlay styling
  state/eraState.ts        reactive EraState store (defaults to 1945)
  state/eraRegistry.ts     typed metadata per era (5 canonical years)
  layout/cityBlockLayout.ts data-driven block: ground, streets, sidewalks,
                            intersection, 10 lots + cross street
  layout/lotAnchors.ts     lot anchor contract + transforms
  camera/cameraRig.ts      WASD + mouse-look + orbit + joystick
  audio/sfxContext.ts      WebAudio hook (init on first gesture)
  ui/uiRoot.ts             permanent DOM overlay root above the canvas
  ui/timelineSlider.ts     top timeline slider driving EraState
  render/renderer.ts       WebGL scene: ground, streets, shells
  render/lighting.ts       sun/sky light rig (time-of-day)
  render/sky.ts            sky dome + sun disc
  vehicles/placeholderVehicle.ts  one moving vehicle on the road loop
  types/*.ts               shared data contracts (era, city, street feature,
                           building shell)
tests/                     Vitest unit tests
```

## Coordinate conventions (stable contract)

- World units are **meters**. `y = 0` is the ground plane; `y` is up.
- The block is centered on the world origin. `x` runs east (+), `z` runs south (+).
- The ground plane spans `x ∈ [-44, 44]`, `z ∈ [-44, 44]` (a 88×88 m area
  including streets, sidewalks, and the block).
- **Lots:** a 5×2 grid of 10 parcels (12 m wide × 28 m deep each) with a
  4 m **cross street** running east–west between the two rows.
- **Lot anchors** (`src/layout/lotAnchors.ts`) are the stable placement
  contract every era task uses:
  - `origin` — world-space corner (min x, min z) of the lot footprint.
  - `width` / `depth` — footprint size in meters.
  - `rotation` — building orientation relative to the block (0 or 180°).
  - `transform(localX, localY, localZ)` — maps lot-local space (origin at
    lot corner) into world space, applying rotation.
- **Streets:** a curb-to-curb perimeter ring (16 m wide asphalt) plus the
  cross street. **Sidewalks** are 4 m strips between streets and lots.
- **Camera bounds:** the camera is clamped to `layout.bounds` (the ground
  plane extent plus a small margin).

## Data contracts

- **Era** (`src/types/era.ts`): exactly five canonical years
  `1945 / 1965 / 1985 / 2005 / 2025`. `EraState` defaults to 1945, clamps
  invalid values to the nearest canonical year, and notifies subscribers.
- **StreetFeature** (`src/types/streetFeature.ts`): typed discrete objects
  placed on/beside streets, with a runtime `validateStreetFeature` validator.
- **BuildingShell** (`src/types/buildingShell.ts`): placeholder grey box on a
  lot, with a runtime `validateBuildingShell` validator.

Downstream era modules implement the StreetFeature/BuildingShell contracts
against the lot anchors; at least two reference implementations of each are
covered by the unit tests.