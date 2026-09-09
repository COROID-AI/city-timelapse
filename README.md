# City Time Period Timelapse

A 3D city block that transforms across five eras — 1945, 1965, 1985, 2005, 2025 — selected from a timeline slider. Polished, navigable, and procedural: every visual and audio asset is generated at runtime (canvas textures, WebAudio synthesis); there is no binary asset pipeline.

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

## Controls

| Key / Control       | Action                                                      |
| ------------------- | ----------------------------------------------------------- |
| `1` … `5`           | Jump directly to the era (1945, 1965, 1985, 2005, 2025)     |
| `←` / `→`           | Step one era forward/backward                               |
| Drag (timeline)     | Live-scrub the era transition                               |
| `Home` / `End`      | Jump to 1945 / 2025                                         |
| POI chips (HUD)     | Fly the camera to Corner / Midblock / Rooftop               |
| Orbit drag          | Orbit the city block                                         |
| Mute button (HUD)   | Toggle WebAudio ambience                                    |
| Start overlay       | Click *Enter the scene* to unlock audio + camera intro      |

The **quality HUD** (top-right) shows the active rendering tier (`Quality HIGH`) and live FPS. Tiers are selected **automatically** from the rolling FPS to protect the 60fps target — no user configuration needed.

## Quality tiers

Post-processing and performance budgets are controlled by three quality tiers. Each tier sets the renderer's pixel ratio, the directional shadow-map size, and the bloom budget:

| Tier    | Pixel ratio | Shadow map | Bloom    |
| ------- | ----------- | ---------- | -------- |
| Low     | 1.0x        | 256px      | off      |
| Medium  | 1.25x       | 512px      | 0.55     |
| High    | 1.5x        | 1024px     | 1.0      |

- **Automatic FPS selection** — a rolling 1s FPS window drives hysteresis-based tier switching (`LOW_FPS_THRESHOLD=48`, `HIGH_FPS_THRESHOLD=58`, 30 agreeing frames before a change). `src/fx/qualityTiers.ts` owns the table and selection logic.
- **`prefers-reduced-motion`** — when the OS/browser preference is set, era transitions snap immediately (zero-duration channel): camera drift, transition shake, and particle churn are driven by the same channel `t` and are thus disabled, **never** the era transform itself.

## Post-processing pipeline (`src/fx/`)

1. **UnrealBloom** — a highlight glow pass targeting emissive materials tagged with the signage convention `userData.bloom === true` (neon/LED boards, media facades, lit windows, lamps). The active tier's bloom budget drives how hot those highlights get before ACES roll-off, so neon/LED signage reads as a soft halo at High and stays unglowing at Low.
2. **Vignette + film grade** — a radial corner falloff rendered on a small procedural canvas (`src/fx/gradeShader.ts`) plus a warm golden-hour grade (temperature / saturation / contrast / exposure) applied via the renderer's tone-mapping pipeline.
3. **ACES tone mapping** — `renderer.toneMapping = ACESFilmicToneMapping` with the grade's exposure. The ACES filmic curve rolls off highlights smoothly so boosted emissive boards never clip into hard digital blowouts.

The pipeline owns one directional key light (the sun) that casts a real shadow map; `mapSize` follows the active tier. Automatic tier selection lives in `src/fx/postProcessing.ts` (`FpsWindow` + `createQualityController`).

## The five eras

| Era  | Theme                                             |
| ---- | ------------------------------------------------- |
| 1945 | Coal haze, warm gas lanterns, water towers        |
| 1965 | Sodium-orange motor city, AC units, mid-century   |
| 1985 | Photochemical smog, CRT-era glow, antennas        |
| 2005 | White-LED crispness, satellite dishes, glass      |
| 2025 | Clean bright air, cool LED + string lights, solar |

All five eras share one consistent golden-hour film grade — the era mood comes from haze, lamp tech, signs, and particles, not from changing the grade.

## Architecture notes

- **One render loop.** All per-frame updates flow through `startRenderLoop` (`src/app/renderLoop.ts`); no system starts its own RAF loop.
- **Module per system.** Each era system (atmosphere, buildings, audio, vehicles, pedestrians, UI, …) lives in its own module, exposes a typed lifecycle (instantiate / attach / update / dispose), and owns colocated tests in a `__tests__` folder using Vitest + jsdom.
- **Composition root.** `src/main.ts` (rewritten by the polish task) wires the composed scene app (`createSceneApp`), the post-processing pipeline, and the automatic FPS tier controller together, and renders a quality/FPS HUD.
- **Procedural only.** All visual and audio assets are generated at runtime — canvas textures, geometry, WebAudio synthesis. Never add binary asset files or an asset-pipeline dependency.
- **No UI frameworks / no new runtime dependencies.** The runtime surface stays Three.js plus the toolchain; UI is DOM + CSS.
- **Strict TypeScript.** `npm run build` runs `tsc --noEmit` with the strict tsconfig before bundling; keep `noUnusedLocals` / `noUnusedParameters` clean.

## Frozen scaffold files

These files are owned by the scaffolding task. Later tasks must **not** re-create or rename them; the compose-scene-app task is the only task allowed to rewrite `src/main.ts` for application wiring (the polish task extends that wiring):

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
- Calls `update(deltaSeconds)` every frame with the elapsed time since the previous frame; the first frame's delta is `0`, deltas are clamped to non-negative values.
- `RenderLoopHandle.running` reports whether a frame is scheduled; `dispose()` cancels the pending frame, invokes `onDispose` exactly once, and is idempotent.

### Post-processing + quality — `src/fx/`

```ts
createPostProcessing(
  { scene, renderer },
  { onFpsSample?, onTierChange? },
  initialTier = 'high',
): PostProcessingHandle   // setQuality(), getTier(), getSettings(), light, update(), dispose()
createQualityController(post): { update(deltaSeconds): void, getTier(): 'low'|'medium'|'high' }
setQuality(tier)          // also exposed on the composed app (sceneApp applies pixel ratio)
```

- `createPostProcessing` returns a `PostProcessingHandle` that exposes `setQuality('low'|'medium'|'high'|'ultra')`, `getTier()`, `getSettings()`, the sun `light`, `isShadowMappingEnabled()`, `getBloomTargetCount()`, `update(deltaSeconds)`, and `dispose()`.
- `src/fx/qualityTiers.ts` exposes `QUALITY_TIERS`, `selectTierForFps()`, `LOW_FPS_THRESHOLD`, `HIGH_FPS_THRESHOLD`, `HYSTERESIS_FRAMES`, and tuning helpers.
- `src/fx/gradeShader.ts` renders the vignette canvas and exports the shared `GOLDEN_HOUR_GRADE`.

### Bootstrap — `src/main.ts`

```ts
bootstrap(mount: HTMLElement): { renderer, loop, fx, quality, setQuality(tier), dispose() }
```

Mounts the Three.js canvas into `#app`, wires the composed scene app + post-processing + automatic FPS tiers, handles viewport resize (`ResizeObserver` plus window resize), and starts the render loop. Falls back to a styled notice when WebGL is unavailable.

## Era-system architecture conventions

1. **One render loop.** All per-frame updates flow through `startRenderLoop` in `src/app/renderLoop.ts`; no system starts its own RAF loop.
2. **Module per system.** Each era system (atmosphere, buildings, audio, vehicles, pedestrians, UI, …) lives in its own module under `src/`, exposes a typed lifecycle (instantiate / attach / update / dispose) where relevant, and owns colocated tests in a `__tests__` folder using Vitest + jsdom.
3. **Procedural only.** All visual and audio assets are generated at runtime — canvas textures, geometry, WebAudio synthesis. Never add binary asset files or an asset-pipeline dependency.
4. **No UI frameworks / no new runtime dependencies.** The runtime surface stays Three.js plus the toolchain. UI is DOM + CSS.
5. **Frozen shared files.** Parallel tasks never edit the frozen scaffold files listed above; wiring is centralized in `bootstrap` / the compose-scene-app task.
6. **Strict TypeScript.** `npm run build` runs `tsc --noEmit` with the strict tsconfig before bundling; keep `noUnusedLocals` / `noUnusedParameters` clean.