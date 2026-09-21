# Art-direction report — City Time Period Timelapse

Owner: era-matrix browser verification (QA). This report is the human-review half
of the verification: the automated suite proves that something *changed* between
periods; this document records whether what changed **reads as the right decade**,
and where it does not.

## 1. What was run

| Command | Result | Evidence written |
| --- | --- | --- |
| `npx playwright test e2e/qa-era-matrix.spec.ts` | pass | `artifacts/era-matrix.json` |
| `npx playwright test e2e/qa-era-pixels.spec.ts` | pass | `artifacts/era-pixels.json`, `era-*.png`, `frame-*.png` |
| `npx playwright test e2e/qa-perf-budget.spec.ts` | pass | `artifacts/era-perf.json`, `era-perf-tiers.json`, `era-perf-high-baseline.json` |
| `npx playwright test e2e/qa-audio.spec.ts` | pass | `artifacts/era-audio.json` |
| `npx playwright test e2e/qa-accessibility.spec.ts` | pass | `artifacts/era-accessibility.json` |
| `npx playwright test e2e/qa-camera.spec.ts` | pass | `artifacts/era-camera.json` |

Environment: headless Chromium (SwiftShader software rasterisation, no GPU),
reference viewport 1280x800, dev server on `http://127.0.0.1:5173`, quality tier
`low` for every walk (a dev-only deep link used to keep five era rebuilds inside
the check budget). Full-viewport captures for review are `frame-<year>.png`; the
scene-only captures the pixel maths uses are `era-<year>.png`.

## 2. Method, and what it can and cannot prove

* Every number below comes from the composition's own debug surface
  (`window.__cityTimelapse`), read through the running application. Nothing is
  taken from a module's private state.
* Pixel comparisons hide the DOM overlay for the instant of the capture, so the
  year *label* cannot contribute to a difference, and the camera is asserted
  byte-identical across captures.
* **What it cannot prove:** whether a facade, a car or a colour grade actually
  reads as 1945 rather than 1965. Only a human looking at
  `frame-1945.png` … `frame-2025.png` can call that. The verdicts below are that
  human judgement, kept honest by the measurements beside them.

## 3. Per-era checklist

Legend: **PASS** = present and period-distinct; **FAIL** = absent or wrong;
**PARTIAL** = present but incomplete for the period.

| Category | 1945 | 1965 | 1985 | 2005 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Architecture (buildings) | FAIL | FAIL | FAIL | FAIL | FAIL |
| Commerce & advertising | PASS | PASS | PASS | PASS | PASS |
| Transport | PASS | PASS | PASS | PASS | PASS |
| People (pedestrians) | FAIL | FAIL | FAIL | FAIL | FAIL |
| Street furniture | PASS | PASS | PASS | PASS | PASS |
| Atmosphere & colour | PASS | PASS | PASS | PASS | PASS |
| Audio character | PASS | PASS | PASS | PASS | PASS |

## 4. Evidence per category

### Architecture — FAIL (all eras)

No buildings layer is mounted. The composition publishes `buildings` as a
* pending* slot (`mounted: false`, `objects: 0`, `stats: {}`) in
`era-matrix.json`, and `src/city/buildings/` contains no barrel to mount. The
frozen block contributes only ground surfaces to the render — its mesh groups are
`parcels`, `roads`, `lane-strips`, `parking-strips`, `sidewalks`, `curbs`,
`crosswalks`, `drainage` — so there is no massing, window grid, rooftop detail or
construction state to judge. The storefront layer dresses the shopfront band
(bays, awnings, signage) but nothing above it, which is why the skyline is flat in
all five captures.

Owner: the "Era building sets for every parcel" task (its lane was superseded and
its barrel is not in this revision). Linked failing check:
`qa-era-matrix.spec.ts` asserts the slot is reported pending and records it; there
is no passing assertion for buildings.

### Commerce & advertising — PASS (all eras)

Measured from `storefronts` in `era-matrix.json`; the progression reads correctly
as a period story:

| | 1945 | 1965 | 1985 | 2005 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Bays / signs | 68 / 68 | 68 / 68 | 68 / 68 | 68 / 68 | 68 / 68 |
| Advertising boards | 12 | 14 | 16 | 15 | 13 |
| Graffiti | 0 | 16 | 46 | 3 | 18 |
| Illuminated meshes | 0 | 144 | 282 | 146 | 143 |
| Distinct textures | 84 | 99 | 131 | 89 | 104 |

The block always trades — every period dresses all 68 bays with 68 signs — while
the *character* moves from painted boards and no litter (1945), through the
mid-century shopping boom (1965), peak neon and peak graffiti (1985), to a
thinner, cleaner digital-era street (2005) and back to a lit, tagged, dense
present (2025). Advertising counts dip and rise rather than climbing
monotonically, which is the right shape for poster and hoarding density.

### Transport — PASS (all eras)

| | 1945 | 1965 | 1985 | 2005 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Moving instances | 14 | 21 | 33 | 37 | 24 |
| Parked instances | 37 | 26 | 31 | 35 | 41 |
| Moving variants | 9 | 15 | 14 | 20 | 14 |
| Road-marking meshes | 1 | 2 | 3 | 4 | 6 |

Traffic builds from a thin motor pool on lightly marked asphalt to a busy,
heavily marked street. 1945's fleet is horse-drawn: it emits no combustion plumes
and triggers no engine/horn SFX, which the audio check had to account for.
Parking pressure rises again by 2025 (41 parked instances) — a believable
present-day curbside.

### People — FAIL (all eras)

No pedestrians layer is mounted either: `pedestrians` is published as
*pending* with zero objects, and `src/city/pedestrians/` holds no barrel, so there
are no crowds, outfits, walk cycles or carried props on any sidewalk in any of the
five captures. This is the largest gap against the brief ("pedestrian outfits …
crowds"), and it is visible: the streets are empty of people in every
`frame-*.png`.

Owner: the "Era pedestrian crowds with period outfits" task (lane superseded,
barrel not in this revision).

### Street furniture — PASS (all eras)

| | 1945 | 1965 | 1985 | 2005 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Anchors covered / props | 76 / 76 | 76 / 76 | 76 / 76 | 76 / 76 | 76 / 76 |
| Instance count | 416 | 404 | 420 | 433 | 469 |
| Draw calls | 86 | 91 | 94 | 104 | 117 |
| Distinct recipes | 19 | 20 | 21 | 21 | 22 |
| Lamp point lights | 0 | 0 | 4 | 0 | 0 |

Every anchor is furnished in every period (no bare corner), and the *mix* moves:
fewest, simplest objects in 1945, and the densest, most varied clutter by 2025.
1985 is the one period where street furniture itself emits light (4 point lights)
— the right note for a neon downtown — while daylit 2005 and 2025 push their
illumination into the signage instead.

### Atmosphere & colour — PASS (all eras)

| | 1945 | 1965 | 1985 | 2005 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Exhaust/plume emitters | 3 | 20 | 24 | 26 | 27 |
| Vehicle plume sources | 0 | 18 | 21 | 24 | 24 |
| Ambient birds | 14 | 9 | 3 | 11 | 16 |

Air quality and light follow the century: clean air in 1945 (baseline emitters
only, no traffic exhaust), heavy exhaust through the boom decades, 1985's
smog-thick downtown with almost no birds left, then birds returning as the fleet
electrifies. Adjacent-era frames differ by mean per-channel deltas of **28.7 /
49.1 / 50.4 / 35.1** (of 255) with 93–99.5% of pixels changed, against a same-era
control of **0.62** — the visual transformation is large and is not animation
noise.

### Audio character — PASS (all eras)

Each period selects its own bed and they are all distinct:

`1945-home-front` → `1965-mid-century-boom` → `1985-neon-downtown` →
`2005-digital-turn` → `2025-electric-present`.

The engine stays suspended (no `AudioContext` at all) until the viewer's first
gesture *on the canvas* — a click on an overlay panel deliberately does not
unlock — then runs at `contextState: running`. The director issued 10 era cue
SFX across the walk. Vehicle SFX were routed at a rate-limited cadence
(4 routed, 2 suppressed by the limiter, per-kind gaps respecting the documented
minimums, global rate inside the documented ceiling), and repeated switching
released voices: `liveVoices === oneShotVoices + bedVoices` at every sample and
the settled engine holds exactly one bed voice with no retiring beds.

*Caveat a human should listen for:* the mix balance between bed and one-shot
levels, and whether the synthesised beds actually evoke each decade, are not
assertable and were not judged here.

## 5. Shortcomings automated checks cannot detect

1. **Empty streets (people).** No pedestrian layer; the pre-eminent "period
   street" signal — who is on the pavement and what they wear — is missing
   entirely.
2. **Flat skyline (architecture).** No building massing; every period is judged on
   a single-storey shopfront band over bare parcels, so the century's most
   dramatic change (the skyline) is absent.
3. **Absolute frame rate is unverified.** The reference sandbox has no GPU: the
   app measured **94.7 ms and 97.1 ms** per frame when it decided to degrade
   (against the shared 16.67 ms budget) and settled at ~97 ms/frame at every
   tier. The degraded floor and the adaptive reaction are correct and asserted,
   but "60 fps on real hardware" remains unproven and needs a GPU machine.
4. **Frame instrumentation reports a clamped delta.** The pipeline feeds the
   instrumentation a delta capped at the simulation step, so `frameTimeMs`
   saturates near 100 ms and cannot report a slower frame honestly. That is why
   this report records the controller's own measurements
   (`era-perf.json → decisions`) rather than the surface's `frameTimeMs`.
5. **Stale per-layer census after a tier change.** Changing tier rebuilds the
   density-driven layers but does not invalidate the cached debug records, so the
   published census keeps the *old* tier's `qualityTier` and counts until an era
   change forces a re-measure. The perf checks work around it by comparing the
   first-frame census of each build; the owning task should invalidate the record
   cache in `setQualityTier`.
6. **Colour grading is measured, not judged.** The per-era grade is proven to
   differ (pixels) and to track the era, but whether 1985 is "too magenta" or
   2005 "too flat" is a human call; see `frame-1985.png` and `frame-2005.png`.
7. **The 1945 soundscape has no vehicle SFX** because its fleet is horse-drawn.
   That is correct, but it means the SFX cadence check can only be observed from
   a motorised period; an era whose traffic is silent would pass vacuously if the
   suite ever ran only in 1945.
8. **Quality-tier counts are coarse.** Several layers scale only slightly between
   tiers (storefront object counts are identical at `high` and `low`; only the
   facade subdivision and texture resolution change), so "lower tier, lower cost"
   is proven at the aggregate level (objects 1270→1171, meshes 1185→1086,
   instances 2665→1884, triangles 69 224→56 276) rather than for every layer.

## 6. Defects filed against owning tasks

| # | Defect | Owning task | Evidence | Status |
| --- | --- | --- | --- | --- |
| D1 | No buildings layer: `buildings` reported pending, `src/city/buildings/` empty | Era building sets for every parcel | `era-matrix.json → pendingLayers`; `qa-era-matrix.spec.ts` pending-slot assertion | open, reported here |
| D2 | No pedestrians layer: `pedestrians` reported pending, `src/city/pedestrians/` empty | Era pedestrian crowds with period outfits | `era-matrix.json → pendingLayers` | open, reported here |
| D3 | Frame instrumentation measures a clamped delta, so it cannot report frames slower than the sim step | WebGL render pipeline | `era-perf.json → finalMeasurement` (~97 ms with real frames far slower) | open, reported here |
| D4 | Tier change does not invalidate cached debug layer records (stale census/`qualityTier`) | Compose the full era-switching city-block experience | layer `qualityTier` stayed `high` after the controller adapted to `medium`/`low` | open, reported here |

These are the only categories that failed. Both are missing-barrel gaps rather
than regressions in shipped code, and neither is fixable from this task: the
suite owns only its own test files, and the plan requires defects to be reported
here and fixed by the owning task.

## 7. Verdict

The composed experience delivers a convincing, measurable period transformation
across **commerce and advertising, transport, street furniture, atmosphere and
audio** — five distinct years, distinct statistics, distinct pixels, a stable
camera, a working keyboard/ARIA timeline and an audio engine that waits for the
viewer. It does **not** yet deliver **architecture** or **people**, because two
content barrels are absent from this revision. Those two gaps are the reason the
"polished, high-end" bar is not fully met, and they are filed above as D1 and D2.
