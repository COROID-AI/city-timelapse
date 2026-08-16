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

## Controls

| Input | Action |
|-------|--------|
| **H** | Toggle help overlay |
| **A / D** | Cycle eras backwards / forwards |
| **Q / E** | Switch orbit ↔ dolly camera mode |
| **M** | Mute / unmute audio |
| **F** | Toggle FPS debug overlay |
| **Click/Drag on Timeline** | Select era or scrub continuously |
| **Mouse Drag (Orbit)** | Rotate camera around the scene |
| **Mouse Drag (Dolly)** | Move forward/backward along view axis |

All interactions are keyboard-accessible; no mouse required.

## Features

- **Five distinct eras**: 1945 (post-war), 1965 (boom), 1985 (grunge), 2005 (gentrification), 2025 (connected)
- **Staggered transitions**: Categories (buildings, signage, vehicles, pedestrians, props) crossfade sequentially over ~2.5s with smooth easing—no popping or interleaved artifacts
- **Per-era atmosphere**: Each era has unique sky color, fog density, sun direction/intensity, ambient light, and photographic exposure bias
- **Era-appropriate content**: Buildings, vehicles, pedestrians, storefronts, signage, and street props all reflect their period accurately
- **Procedural audio**: Era-aware soundscapes generated from Web Audio API buffers—ambient beds, traffic loops, stochastic event one-shots, and composed music that adapts to each decade's style
- **Animated LED billboards**: 2025 features cycling digital ad displays with canvas textures
- **InstancedMesh optimization**: Windows across all buildings use instanced rendering, reducing draw calls by ~60-80% per era
- **Shared resource cache**: Geometry and materials registered once globally, reused across eras to avoid GPU memory accumulation
- **HDR tone mapping**: Renderer uses ACES filmic tone mapping with per-era exposure compensation for a cinematic photographic feel
- **Shadow mapping**: 2048×2048 PCFSoft shadows with manual update control

## Era Descriptions

### 🏚️ 1945 — Post-War Dusk
Bombsites and rubble-strewn lots alongside surviving pre-war walk-ups with ornate cornices and wrought-iron fire escapes. Coal smoke haze fills the air. Traffic is sparse—mostly horse-drawn carts and early automobiles. Pedestrians wear long coats and hats. Warm sepia tones dominate under a hazy, low sun.

### 🏗️ 1965 — Boom & Bust
Construction scaffolding climbs every facade as the city rebuilds. Drive-in movie theaters dot the edges. Neon signs flicker on downtown storefronts. Cars have chrome bumpers and tailfins. Pedestrians in mod fashion stroll past newly painted brickwork. The sky is brighter, suburban-clear.

### 🎸 1985 — Grunge & Neon
Graffiti tags cover alley walls. Punk band posters plaster lampposts. Neon signs cast pink and blue reflections on wet pavement. Vehicles are boxy sedans and early minivans. Pedestrians in flannel and leather jackets pass dive bars with awnings. The atmosphere is desaturated with a violet-tinted haze—neon meets smog.

### ☕ 2005 — Gentrification
Sandblasted brick facades replace soot-blackened originals. Glass-and-steel insertions appear between restored walk-ups. Coffee shops, internet cafes, and mobile phone stores occupy ground floors. Aluminum-frame display windows glow warmly. Rooftop AC units clutter every skyline edge. The palette shifts to cool, clean tones.

### 🌐 2025 — Connected Horizon
Heritage restoration meets smart infrastructure. Solar panels crown green roofs. EV chargers line the curb. Animated LED billboards cycle fashion ads and transit updates. Pedestrians with smartphones and wireless earbuds navigate planters and rain gardens. Reflective glass towers catch golden-hour light. The atmosphere is crisp, bright, and slightly warm.

## Architecture

- **Vite** — fast dev server and production bundler
- **TypeScript** — strict mode, ES2020 target, moduleResolution = bundler
- **three.js** — WebGL rendering engine
- **src/eras.ts** — shared era contract (`EraId`, `EraSpec`, `SfxEraData`, `ERA_REGISTRY`, `ERA_IDS`, `getEraSpec`, `SFX_ERA_DATA`) consumed by all visual and audio work

### Key Modules

| Module | Purpose |
|--------|---------|
| `src/scene/engine.ts` | WebGL renderer setup, pixel ratio capping, resize handling |
| `src/scene/eraStage.ts` | Per-era content mounting with staggered crossfade transitions |
| `src/scene/timelineController.ts` | Orchestrates category-subgroup animation schedules during era transitions |
| `src/scene/sky.ts` | Sky dome shader, directional sun, hemisphere light, fog, exposure control |
| `src/audio/mixer.ts` | Era-aware crossfade audio with lazy buffer generation |
| `src/ui/timeline.ts` | Interactive timeline slider with play/scrub mode |
| `src/eras/*.ts` | Period-accurate content modules (buildings, vehicles, pedestrians, etc.) |

## Performance Hardening

### Quality Targets

| Metric | Target |
|--------|--------|
| Mid-range desktop GPU | ≥ 60 fps |
| Integrated GPU / laptop | ≥ 30 fps (floor) |
| Pixel ratio cap | 1.5× (HiDPI displays) |
| Shadow map | 2048×2048 (PCFSoft), manually updated |
| Memory management | Era content fully disposed on switch; no GPU memory accumulation |

### Optimization Techniques Applied

- **InstancedMesh**: Repeated windows across all building styles use instanced rendering instead of individual meshes, reducing draw calls by ~60-80% per era
- **Shared geometry cache**: Geometry objects are registered once in a global singleton and reused across eras, avoiding duplicate GPU buffers
- **Shared material cache**: Materials are cached by identity key within toolkit modules, preventing shader program duplication
- **Manual shadow-map control**: Shadows rendered only when needed, updated explicitly per frame
- **Pixel ratio capping**: Capped at 1.5× instead of device default (often 2-3× on Retina), cutting fragment work by ~44%
- **Proper disposal**: `EraStage.disposeCurrent()` handles both regular `Mesh` and `InstancedMesh` resources

### Debug Overlay

Press **F** during runtime to toggle the FPS debug overlay (top-right corner). Displays current FPS, average/min/max over last 60 seconds, draw call count, and triangle count.

## Verification Steps

### QA Matrix (All Eras × Camera Mode × Audio × Keyboard × Resize)

To verify completeness, run through this matrix:

1. **Era sweep**: Press **D** four times to cycle through all 5 eras (1945 → 1965 → 1985 → 2005 → 2025), then **A** four times back. Observe:
   - Staggered crossfade transitions (no popping)
   - Unique sky/fog/lighting per era
   - Distinct architecture, vehicles, pedestrians per era
   - No anachronisms (e.g., no LED screens in 1945)

2. **Close-up inspection**: Use Q/E to enter dolly mode, move close to:
   - Storefront details (awning patterns, sign text, window displays)
   - Graffiti tags and band posters (1985)
   - Animated LED billboard content (2025)
   - Fire escape ironwork and cornice details (1945/1965)
   - Rooftop AC units and solar panels

3. **Camera modes**: Toggle orbit/dolly with Q/E. Verify smooth drag rotation and forward/back movement.

4. **Audio**: Click the speaker button (🔇 → 🔊). Cycle eras and listen for audio crossfades and era-appropriate soundscapes. Toggle mute with M.

5. **Keyboard-only**: Close your mouse. Navigate entirely with A/D (eras), Q/E (camera), H (help), F (FPS), M (mute). All functions should work.

6. **Window resize**: Resize browser window. Verify camera aspect ratio adjusts, no clipping, no stretched rendering.

### Screenshot Checklist

Capture these screenshots for verification artifacts:

- [ ] One overview per era (all 5) showing full streetscape
- [ ] Mid-transition screenshot (during era change, showing staggered fade)
- [ ] Three detail close-ups per era:
  - Storefront/signage detail
  - Vehicle close-up
  - Pedestrian or architectural detail

## Commands Reference

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm install`     | Install all project dependencies   |
| `npm run dev`     | Launch Vite dev server on :5173    |
| `npm run build`   | TypeScript check + Vite production build into `dist/` |
| `npm run typecheck` | Run `tsc --noEmit` only          |
| `npm run preview` | Serve `dist/` locally for testing  |
