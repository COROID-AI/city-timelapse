# City Era Timelapse · 1945–2055

An interactive 3D city block that transforms across six eras — from postwar
rebuild (1945) to future vision (2055). Explore a single city block as
buildings morph, vehicles evolve, storefronts modernize, billboards light up,
and pedestrians change fashion before your eyes.

Built with **Three.js**, **TypeScript**, and **Vite**. All geometry is
procedurally generated; all audio is synthesized via the Web Audio API — no
external assets required.

---

## Quick Start

```bash
npm install
npm run dev      # start the dev server at http://localhost:5173
```

### Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Start the Vite dev server with HMR               |
| `npm run build`      | Type-check (`tsc --noEmit`) + production build   |
| `npm run typecheck`  | TypeScript type-checking only                    |
| `npm test`           | Run the Vitest test suite                        |
| `npm run preview`    | Preview the production build locally             |

---

## Controls

### Camera

| Action          | Input                          |
| --------------- | ------------------------------ |
| **Orbit**       | Left-click drag                |
| **Pan**         | Right-click drag               |
| **Zoom**        | Scroll wheel / pinch           |

The camera is constrained to keep the city block in frame at all times —
orbit distance, polar angle, and target position are all bounded.

### Camera Presets

Three viewpoint presets are selectable from the HUD (top-left panel):

| Preset         | Description                                      |
| -------------- | ------------------------------------------------ |
| **Overview**   | Wide aerial shot of the entire block             |
| **Street**     | Sidewalk-level view at pedestrian eye height     |
| **Rooftop**    | Elevated perch above the tallest buildings       |

Clicking a preset smoothly animates the camera to that viewpoint. Any manual
camera input (drag/pan/zoom) cancels the active animation.

### Era Timeline

The era selector bar at the bottom of the screen lets you jump between all six
eras. Each selection triggers a smooth ~1.5-second cross-fade transition where
every scene element — buildings, vehicles, storefronts, ads, pedestrians,
atmosphere, lighting, and road markings — interpolates to the new era.

### Audio

Ambient audio is **muted by default** (browser autoplay policy). Click the
**Sound** toggle (top-right) to enable a synthesized soundscape unique to each
era: traffic drones, crowd murmur, and era-typical accents (streetcar bells,
synth pads, EV chimes, drone buzz).

---

## Eras

The scene covers six eras, each with a fully distinct configuration:

| Era  | Label                    | Architecture               | Key Features                                   |
| ---- | ------------------------ | ------------------------- | ---------------------------------------------- |
| 1945 | Postwar rebuild          | Postwar masonry            | Streetcars, hand-painted signs, fedoras         |
| 1965 | Mid-century boom         | Mid-century modern         | Muscle cars, neon channel signs, mod fashion    |
| 1985 | Neon dawn                | Brutalist concrete + glass | Boxy sedans, backlit/arcade signs, power suits  |
| 2005 | —                        | Glass towers               | SUVs, LED billboards, athleisure                |
| 2025 | Present day              | Mixed-use eco-glass        | EVs, programmatic ads, tech wear                |
| 2055 | Future vision            | Bio-integrated megatower   | Autonomous pods, holographic ads, smart fabric  |

---

## Era Configuration Editing

All era-specific content is driven by a **single source of truth**:
[`src/eras/eraConfig.ts`](src/eras/eraConfig.ts). No module hardcodes era
identity or era-specific values — everything flows through the typed
`EraConfig` contract.

### The Config Structure

Each era is a key in `DEFAULT_ERA_CONFIG`, typed as `Record<EraKey, EraConfig>`:

```typescript
interface EraConfig {
  label: string;          // HUD display label
  buildings: BuildingStyle;    // heights, density, material palette
  vehicles: VehicleSet;        // vehicle archetype IDs
  storefronts: StorefrontSet;  // storefront archetype IDs
  ads: AdvertisementSet;       // billboard archetype IDs
  pedestrians: PedestrianOutfitSet; // outfit archetype IDs
  atmosphere: Atmosphere;      // sky, fog, sun, ambient, bloom
  sfx: SfxBed;                 // ambient track + accent IDs
  road: RoadAppearance;        // markings, signal intensity, surface
}
```

### Adding or Editing an Era

1. **Open** `src/eras/eraConfig.ts`.
2. **Era keys** are defined by the `ERA_KEYS` constant at the top of the file:
   ```typescript
   export const ERA_KEYS = ['1945', '1965', '1985', '2005', '2025', '2055'] as const;
   export type EraKey = (typeof ERA_KEYS)[number];
   ```
   To add a new era, add its string to this array. TypeScript will then
   require a matching entry in `DEFAULT_ERA_CONFIG`.
3. **Edit values** in the corresponding `DEFAULT_ERA_CONFIG[eraKey]` block.
   Every field is typed, so your editor provides autocomplete and the compiler
   catches missing fields.
4. **Downstream modules** read their per-era state from the config via
   `DEFAULT_ERA_CONFIG[era]`. Domain modules (buildings, vehicles, storefronts,
   ads, pedestrians, atmosphere, SFX, road) each map the config archetype IDs
   to their parametric geometry/material definitions.
5. **HUD labels** are derived automatically: `ERA_LABELS` is computed from
   `DEFAULT_ERA_CONFIG`, so the timeline and era label always stay in sync.
6. **Run the test suite** to verify: `npm test`. The era contract is covered
   by tests that validate all six eras have complete configurations.

### Key Design Principle: No Scene Rebuilds

Era transitions **never rebuild the scene graph**. Instead, the
[`TransitionManager`](src/eras/TransitionManager.ts) cross-fades every
registered domain by interpolating materials, geometry, and positions in place.
This keeps transitions smooth and allocation-free.

---

## HUD Components

The heads-up display (HUD) provides:

- **Era label** (top-left) — current era, synced to the timeline
- **Camera presets** (top-left) — overview / street / rooftop buttons
- **Control hints** (top-right) — orbit / pan / zoom reminders
- **Audio toggle** (top-right) — mute/unmute synthesized SFX
- **Minimap** (bottom-right) — top-down radar showing the block, roads,
  building lots, and active agents (vehicles, pedestrians, cyclists, dogs)
- **Performance overlay** (bottom-left) — live FPS (color-coded: green ≥55,
  amber 30–54, red <30), draw-call count, triangle count, and agent caps

The minimap and performance overlay are hidden on mobile screens (<640px) to
avoid occlusion.

---

## Performance

### Targets

- **≥30 FPS required** (performance floor)
- **60 FPS target** on mid-range hardware

### Strategy

Performance is maintained through **capping agents and using instancing**,
never by reducing required detail:

- **Agent caps**: Each agent system (vehicles, pedestrians, cyclists, dogs) has
  a population ceiling enforced at spawn time. Caps accommodate two concurrent
  populations during era cross-fades.
- **InstancedMesh**: Cyclists and dogs use `InstancedMesh` for batched draws.
- **Shared materials**: Per-era materials are shared across all instances of a
  type, minimizing state changes.
- **Throttled HUD updates**: The minimap refreshes every ~120ms and the
  performance overlay every ~250ms, not every frame.
- **renderer.info monitoring**: The `PerformanceProfiler` reads
  `renderer.info.render.calls` and `renderer.info.render.triangles` every frame
  so draw-call and triangle counts are always visible.

### Agent Population Caps

| Agent type  | Steady-state cap |
| ----------- | ---------------- |
| Vehicles    | 6 per era        |
| Pedestrians | 12               |
| Cyclists    | 5                |
| Dogs        | 3                |

These caps are documented in `src/hud/PerformanceProfiler.ts` (`ERA_AGENT_CAPS`)
and surfaced in the performance overlay HUD.

---

## Architecture

```
src/
├── main.ts                      # Bootstrap: renderer, scene, render loop, wiring
├── constants.ts                 # Block footprint + navigation bounds
├── navigation.ts                # Orbit-controls framing clamp
├── timeline.ts                  # Era selector UI
├── style.css                    # HUD + timeline + overlay styles
├── eras/
│   ├── eraConfig.ts             # ★ Single source of era truth
│   └── TransitionManager.ts     # Cross-fade engine (no scene rebuilds)
├── camera/
│   └── CameraPresets.ts         # Overview/street/rooftop tween controller
├── world/
│   ├── BlockLayout.ts           # Roads, curbs, sidewalks, markings, signals
│   └── roadNetwork.ts           # Pure-data lane graph for agents
├── buildings/
│   └── BuildingGenerator.ts     # Parametric era-detailed buildings
├── storefronts/
│   └── StorefrontModule.ts      # Ground-floor shops + signage
├── ads/
│   └── BillboardModule.ts       # Era-specific billboards/ads
├── vehicles/
│   └── VehicleSystem.ts         # Traffic with signal obedience + queueing
├── peds/
│   └── PedestrianSystem.ts      # Walking humanoids with crosswalk logic
├── agents/
│   ├── CyclistSystem.ts         # Instanced bikes/e-bikes/scooters
│   └── DogSystem.ts             # Instanced dogs with trot gait
├── atmosphere/
│   └── AtmosphereSystem.ts      # Sky, fog, sun, ambient, bloom per era
├── audio/
│   └── SfxSystem.ts             # Synthesized ambient beds + cues
├── postprocessing.ts            # EffectComposer + UnrealBloom
└── hud/
    ├── Minimap.ts               # Top-down block radar
    └── PerformanceProfiler.ts   # FPS/draw-call/triangle monitor
```

### Cross-Project Coordination

This project coordinates with **p5-atmosphere-sfx** via the shared
`EraConfig` and `TransitionManager` contracts. Atmosphere and SFX logic is not
duplicated — each project implements its domain against the shared era contract.

---

## License

MIT
