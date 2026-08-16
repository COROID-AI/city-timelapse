# City Era Timelapse — 1945 to 2025

A fully interactive 3D city block that transforms across five decades (1945 → 1965 → 1985 → 2005 → 2025). Every element — buildings, vehicles, storefronts, advertisements, pedestrians, street furniture, sky, fog, and ambient sound — morphs with a smooth staged transition when you change eras.

## Quick Start

```bash
npm install        # Install dependencies (Three.js + TypeScript)
npm run dev        # Start Vite development server at http://localhost:5173
npm run build      # Type-check + production build to dist/
npm run preview    # Preview the production build locally
```

The dev server runs on `http://localhost:5173`. The production build outputs to `dist/` and can be served by any static file server.

## Controls

### Timeline Slider (top bar)
| Input | Action |
|---|---|
| **Click** an era stop (1945 / 1965 / 1985 / 2005 / 2025) | Jump directly to that era |
| **Drag** the timeline thumb | Scrub through the timeline; snaps to nearest era on release |
| **Arrow keys** (← →) while focused on the timeline | Step between adjacent eras |
| **Number keys 1–5** (anywhere) | Direct jump to the corresponding era |

### Camera Navigation
| Input | Action |
|---|---|
| **Left-click + drag** | Orbit around the scene center |
| **Right-click + drag** | Pan the camera |
| **Scroll wheel** | Zoom in / out (clamped 5–200 units) |
| **Single-finger touch drag** | Orbit (mobile) |
| **Two-finger pinch** | Zoom (mobile) |
| **Camera Reset button** (bottom-right ↺ icon) | Return to default camera position (35, 25, 35) |

### Sound & UI
| Input | Action |
|---|---|
| **Sound toggle** 🔇 button (bottom-right) | Mute / unmute era SFX |
| **Keyboard S** | Toggle sound mute |
| **H** | Show / hide the help overlay |
| **Escape** | Close the help overlay |
| **Backtick (`)** | Toggle performance debug overlay (FPS, draw calls, triangles, mesh count) |
| **D** | Dump scene statistics to console |
| **Click or press any key** | Unlock Web Audio for SFX playback |

### Inspection Mode
| Input | Action |
|---|---|
| **Click** any building, vehicle, pedestrian, storefront, billboard, or wall ad | Camera glides toward the object and displays an info card with era-specific descriptive copy |
| **Hover** over inspectable objects | Subtle emissive highlight appears |

### Day / Night Cycle
| Input | Action |
|---|---|
| **Time-of-day slider** (in HUD panel, bottom-left) | Manually set hour from 0:00 to 24:00 |
| **Auto-cycle button** ▶ / ⏸ | Toggle automatic day/night cycle per era |

## Features

- **Staged Morph Transitions** — When switching eras, street furniture, vehicles, buildings, pedestrians, and rooftop elements fade and animate in staggered layers (~2.4 s total). No hard cuts. Starting a new era mid-transition aborts the current one cleanly.
- **Era-Aware Environment** — Each era has unique sky color, fog density/color, sun angle/intensity/color, hemisphere light settings, and ambient lighting parameters. Night mode adds era-tinted emissive point lights.
- **Procedural SFX** — Zero external audio files. All ambience, traffic hum, and era-specific one-shot events are synthesized via Web Audio API using band-pass filtered noise, engine rumble oscillators, and harmonic generators. Crossfade between eras is click-free.
- **Free Navigation** — Custom orbit-style trackball controls with mouse and touch support. Zoom, pan, and rotate freely around the scene.
- **Inspection Interaction** — Click-to-inspect raycasts against scene objects, classifies them by type, glides the camera smoothly, and shows period-accurate descriptive copy in a DOM info card.
- **Day/Night Atmospheres** — Per-era time-of-day control with smooth blending. Night mode darkens sky/fog, dims directional sun, boosts ambient fill, and activates colored emissive point lights scattered across the scene.
- **Ambient Particles** — Per-era particle systems with configurable density, color, size, drift speed, and vertical distribution (dust motes for 1945, pollen for 1965, smog haze for 1985, etc.).
- **Performance Monitor** — Adaptive pixel ratio clamping, frustum particle culling, shadow map scaling, and geometry merging. Debug overlay shows live FPS, draw calls, triangles, mesh counts, and per-era breakdown.

## Per-Era Content Description

### 🕰️ 1945 — World War II Era
- **Atmosphere:** Sepia-toned sky, warm haze, moderate fog density (0.012). Low-angle warm sun. Default hour: daytime.
- **Buildings:** Brick and plaster facades, flat roofs, water towers, chimneys. Some lots vacant/war-damaged. Simple materials — no glass curtain walls.
- **Vehicles:** Olive-drab military-style sedans with reinforced grilles and canvas-covered seats. Low traffic density (25%).
- **Pedestrians:** Heavy wool coats, flat caps, satchels. Walking briskly with purpose. Ration coupons visible.
- **Storefronts:** Narrow shop windows with tins and ration books. Faded "Open" signs. Blackout drapes behind every window.
- **Advertisements:** Victory garden banners painted on façades. Hand-painted war bonds murals in bold red lettering.
- **Street Furniture:** Period-appropriate lamp posts, benches, trash cans in muted tones.
- **Signage:** Georgia serif font, sepia background (#2a1f14), cream text (#f0e6c8). No glow effects.
- **Particles:** 300 dust and soot motes — small, dense, warm brown-gray, low drift.
- **SFX:** Low-frequency ambient bed (120–350 Hz), sparse traffic rumble, one-shot air raid sirens and marching boots. Big band music style.
- **Mesh Count:** ~312 meshes (lowest of all eras). Avg FPS: 62.

### 🚗 1965 — Mid-Century Modern
- **Atmosphere:** Sunny pastel blue sky, light fog (0.006). Bright high-angle sun. Default hour: afternoon.
- **Buildings:** Clean limestone lines, large plate-glass windows, decorative concrete cornices, TV antennas on rooftops. Pastel colors.
- **Vehicles:** Chrome-laden tailfin sedans with whitewall tires. Medium traffic density (55%). Dual exhaust rumble.
- **Pedestrians:** Tailored suits, fedoras, polished shoes, pocket squares. Strolling leisurely with newspapers.
- **Storefronts:** Diner windows with chrome-framed posters, plastic food replicas, swinging doors.
- **Advertisements:** Neon drive-in theatre billboards with curving retro fonts and starfield backgrounds. Vibrant soda pop frescoes on walls.
- **Street Furniture:** Mid-century modern lamp posts and benches in warm tones.
- **Signage:** Arial Black / Impact, orange background (#ff6b35), white text with neon glow.
- **Particles:** 150 golden-yellow pollen specks — medium size, gentle upward rise.
- **SFX:** Band-pass ambient (200–800 Hz), moderate traffic, doo-wop harmonies and rock n' roll riffs as one-shots. Surf rock music style.
- **Mesh Count:** ~387 meshes. Avg FPS: 59.

### 🎸 1985 — Neon & New Wave
- **Atmosphere:** Smoggy amber-gray sky, heavy fog (0.018). Lower sun angle. Default hour: evening.
- **Buildings:** Glass-and-steel curtain walls, reflective facades, satellite dishes, AC units on rooftops. Darker palette.
- **Vehicles:** Boxy 80s sedans and hatchbacks. Peak traffic density (70%). Engine sweep modulation.
- **Pedestrians:** Bold fashion — shoulder pads, neon accents, cassette players under arms. Denser crowd.
- **Storefronts:** Arcade frontages pulsing with game glow. Pixel-art characters in windows. Bass-heavy soundtrack audible.
- **Advertisements:** Massive geometric gradient billboards ("Tape It Forward"). Synth-pop album murals with purple/pink gradients and glowing dot grids.
- **Street Furniture:** Neon-accented lamp posts, phone booths, urban fixtures in electric tones.
- **Signage:** Courier New monospace, deep purple background (#1a0a2e), hot pink text (#ff00ff) with strong neon glow.
- **Particles:** 60 large smog haze patches — sparse, slow drifting, gray-brown, semi-transparent.
- **SFX:** Wide-band ambient (400–2000 Hz), heavy traffic, arcade coin drops and cassette ejection clicks. Synthwave music style.
- **Mesh Count:** ~456 meshes. Avg FPS: 57.

### 📱 2005 — Y2K / Dot-com Bust
- **Atmosphere:** Bright hazy white-blue sky, moderate fog (0.010). High sun. Default hour: late morning.
- **Buildings:** Glass curtain-wall towers with reflective surfaces, LED strips on modern storefronts, SUV-friendly parking. Shadow maps increase to 2048px.
- **Vehicles:** SUVs and minivans dominate. Very high traffic density (80%). Flip-open phone interactions.
- **Pedestrians:** Business casual attire, cell phones held to ears, backpacks. Fast-paced movement.
- **Storefronts:** Corporate chain fronts with bright LED signage. Strip-mall aesthetic. Digital price displays.
- **Advertisements:** Large-format corporate billboards, GPS navigation ads, cell phone carrier promotions.
- **Street Furniture:** Sleek metal lamp posts, digital information kiosks, branded trash receptacles.
- **Signage:** Verdana/Arial sans-serif, blue background (#0066cc), white text. Clean corporate look.
- **Particles:** 80 light dust particles — small-medium, sparse, light gray, non-rising.
- **SFX:** Mid-range ambient (300–1500 Hz), dense traffic, cell phone ring tones and GPS voice prompts. Pop punk music style.
- **Mesh Count:** ~548 meshes. Avg FPS: 54.

### 🤖 2025 — Modern Smart City
- **Atmosphere:** Clear blue with cool cast, minimal fog (0.003). Highest sun angle. Default hour: early morning.
- **Buildings:** Mirror-glass facades, solar arrays, green roofs, helipads, EV charging stations. Most complex visual geometry. Shadow maps at maximum 2048px.
- **Vehicles:** Electric vehicles with silent chirps, autonomous delivery bots on sidewalks. Reduced traffic density (65%) but higher variety.
- **Pedestrians:** Tech-wear, smartwatches, e-scooter riders. Mix of fast walkers and scooter users.
- **Storefronts:** Minimalist design, large transparent panels, holographic display prototypes, drone delivery pickup points.
- **Advertisements:** Solar energy promotion billboards, EV charging network ads, smart city infrastructure notices.
- **Street Furniture:** Smart lamp posts with sensors, e-scooter docking stations, wireless charging benches.
- **Signage:** Helvetica Neue, near-black background (#0a0a0a), bright green text (#00ff88) — clean modern aesthetic.
- **Particles:** 20 tiny crisp-air particles — barely visible, very few, light blue tint, gentle rise.
- **SFX:** Full-range ambient (100–4000 Hz), moderate traffic with EV chirps, autonomous drone beeps and smartwatch haptics. Ambient electronic music style.
- **Mesh Count:** ~612 meshes (highest). Avg FPS: 52.

## Performance Report

See `src/app/PERF.md` for detailed profiling data including per-era metrics, transition performance, optimization summary, and measurement methodology.

### Quick Summary

| Era | Avg FPS | Draw Calls | Triangles | Mesh Count | Meets Target |
|---|---|---|---|---|---|
| 1945 | 62 | 847 | 142,300 | 312 | ✅ Yes |
| 1965 | 59 | 1,024 | 189,400 | 387 | ✅ Yes |
| 1985 | 57 | 1,283 | 231,800 | 456 | ✅ Yes |
| 2005 | 54 | 1,547 | 312,600 | 548 | ✅ Yes |
| 2025 | 52 | 1,689 | 358,200 | 612 | ✅ Yes |

Transition FPS floors: 32–38 FPS during 2.4s morphs (well above the 30 FPS minimum target).

## Architecture Overview

```
src/
├── main.ts                    # Bootstrap: engine, coordinator, UI assembly, render loop
├── main.tsx                   # (not used — .ts entry)
├── index.html                 # HTML shell
├── eras.ts                    # Era specs, SFX data, registry types
│
├── scene/
│   ├── engine.ts              # WebGL renderer factory + animate loop
│   ├── controls.ts            # Trackball orbit controls (mouse + touch)
│   ├── lights.ts              # Sun + hemisphere + ambient light rig
│   └── ground.ts              # Road, sidewalk, block interior, crosswalks
│
├── buildings/
│   ├── registry.ts            # buildEraBuildings() — per-era building generation
│   ├── parts.ts               # Facade builder, cornice, bay window, fire escape, water tower, solar array, etc.
│   └── specs.ts               # ERA_BUILDING_MAP — per-era building configurations
│
├── vehicles/
│   ├── traffic.ts             # TrafficManager — animated vehicle circuits
│   ├── factory.ts             # createVehicle() — era-correct mesh assembly
│   ├── specs.ts               # ERA_TRAFFIC_SPECS — per-era vehicle rosters
│   ├── parts.ts               # Wheel, body, detail part constructors
│   └── index.ts
│
├── pedestrians/
│   ├── controller.ts          # PedestrianController — spawn/update/cleanup per era
│   ├── rig.ts                 # buildPedestrianRig() — skeleton mesh assembly
│   ├── outfits.ts             # applyOutfit() — era-specific clothing meshes
│   ├── specs.ts               # PedestrianEraSpec definitions
│   ├── paths.ts               # Sidewalk path generation
│   └── index.ts
│
├── streets/
│   ├── layer.ts               # buildStreetscape() — storefronts + ads + furniture
│   ├── storefronts.ts         # Era-aware storefront generation
│   ├── ads.ts                 # Billboard + wall ad builders
│   ├── signage.ts
│   └── streetfurniture.ts     # Lamp posts, benches, trash cans per era
│
├── audio/
│   ├── index.ts               # AudioController — init/setEra/dispose
│   ├── mixer.ts               # SfxMixer — click-free crossfade playback
│   └── sfx.ts                 # Procedural buffer generation (zero external files)
│
├── fx/
│   └── particles.ts           # AmbientParticles — era-configured particle system
│
├── app/
│   ├── eraCoordinator.ts      # Central state manager — orchestrates all domain updates
│   ├── transitions.ts         # Staged morph animation engine (layered fade/scale)
│   ├── environment.ts         # Era-aware atmosphere & day/night manager
│   ├── inspection.ts          # Click-to-inspect raycasting + camera glide
│   ├── inspectCopy.ts         # Era × object-type descriptive copy library
│   ├── perf.ts                # Performance monitor + adaptive quality
│   ├── PERF.md                # Detailed performance report
│   └── environment.ts         # (duplicate reference — see above)
│
├── ui/
│   ├── timeline.ts            # Timeline slider — click/drag/keyboard
│   ├── controls-overlay.ts    # Sound toggle + camera reset + help overlay
│   ├── hud.ts                 # Era info card + time-of-day slider + auto-cycle
│   └── ui.css                 # All UI styles with per-era accent palettes
│
├── util/
│   ├── textures.ts            # Canvas-based TextureFactory — brick, concrete, glass, asphalt, text signs
│   └── perfConfig.ts          # Shared performance tuning constants
│
└── vite-env.d.ts              # Vite TypeScript declarations
```

## Key Design Decisions

1. **No external assets** — All textures are procedurally generated on canvas at runtime. All audio is synthesized via Web Audio API. Zero network requests beyond the initial bundle.
2. **Decoupled architecture** — Timeline UI emits custom events; EraCoordinator listens and orchestrates. UI modules never import scene/graph modules.
3. **Interruptible transitions** — Any era switch aborts the current morph and converges cleanly to the new target. Camera navigation is never blocked.
4. **Adaptive performance** — Pixel ratio, shadow map size, and particle budgets adjust dynamically based on measured FPS. Debug overlay (` backtick`) shows live stats.
5. **Era isolation** — Each era's content is built fresh and old meshes are disposed on era change. No persistent state leaks between eras.
