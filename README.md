# City Era Timelapse — 1945 to 2025

A procedurally-generated 3D city scene that transforms across five eras: **1945, 1965, 1985, 2005, 2025**. Built with Three.js, Vite, and TypeScript.

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type-check only (no emit)
npm run typecheck
```

## Architecture

```
src/
├── main.ts                  # App entrypoint: renderer, camera, render loop, resize handler
├── eras.ts                  # Shared era types & registry (EraId, EraSpec, SfxEraData, ERA_REGISTRY)
├── content/
│   └── eraConfig.ts         # Per-era content schema (buildings, storefronts, vehicles, …)
├── state/
│   └── eraState.ts          # Reactive era store (subscribe / setEra)
├── scene/
│   ├── cityScene.ts         # Scene graph root — wires all layer factories together
│   ├── cameraRig.ts         # Camera presets per era
│   ├── transitionManager.ts # Era crossfade controller
│   └── layers/
│       ├── buildings.ts
│       ├── storefronts.ts
│       ├── vehicles.ts
│       ├── pedestrians.ts
│       └── streetEnvironment.ts
├── ui/
│   ├── timeline.ts          # Top-bar era selector buttons
│   └── infoPanel.ts         # Bottom-left era description card
└── audio/
    ├── sfx.ts               # Procedural AudioBuffer generator (WebAudio)
    └── mixer.ts             # Era-aware crossfade mixer
```

## Concepts

- **Eras** — Five time periods (`'1945' | '1965' | '1985' | '2005' | '2025'`) each with distinct visual and audio parameters.
- **Scene skeleton** — Placeholder geometry (boxes, planes) renders immediately so parallel tasks can build against a stable API.
- **Procedural assets only** — All visuals use Three.js primitives; all audio uses WebAudio synthesis. No binary downloads or external assets.

## Debugging

Open your browser console to interact with the app:

```js
// Switch era from console
window.cityTimelapse.setEra('2025');

// List available eras
window.cityTimelapse.getEras();
```
