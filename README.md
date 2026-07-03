# City Time Period Timelapse

A polished, high-end 3D scene of a single city block that transforms across
five decades — **1945 · 1965 · 1985 · 2005 · 2025** — at the touch of a
timeline slider. Every aspect of the block changes: building silhouettes,
vehicles, storefronts, advertisements, pedestrian outfits, and the audio
soundscape.

Built with **three.js** (WebGL), **TypeScript**, and the **Web Audio API**.
All assets are generated procedurally at runtime — no image, model, or audio
files are loaded.

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- A modern browser with WebGL 2 support (Chrome, Firefox, Edge, Safari)

### Install & Run

```bash
npm install      # install three.js + TypeScript
npm run build    # compile TypeScript → dist/
npm run dev      # serve on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

> **Audio note:** Browsers block audio until you interact with the page. Click
> or press any key once the scene loads to enable the soundscape.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` (type-checks with `tsc`) |
| `npm run typecheck` | Type-check only (no output) |
| `npm run dev` | Serve the project on `$PORT` (default 5173) with CORS |
| `npm run clean` | Remove the `dist/` directory |

---

## Controls

| Input | Action |
|-------|--------|
| **Drag** (mouse / touch) | Orbit the camera around the block |
| **Right-drag** | Pan the orbit target horizontally |
| **Scroll** / pinch | Zoom in and out |
| **Timeline slider** (top bar) | Switch eras — the scene crossfades smoothly |
| **C** key | Toggle between orbit and first-person walk mode |
| **WASD** / arrow keys | Move in walk mode |
| **Click** (in walk mode) | Engage pointer-lock mouse-look |
| **Esc** | Release pointer lock (return to drag-look) |
| **Click / keypress** | Resume audio (first interaction only) |

---

## How It Works

### Architecture

```
src/
├── main.ts                 # App bootstrap: renderer, camera, render loop
├── scene.ts                # SceneComposer: wires all subsystems together
├── eras/types.ts           # Era registry — declarative data for all 5 decades
├── assetBuilder/           # Procedural asset generators
│   ├── eras.ts             #   Asset-set aggregator + cache
│   ├── buildings.ts        #   Era-styled buildings (silhouettes, windows, roofs)
│   ├── vehicles.ts         #   Era-correct cars, trucks, EVs
│   ├── pedestrian.ts       #   Era-styled pedestrian models
│   ├── streets.ts          #   Roads, sidewalks, lamp posts, street furniture
│   ├── textures.ts         #   Procedural canvas textures (facades, ground)
│   └── util.ts             #   Shared cache, seeded RNG, colour & disposal helpers
├── blockLayout.ts          # City block lot layout generator
├── cityBlock.ts            # Block composition + collision boxes
├── traffic.ts              # Era-aware traffic system facade (spawn, drive, crossfade)
├── trafficSystem.ts        # TrafficSystem class — lane driving & era crossfade
├── pedestrians.ts          # Era-aware pedestrian system facade
├── pedestrianSystem.ts     # PedestrianSystem class — sidewalk spawning & walk animation
├── transitionController.ts # Smooth 1.4s crossfade across all layers
├── cameraController.ts     # Orbit + first-person walk camera
├── audio/
│   ├── sfx.ts              #   Procedural AudioBuffer synthesis (no files)
│   └── mixer.ts            #   Era-aware layered mixer with crossfade
├── hud/timeline.ts         # Top timeline slider HUD
└── renderPolicy.ts         # Adaptive render-rate gating
```

### Era Transitions

When you move the timeline slider, the `TransitionController` orchestrates a
smooth **1.4-second crossfade** (bounded under 1.5 s):

1. **Buildings** — the outgoing era's building group fades out while the
   incoming era's group fades in (opacity ramp on `MeshStandardMaterial`).
2. **Streets** — same opacity crossfade for road furniture.
3. **Lighting & sky** — ambient intensity, sun intensity, sky colour, and fog
   colour are linearly interpolated between era endpoints.
4. **Traffic** — old vehicles crossfade out while new-era vehicles fade in.
5. **Pedestrians** — same crossfade for pedestrian outfits.
6. **Audio** — the SFX mixer uses exponential gain ramps across ambient,
   traffic, event, and music layers (click-free).

All era assets are **pre-generated at startup** so every slider move is a
cache hit with no frame hitch.

---

## What to Expect Per Era

### 1945 — "War's End"

> The city stirs back to life as wartime rationing eases. Trolleys still clang
> down the avenue, Art Deco façades bear soot from coal furnaces, and
> pedestrians sport tailored suits and Victory-roll hair.

| Aspect | Details |
|--------|---------|
| **Buildings** | Art-Deco style, flat-parapet rooflines, steel-casement windows, 3–12 storeys, sooty warm palette, heavy grime |
| **Vehicles** | Sedans, coupes, wagons, roadsters; dark muted colours; sparse traffic (6 veh/lane/min); warm-yellow headlights |
| **Storefronts** | Diners, barbers, apothecaries, tailors, newsstands; hand-painted signs; awnings |
| **Advertisements** | Billboards, painted walls, neon signs; slogans like "Buy Bonds", "Lucky Strike" |
| **Pedestrians** | Zoot suits, sheath dresses, business suits; fedoras, pillbox hats; no phones |
| **Audio** | Warm reverberant drone, horse-clop traffic, trolley bells & church bells, big-band music bed |
| **Sky** | Sepia-toned warm haze |

### 1965 — "Mid-Century"

> Optimism hums through the block. Tail-fin cruisers idle at the light, neon
> signs buzz above chrome-trimmed diners, and office workers in narrow-lapel
> suits pour onto the sidewalks at noon.

| Aspect | Details |
|--------|---------|
| **Buildings** | Mid-century style, setback-pyramid rooflines, ribbon windows, 4–18 storeys, lighter grime |
| **Vehicles** | Sedans, coupes, wagons, pickups, roadsters; vivid colours (red, yellow, blue); busier traffic |
| **Storefronts** | Diners, department stores, record shops, drugstores; glowing neon signs |
| **Advertisements** | Animated neon signs; slogans like "See the USA", "It's the Real Thing" |
| **Pedestrians** | Business suits, mod-minis, bohemian looks; pillbox hats, headbands |
| **Audio** | Brighter drone, straight-six engine sounds, Motown music bed |
| **Sky** | Light optimistic blue |

### 1985 — "Neon Boom"

> Concrete towers and mirrored glass loom over a block awash in neon.
> Boom-boxes blare synth-pop, shoulder-padded power suits jostle past arcade
> marquees, and boxy sedans weave through heavy traffic.

| Aspect | Details |
|--------|---------|
| **Buildings** | Brutalist style, flat-parapet rooflines, punched windows, 6–30 storeys, concrete palette with neon accents |
| **Vehicles** | Sedans, coupes, wagons, hatchbacks, pickups; boxy shapes with neon accent colours; heavy traffic |
| **Storefronts** | Arcades, video rentals, sneaker stores, electronics; backlit-box signs |
| **Advertisements** | High-coverage animated ads; slogans like "Just Do It", "Where's the Beef?" |
| **Pedestrians** | Power suits, casual jeans, bohemian; neon colours; baseball caps, headbands |
| **Audio** | Tri-tone drone, small-block engine sounds, jackhammers & sirens, synthpop music bed |
| **Sky** | Purple-tinted haze |

### 2005 — "Dot-Com Glow"

> Glass curtain walls reflect the blue glow of early flat-screens. SUVs
> dominate the curb, flip-phones flip open on every corner, and big-box
> storefronts hum with fluorescent efficiency.

| Aspect | Details |
|--------|---------|
| **Buildings** | Postmodern style, crown rooflines, curtain-wall glass, 6–40 storeys, minimal grime |
| **Vehicles** | Sedans, coupes, hatchbacks, SUVs, pickups; peak traffic density (18 veh/lane/min) |
| **Storefronts** | Coffee shops, electronics, big-box, cellular stores, pharmacies; backlit-box signs; "Open 24 Hours" |
| **Advertisements** | LCD screens & backlit boxes; slogans like "Think Different", "Google It" |
| **Pedestrians** | Casual jeans, business suits, streetwear; flip-phones; beanies, baseball caps |
| **Audio** | Quieter drone, mixed-quiet traffic, notifications & bus-kneel, crunk music bed |
| **Sky** | Standard clear blue |

### 2025 — "Smart City"

> A quiet, electric streetscape. Glass towers wear living green roofs, silent
> EVs glide past bike lanes, pedestrians scroll smartphones under holographic
> ad projections, and delivery drones hum overhead.

| Aspect | Details |
|--------|---------|
| **Buildings** | Contemporary style, green roofs, floor-to-ceiling windows, 8–50 storeys, cleanest palette |
| **Vehicles** | Sedans, SUVs, hatchbacks, microcars, pickups; electric vehicles; cool LED headlights; quieter traffic |
| **Storefronts** | Cafes, micro-fulfillment, gyms, tech-repair, pop-ups; LED-strip signs; "Always Open" |
| **Advertisements** | LCD screens, holographic projections; slogans like "Sustainable Future", "AI for All" |
| **Pedestrians** | Streetwear, athleisure, casual jeans; smartphones; bike helmets |
| **Audio** | Quiet electric hum, drone-buzz events, notifications, hyperpop music bed |
| **Sky** | Pale clean blue |

---

## QA

See [`QA_REPORT.md`](./QA_REPORT.md) for the full end-to-end QA pass across
all five eras, including per-era verification tables, cross-era distinctiveness
checks, transition smoothness analysis, and console-error audit.

---

## Tech Stack

- **three.js** r185 — WebGL rendering, scene graph, shadows, tone mapping
- **TypeScript** 5.4 — strict mode, zero `any`
- **Web Audio API** — procedural buffer synthesis, layered mixer, exponential crossfade
- **Canvas 2D** — procedural texture generation (facades, ground, signage)
- No bundler — plain ES modules served statically (import maps resolve `three`)
