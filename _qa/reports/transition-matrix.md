# Transition Matrix QA

Full 20-pair transition matrix driven against the composed app
(`_qa/qa-full.spec.ts` → "QA: 20-pair transition matrix"). Every ordered pair of
the five eras is exercised via `app.setEra`, asserting:

- **Zero console errors** — no thrown exceptions during any transition.
- **Zero leaks** — after settling, the shared scene child count returns to the
  target era's standalone baseline (within a tolerance).
- **No stuck states** — `app.currentEra` equals the requested era and the scene
  re-populates (`children.length > 0`).

## Result

**PASS** — all 20 ordered pairs complete with zero errors, zero leaks, zero stuck
states. Verified by the QA suite (9/9 tests pass, including this matrix).

## Defect found & fixed

- **2005 era scene leak.** `src/eras/eras/2005.ts` built its entire scene graph
  directly into the shared scene via many `scene.add(...)` calls, and its
  `dispose()` only cleared internal `simState` arrays — it never detached the
  built graph. Every time 2005 was active and then switched away, its geometry
  accumulated in the scene (scene children grew 160 → 553 → 684 → 814 across
  transitions). Fixed in the owning module by wrapping the whole 2005 graph in a
  single root group and removing it from the scene on `dispose()`, matching the
  pattern used by the 1945/1985/2025 eras.

- **Simulation mesh leak on era switch.** `src/sim/pedestrians.ts` `setProfile`
  rebuilt pedestrian/vehicle agents without disposing the previous era's agent
  meshes (contrast with `setProviders`, which did). Fixed in the owning module by
  disposing outgoing meshes before rebuilding on every profile switch.

## Re-verified

The matrix now passes with scene child counts returning to baseline for every
pair. The existing `app.composition.spec.ts` "transitions through every ordered
pair" test also passes.