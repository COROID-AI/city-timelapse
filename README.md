# City Timelapse 1945–2025

A 3D city-block timelapse built with **Vite + TypeScript + three.js**. Walk through five decades of urban change—from post-war dusk to a connected horizon—via an interactive timeline slider.

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server (hot-reload)
npm run dev

# Build for production → dist/
npm run build

# Type-check without emitting
npm run typecheck

# Preview the production build locally
npm run preview
```

Open `http://localhost:5173` after running `npm run dev`.

## Architecture

- **Vite** — fast dev server and production bundler
- **TypeScript** — strict mode, ES2020 target, moduleResolution = bundler
- **three.js** — WebGL rendering engine
- **src/eras.ts** — shared era contract (`EraId`, `EraSpec`, `SfxEraData`, `ERA_REGISTRY`, `ERA_IDS`, `getEraSpec`, `SFX_ERA_DATA`) consumed by all visual and audio work

## Commands Reference

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm install`     | Install all project dependencies   |
| `npm run dev`     | Launch Vite dev server on :5173    |
| `npm run build`   | TypeScript check + Vite production build into `dist/` |
| `npm run typecheck` | Run `tsc --noEmit` only          |
| `npm run preview` | Serve `dist/` locally for testing  |
