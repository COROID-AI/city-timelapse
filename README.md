# City Era Timelapse — 1945 → 2025

A self-contained, procedural **Three.js** city block that morphs through five decades
in front of your eyes. Pick a year on the timeline at the top of the screen and the
whole scene — buildings, vehicles, storefronts, advertisements, lighting, sky and
soundscape — crossfades to that era. Everything is generated in code: procedural
geometry, `CanvasTexture` signage and fully synthesized Web Audio SFX, so the app
ships with zero external binary assets.

## The era timelapse feature

- **Five timeline stops** — 1945, 1965, 1985, 2005, 2025 — rendered as clickable
  era chips above a slider rail with a per-era accent color that retints the UI.
- **~2 second eased crossfade** between eras (shortened to 0.4 s automatically
  under `prefers-reduced-motion: reduce`), with deterministic endpoints: the
  outgoing era fades out in place while the incoming era fades in.
- **Era-aware soundscape** — four synthesized audio layers (ambient bed, traffic
  loop, event one-shots, period music) crossfade over a 1.5 s exponential-ramp
  window. Audio starts only after the first user gesture (browser autoplay
  policy); visuals run regardless.
- **Post-processing** — emissive-only bloom, a gentle vignette and FXAA via the
  three.js `EffectComposer`, with an automatic fallback to direct rendering if
  the composer cannot load or fails at runtime.
- **Adaptive quality** — a quality manager watches frame times in rolling 2 s
  windows and steps device pixel ratio / shadow detail between `high`,
  `medium` and `low` to hold framerate (with hysteresis so it never oscillates).
- **Free navigation** — damped orbit controls with zoom and ground-plane panning.

## Timeline stops

| Year | Label | What you'll see | What you'll hear |
| ---- | ----------------- | --------------------------------------------------------------- | -------------------------------------------- |
| 1945 | Post-War Rebuild  | Brick rowhouses, victory gardens and gas lamps; sparse vintage traffic | Distant church/tram bells, sparse combustion engines, big-band swing |
| 1965 | Mid-Century Boom  | Pastel storefronts, chrome cruisers and buzzing neon signs       | Car horns and tram bells, busier streets, surf rock |
| 1985 | Neon Decade       | Concrete towers, boxy sedans and sodium haze washed in bright arcade neon | Sirens and horns in heavy gridlock, neon buzz, synthwave |
| 2005 | Digital Age       | Glass curtain walls, SUV convoys and early LED billboards        | Air horns and digital chimes, dense traffic, pop rock |
| 2025 | Electric Present  | EV fleets, LED media facades and sensor-lit streets              | Soft EV chimes, electric drivetrain whine, ambient electronica |

## Navigation controls

- **Timeline**: click any era chip, or focus the slider thumb and use
  `←` / `→` to move stop-by-stop, `Home` / `End` to jump, and `Enter` / `Space`
  to commit (the slider is a WAI-ARIA slider with a polite live region).
- **Camera**: left-drag to orbit, scroll (or pinch) to zoom, right-drag to pan
  across the ground plane. Distance, polar angle and pan extent are clamped so
  the city block always stays framed.
- **Audio**: the first click, tap or keypress anywhere resumes the
  `AudioContext` and starts the era soundscape (autoplay-policy safe).

## Architecture overview

```
src/
├── main.ts               Composition root: renderer, SceneDirector, PostFX,
│                         QualityManager, render loop, resize, audio gesture
├── eras.ts               Shared EraId/EraSpec types, ERA_REGISTRY, SFX_ERA_DATA
├── eras/
│   ├── index.ts          ERA_MANIFEST: per-era group builder lookup
│   └── 1945.ts … 2025.ts Procedural era scene builders + per-frame updates
├── audio/
│   ├── sfx.ts            Procedural AudioBuffer synthesis (noise beds, drones,
│   │                     traffic, one-shot events) — no external files
│   └── mixer.ts          Era-aware crossfade mixer (ambient/traffic/events/music)
├── scene/
│   ├── director.ts       Renderer/scene/camera lifecycle, lazy era groups,
│   │                     era hand-off order, render loop
│   ├── transition.ts     Eased crossfade choreography between era groups
│   ├── postfx.ts         Bloom + vignette + FXAA composer, direct-render fallback
│   └── quality.ts        Adaptive pixel-ratio / shadow quality manager
├── environment/
│   └── profiles.ts       Per-era sky, fog and light-rig profiles
├── controls/
│   └── camera.ts         Orbit camera constraints and damping
└── ui/
    └── timeline.ts       Keyboard-accessible timeline slider component
tests/                    Vitest suite (eras, audio, scene, UI, environment)
```

**Wiring in `src/main.ts`** (the only file that composes subsystems):

1. `createSceneDirector(container)` instantiates the WebGL renderer, primary
   scene, camera and orbit controls, builds the initial era group, mounts the
   timeline slider and registers the first-gesture audio unlock.
2. `createPostFX(renderer, scene, camera)` attaches the composer chain; the
   entry routes the director's per-frame draw call through it and restores the
   native render on teardown.
3. `QualityManager` samples frame deltas and applies pixel-ratio / shadow
   settings whenever the adaptive level changes.
4. Window resize keeps the renderer (director) and composer targets in sync.
5. `director.start()` runs the render loop: era ticks → transition update →
   PostFX-composited render → quality sampling.

## Automation & evidence-probe hooks

The app publishes stable, machine-readable affordances so browser smoke runs
(and any Playwright-style probe) can drive interactions and wait for settled
frames instead of guessing:

| Hook | Where | Meaning |
| ---- | ----- | ------- |
| `#app[data-app-ready="true"]` | mount container | bootstrap + render loop are up |
| `#app[data-era="<year>"]` | mount container | committed era id (`1945`…`2025`) |
| `#app[data-era-transitioning]` | mount container | `"true"` during a crossfade, `"false"` at deterministic endpoints — screenshot when it reads `false` |
| `[data-testid="city-canvas"]` | renderer canvas | interactive viewport (role `application`, labelled) for orbit/zoom/pan drags |
| `[data-testid="era-stop-<year>"]` | timeline chips | click to commit an era |
| `[data-testid="era-timeline-thumb"]` | `<input type="range">` | WAI-ARIA slider; `fill()`/arrow keys step eras |
| `[data-testid="era-timeline"][data-era-active="<year>"]` | timeline root | committed era mirrored on the UI |
| `[data-testid="era-caption-year"]` / `era-caption-label` | caption | active-era caption text |
| `[data-testid="controls-hint"]` | bottom hint | navigation help copy |

## Commands

```bash
npm install        # install dependencies

npm run dev        # Vite dev server with HMR
npm run build      # type-check (tsc --noEmit) + production build (vite build)
npm run preview    # serve the production build locally

npm test           # run the full Vitest suite once
npm run test:watch # run Vitest in watch mode
npm run typecheck  # TypeScript check only
```

## Implementation notes

- **WebGL2 required** — the entry checks for a WebGL2 context up front and
  shows a styled fallback message otherwise.
- **No external assets** — all geometry, textures (including billboard text and
  window grids) and audio are generated procedurally at runtime.
- **Autoplay policy** — the mixer is constructed and resumed on the first user
  gesture; before that the scene is simply silent.
- **Reduced motion** — `prefers-reduced-motion: reduce` shortens era
  transitions to 0.4 s.
- **Graceful degradation** — if the post-processing modules fail to load or a
  composer call throws, rendering falls back to direct `renderer.render()`
  with a single console warning; the scene keeps running.
