# City Time Period Timelapse

A polished, fully procedural 3D city block that transforms across five eras — **1945, 1965, 1985, 2005 and 2025** — in front of your eyes. Buildings, vehicles, storefronts, advertisements and pedestrian outfits all change with the time period, accompanied by a crossfading procedural soundscape.

![timeline of eras](https://img.shields.io/badge/eras-1945%20%7C%201965%20%7C%201985%20%7C%202005%20%7C%202025-6ad0ff)

## Features

- **Timeline slider** at the top with five era stops; click any year for a smooth ~800 ms transition.
- **Per-era visuals** that visibly differ across every axis: building silhouettes (flat → stepped → setback → glass), window patterns, vehicle sets, pedestrian outfit palettes, storefront signage and sky/fog tint.
- **Orbit navigation** — pan, zoom and rotate around the block with damping and enforced min/max distance (Three.js `OrbitControls`).
- **Procedural audio** — an ambient drone that crossfades per era plus transition/click SFX, with a working mute toggle. (Audio starts after the first interaction per browser autoplay policy.)
- **Hover tooltips** showing the era-specific storefront name; click a building to focus the camera on it.
- **Living streets** — pedestrians walk the sidewalks (with leg/arm swing) and vehicles loop the roads; both pause/reset cleanly on era swap.
- **Graceful WebGL fallback** — if WebGL is unavailable, a friendly message is shown instead of a crash.
- **Pure-procedural assets** — no external 3D models, textures or audio files; the repo is fully self-contained. Deterministic seeded layouts (mulberry32) keep placement stable per era.

## Tech Stack

- [Vite](https://vitejs.dev/) + [Type](https://www.typescriptlang.org/)Script
- [Three.js](https://threejs.org/) `0.160` (with matching `@types/three@0.160`)
- Web Audio API for synthesized sound

## Getting Started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (honors $PORT)
```

Then open the printed URL. Use the timeline at the top to travel between eras; drag to orbit, scroll to zoom, right-drag to pan, and click a building to focus on it.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (binds `0.0.0.0:$PORT`, strict port). |
| `npm run build` | Type-check (`tsc --noEmit`) then produce a production `dist/`. |
| `npm run preview` | Serve the production build (`0.0.0.0:$PORT`, strict port). |
| `npm run typecheck` | Run `tsc --noEmit` only. |

## Project Structure

```
src/
  main.ts              # Bootstrap: scene + city + camera + UI + interaction
  scene.ts             # WebGLRenderer, lighting, sky shader, fog tween
  cityBlock.ts         # Per-era layout: buildings, vehicles, pedestrians
  cameraController.ts  # PerspectiveCamera + OrbitControls + tweened focus
  timeline.ts          # Era state machine (validates/clamps transitions)
  eras/
    types.ts           # EraId, EraDescriptor, BuildingType, VehicleVariant
    data.ts            # ERAS table (colors, silhouettes, storefronts, ...)
    constants.ts       # ERA_IDS, tween clamp/validate helpers
  assetBuilder/
    index.ts           # Barrel
    textures.ts        # Procedural facade + sign CanvasTextures (cached)
    eras.ts            # makeBuilding() — era-specific silhouettes
    vehicle.ts         # makeVehicle() — car/truck with named wheels
    pedestrian.ts      # makePedestrian() — era-palette figures
  audio/
    mixer.ts           # AudioMixer — crossfading era drones + mute
    sfx.ts             # SfxPlayer — transition whoosh / UI click
  utils/rng.ts         # mulberry32 seeded RNG + math helpers
  styles.css           # Timeline, HUD, tooltip, overlays
```

## Design Notes

- **Deterministic layout** — each era seeds a `mulberry32` PRNG so vehicle/pedestrian placement is stable and reproducible.
- **Memory safety** — the previous era's geometries/materials are disposed before the new era is built; procedural textures are cached by content hash and disposed on teardown.
- **Tween safety** — an in-flight era tween is cancelled cleanly if another era is selected mid-transition (no partial state leaks).
- **Autoplay policy** — the `AudioContext` is resumed on the first user interaction (timeline click or canvas click).
