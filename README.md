# City Time Period Timelapse

A fully procedural 3D city block that transforms across five eras: **1945, 1965, 1985, 2005, 2025**. No external assets — all geometry, textures, and audio are synthesized at runtime. Built with Three.js + Vite + TypeScript.

## Run

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run preview  # serve the built bundle
npm run type-check
```

## Features

- **5 eras** with distinct architecture (wood → brick → concrete/glass → curtain wall → parametric), vehicles (vintage → chrome → boxy → hatchback → EV), pedestrians (period outfits), storefronts, neon signage, street props, sky/sun color, and procedural music + ambience.
- **Timeline slider** at the top with 5 ticks; clicking a year cross-fades the entire scene in under 2 seconds.
- **Camera**: left-drag orbit, scroll zoom, right-drag pan, WASD fly. Arrow keys change era.
- **Audio**: lazy-unlocked WebAudio engine; mute toggle (🔊 / 🔇).
- **Performance**: all 5 era scenes are pre-built once at startup; pedestrians capped at ~24, vehicles at ~8.
- **Zero runtime network requests** — hermetic.

## Controls

| Input | Action |
| --- | --- |
| Left-drag | Orbit |
| Scroll | Zoom |
| Right-drag / Shift-drag | Pan |
| W A S D | Move through scene |
| ← / → | Previous / next era |
| M | Mute / unmute |

## Architecture

- `src/eras/` — era data model and per-year definitions (colors, styles, audio profiles).
- `src/assetBuilder/` — pure procedural builders (textures, buildings, storefronts, vehicles, pedestrians, props) + the `buildEraScene` assembler.
- `src/cityBlock.ts` — pre-builds all 5 era scenes and cross-fades between them.
- `src/scene.ts` — renderer, lights, sky/fog, camera, and render loop.
- `src/cameraController.ts` — custom orbit/pan/zoom/WASD camera.
- `src/audio/` — procedural WebAudio music + ambience engine.
- `src/timeline.ts` — the top timeline UI.
- `src/main.ts` — wiring: timeline ↔ scene, keyboard, mute, audio unlock.
