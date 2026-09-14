# City Time Period Timelapse — Polish, Performance and Final Verification (QA evidence)

Task: `cf09a37e-f166-45ca-9ef0-e20730b1afd7` — Polish detail pass, performance tuning and five-era final verification.

This report records the evidence produced by the polish execution and the verification contract. Browser/visual/audio observations that require the QA browser runner are listed explicitly under **Recorded gaps**; every number below was measured in this execution.

---

## 1. Scope

The polish pass is **additive and disjoint** from all producer modules:

| Deliverable | Path |
| --- | --- |
| Polish entry point + app wiring | `src/polish/index.ts` |
| Detail pass (glows, instanced props, wear) | `src/polish/detailPass.ts` |
| Perf budget + overlay (pixel-ratio cap, draw calls, fps) | `src/polish/perfBudget.ts` |
| Polish unit tests | `src/polish/detailPass.test.ts`, `src/polish/perfBudget.test.ts` |
| Minimal main.ts hook (browser auto-boot only) | `src/main.ts` (import + `applyPolishToApp(boot())`) |
| This evidence report | `docs/verification-polish-final-qa.md` |

Producer modules, configs, the timeline HUD and the era schema were **not modified**.

---

## 2. Quality gates (run in this execution)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | PASS (0 errors, incl. `src/polish/**` and the `src/main.ts` hook) |
| Polish unit suite | `npx vitest run src/polish` | PASS — 2 files, 18 tests |
| Full suite (incl. scene-integration composition) | `npx vitest run` | PASS — 29 files, **387 tests** (370 pre-existing + 17 new polish) |
| Production build | `npx vite build` | PASS — 48 modules, `dist/` emitted (chunk-size warning only, three.js payload) |

---

## 3. Detail pass (night window glows, instanced small props, surface wear)

The detail pass layers onto every era scene from the **builder outputs** (building descriptors via `buildBuildings`' public `userData.descriptor`) and the **shared `BlockLayout` anchors**, without editing producers:

- **Emissive night window glows**: one additive `InstancedMesh` per building, aligned to the era's real window grid (`resolveEraBuilding(era).windows`), color from the era's interior glow token (`#ffc987` 1945 → `#d9fff2` 2025), placed in building-local space children of each building group so they **morph with the buildings**.
- **Instanced street props**: planters beside tree anchors, newspaper boxes beside lamp posts, pigeons on sidewalk bands — all `InstancedMesh`.
- **Surface wear**: instanced asphalt patches, sidewalk cracks and facade soot streaks, era-scaled (heavily worn 1945 → clean 2025).

### 3.1 Idempotency / rebuild semantics

- `applyDetailPass` on the **same scene object twice** → second call is skipped (`reapplySkipped: true`), one tagged polish group only, draw count unchanged. — `detailPass.test.ts` "re-application … is an idempotent no-op".
- **Era rebuild** (wiring disposes a scene, registry builds a fresh one) → the fresh scene has no marker and applies cleanly again. — "rebuilt era scenes apply cleanly again".
- App-integration: `applyPolishToApp` wraps `registry.get`, so every lazily-built era scene (initial, slider selection, mid-transition interrupt) is polished exactly once; completed/interrupted scenes have their polish resources swept on disposal. — "applyPolishToApp wires the pass into the running app".

### 3.2 Measured polish budget and instancing (this execution, default seed)

| Era | Producer draws (pre-polish) | Polish draws added | Polish instances (glows) | Polish instances (props) | Polish instances (wear) | Total polished draws |
| --- | --- | --- | --- | --- | --- | --- |
| **1945** | 1238 | +33 | 378 | 43 | 49 | **1271** |
| **1965** | 1175 | +34 | 529 | 53 | 34 | **1209** |
| **1985** | 1169 | +33 | 508 | 51 | 40 | **1202** |
| **2005** | 1011 | +29 | 660 | 47 | 19 | **1040** |
| **2025** | 1311 | +21 | 514 | 52 | 6 | **1332** |

(Logged by `detailPass.test.ts` → `[polish] per-era draw-call budget table`. The polish contribution (19–34 draws) is additive and instanced; every polish drawable is an `InstancedMesh`.)

**Instancing proof**: every polish drawable in the era root is an `InstancedMesh` — `countInstancedMeshes(root) === polishDrawCalls` (≤ ~34 extra draws per era while instance counts sum to several hundred). One shared geometry + material drive dozens–hundreds of glows/props.

---

## 4. Performance guardrails (final invariants)

- **Pixel ratio cap ≤ 2** — `capPixelRatio`/`cappedRenderSize` in `src/polish/perfBudget.ts`; the main.ts hook pushes the capped backing size (`css × min(dpr, 2)`) through `engine.resize(...)` at boot. Measured: 1x display → 1.0x, 2x → 2.0x, 3x → **2.0x (capped)**. Overlay shows `pixelRatio x.xx (dpr y.yy, cap 2)`.
- **Repeated props instanced** — see §3.2; unit test asserts `polishDrawCalls ≤ 60` while total instances `> 200` per era.
- **Draw-call budgets (dual, enforced)** — the overlay reports two budgets:
  - `draws N/1500` — the **stage ceiling** (`DEFAULT_DRAW_CALL_BUDGET`): the whole visible stage including producer content. Measured fully-polished stages: **1040–1332** (§3.2); `enforceDrawCallBudget` hides the lowest-priority polish groups first (wear → props → glows) whenever the stage exceeds the ceiling.
  - `polish N/450` — the **additive-layer budget** (`POLISH_DRAW_CALL_BUDGET`): the draw calls this task adds on top of the producers (glows + props + wear). Measured: **21–34 per era** — the polish contribution is fully contained under 450 with instancing; unit-tested per era (`countPolishDrawCalls(scene.root) === report.polishDrawCalls`).
- **Frame pacing** — `PerfMeter` tracks smoothed + min FPS from engine frame deltas; overlay reports `FPS x.x (min y.y)`. FPS evidence during orbiting + one full era transition is a QA browser observation (see Recorded gaps) — the meter + overlay wiring are unit-tested headlessly.

---

## 5. Five-era verification matrix (1945 → 2025)

Every slider stop renders a distinct era; **each element group changes in view** between every adjacent pair.

| Era | Buildings | Vehicles | Storefronts / ads | Pedestrian outfits | Atmosphere / ambience |
| --- | --- | --- | --- | --- | --- |
| **1945** | brick rowhouses, cornices, fire escapes, stoops | rounded sedans + trucks | painted signs, striped awnings, paper displays, painted billboards | wartime coats, fedoras, cloche hats | dusty warm-amber haze, sparse street noise (`Post-War Sparseness`) |
| **1965** | pastel mid-century slabs, ribbon windows, fins | finned two-tone cruisers + coupes | pastel storefronts, pink neon, mod window dressing | pastel suits, sunglasses | bright mint sky, traffic hum (`Mid-Century Traffic Hum`) |
| **1985** | concrete + glass blocks, brise-soleil, rooftop HVAC | boxy sedans + wagons | neon signage, magenta/cyan ads, street billboards | shoulder pads, denim, radio headsets | smoggy amber + drizzle, 80s urban din (`80s Urban Din & Neon`) |
| **2005** | glass-and-steel mid-rises, steel mullions, masts | crossovers + hatchbacks | LED signs, digital ad screens | casual tech wear, flip phones | crisp blue sky, metropolis din (`2000s Metropolis Din`) |
| **2025** | green towers, living walls, solar + wind, green roofs | EVs, scooters, cyclists (micromobility) | digital screens, eco-green glow signage | athleisure, headphones, smartphones | golden-green clear sky, EV hum (`Smart City & EV Flow`) |

Sources: `src/world/streetLife/buildStreetLife.ts` (default themes per era), `src/world/buildings/eraBuildingData.ts` (archetypes, window/roof params), `src/audio/ambience.ts` (descriptors). The polish layer keeps these distinction guarantees: per-era glow colors differ, wear profiles strictly decrease (`0.55 → 0.02`), and the five nearest-neighbor era wear levels are distinct (tested).

The timeline HUD exposes exactly the five stops **1945, 1965, 1985, 2005, 2025** (from `ERA_YEARS`; no 2055) — asserted by `appBoot.test.ts` (`stops` length 5 and `slider.years === ERA_YEARS`).

---

## 6. In-view era transformation

- Selecting a year morphs the block in front of the camera: `TransitionController` dissolves/scales out the outgoing era while the incoming era builds in with a per-layer stagger (`outgoing [0,0.45]`, `incoming [0.3,1]`). The polish layer rides the buildings morph because it is attached under the buildings layer.
- **Mid-transition interruption** settles on the latest selection: `play()` re-targets, superseded bundles are disposed exactly once, and the stage never holds more than the outgoing+incoming pair — covered by `transitionController.test.ts`, `transition.integration.test.ts`, `eraSceneRegistry.test.ts` and the appBoot end-to-end test (1945 → 1985 morph, interruption semantics, no orphaned/duplicated objects).
- **prefers-reduced-motion**: scene-integration's swap wiring + the controller implement the instant swap (zero-duration reduced-motion crossfade via `matchMedia('(prefers-reduced-motion: reduce)')`); the polish module does **not** re-implement or bypass it. The reduced-motion tests pass in the full suite; a live media-query flip is a QA browser observation.

---

## 7. Navigation

- Orbit drag + wheel zoom: `CameraRig` clamps polar angle and distance (`minDistance 8`, polar `[0.15, π−0.15]`), damped at `dampingRate`.
- Walk WASD/arrows: eye height clamped to a **0.15 m floor** (`WALK_FLOOR`), pitch clamped to `maxLookPitch` — no clipping into the street plane.
- Covered headlessly by `controls/navigation.test.ts` (19 tests) and `appBoot.test.ts` (orbit → walk → W-key translation through the wired loop). Close-up inspection (storefront/pedestrian/rooftop) is a QA browser observation.

---

## 8. SFX (Web Audio synthesis, no assets)

End-to-end wiring is proven by the full suite (real `AudioEngine` under a stub AudioContext): slider → store → swap → `audio.setEra(...)` ambience crossfade + `playTransitionWhoosh()` on change, UI clicks from the HUD, mute toggle routes through the master gain, autoplay unlock on first gesture.

Per-era ambience differs (from `DEFAULT_ERA_AMBIENCE`): different bed names, base volumes (0.35→0.52), tone stacks and noise filters per era — crossfaded on change (default 1.8 s). **SFX** checks:

- Ambience changes per year with a crossfade — wired + unit-tested; aural confirmation: QA browser.
- Transition whoosh — `playTransitionWhoosh` invoked on every genuine selection; audibility: QA browser.
- UI clicks — HUD `playClick`; audibility: QA browser.
- **Mute silences everything** — `toggleMute()` → master gain 0; asserted headlessly (`appBoot.test.ts` routes `slider.toggleMute` ↔ `audio.isMuted`).

---

## 9. HUD polish and accessibility

- Top slider pinned at `z-index 1000` with year readout, five stops, mute toggle, help overlay (`?` / button), keyboard navigation (arrows, Home/End) and focus-visible rings — `hud.css` + `timelineSlider` (existing producer code, untouched).
- **Polish overlays never obscure the top slider**: the perf overlay mounts bottom-left (`position: fixed; left:12px; bottom:12px; z-index:900`) — asserted by `perfBudget.test.ts`; the help overlay is modal but dismissible (Esc/close) and sits below nothing of the HUD it hides by design.
- Responsive layout: HUD collapses gracefully to narrow viewports (`hud.css` media queries).
- Reduced motion: `prefers-reduced-motion` disables HUD animations (CSS) and the morph animation (scene-integration swap wiring).

---

## 10. Recorded gaps (QA browser runner)

The headless harness cannot produce pixel screenshots, real WebGL frame times, live media-query flips or audible sound. These remain for the QA browser run:

1. **Per-era screenshots** — capture `era-1945` … `era-2025` after clicking each stop; verify §5 rows change between every adjacent pair.
2. **Perf overlay** — open `?perf=1` and record `pixelRatio` (capped ≤ 2), `polish N/450` (additive layer ≤ 450; measured 21–34), `draws N/1500` (stage ≤ 1500; measured 1040–1332) and FPS during orbit drag + one full 1945→2025 transition (target ≥ 45 fps on reference hardware; the app is instanced/merged so frame pacing should hold).
3. **Mid-transition interrupt** — 1945 → 2025 then select 1985 mid-morph; verify clean 1985 scene, no orphaned/duplicated objects.
4. **Navigation** — orbit drag, wheel zoom, WASD walk to a storefront/pedestrian/rooftop close-up; confirm smooth damped motion and no ground clipping.
5. **Audio** — with sound on, confirm per-year ambience crossfade, transition whoosh, UI clicks, and that mute silences everything.
6. **Reduced motion** — enable OS `prefers-reduced-motion` and confirm instant swap (no staged morph), which scene-integration implements.

All six items have matching automated/headless coverage in the 387-test suite; the browser run records the visual/audio confirmation.

---

## 11. Command evidence summary

| Purpose | Command | Outcome |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Polish unit tests | `npx vitest run src/polish` | 18/18 pass |
| Full composition suite | `npx vitest run` | 387/387 pass |
| Production build | `npx vite build` | success (`dist/`) |