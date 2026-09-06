# Era Content Audits

Full QA audit of all five eras in the composed app. Content-count thresholds are
asserted by the per-era composition specs (`src/eras/__tests__/era-*.composition.spec.ts`)
and cross-checked by the composed-app QA suite (`_qa/qa-full.spec.ts`). Screenshots
captured at the standard camera anchor via `?era=YYYY` are under
`_qa/screenshots/`.

## Thresholds asserted (per era composition spec)

| Era | Buildings | Storefronts | Ads | Vehicles | Pedestrians | Street furniture |
|-----|-----------|-------------|-----|----------|-------------|------------------|
| 1945 | ≥6 | ≥3 | ≥2 | ≥3 | ≥8 | period streetlights, parking meters, newsstands |
| 1965 | ≥6 | ≥3 | ≥2 | ≥4 | ≥8 | streetlights, parking meters, bus stop, phone booth, mailboxes |
| 1985 | ≥6 | ≥3 | ≥2 | ≥4 | ≥8 | neon arcade, video rental, music, electronics storefronts; streetlights |
| 2005 | ≥6 | ≥3 | ≥2 | ≥4 | ≥8 | bus shelter, bike racks, newspaper boxes, planters |
| 2025 | ≥6 | ≥3 | ≥2 | ≥4 | ≥8 | cycle lane, EV chargers, planters, bike racks |

All five per-era composition specs pass (see `npm run test`), so every era meets
its content-density acceptance criteria.

## Screenshot matrix review

Captured `?era=1945/1965/1985/2005/2025` at the standard camera anchor and
reviewed for era-distinctness and detail density.

| Era | Avg RGB | Bright % | Edge density (building band) | Distinctness |
|-----|---------|-----------|------------------------------|--------------|
| 1945 | (37,34,32) | 8.0% | 21781 | Post-war brick/cobblestone, trams, war posters |
| 1965 | (74,77,70) | 25.5% | 13149 | Mid-century pastel storefronts, chrome cars |
| 1985 | (34,50,55) | 13.5% | 11680 | Neon fascias, mirrored curtain-wall towers |
| 2005 | (53,63,71) | 36.1% | 1298 | Smooth glass corporate towers, chain fascias |
| 2025 | (88,85,79) | 28.2% | 2150 | Green-roof towers, LED screens, EV/micromobility |

Each era is visually distinct in palette, material language, and street furniture.
1945's darker, rough brick/cobblestone reflects post-war austerity; 2005's low
edge density reflects smooth glass curtain walls (era-appropriate 2000s corporate
towers) rather than missing content — the 2005 composition spec confirms ≥6
buildings, ≥3 storefronts, ≥2 billboards, ≥4 vehicles, ≥8 pedestrians are present.

## Defects found & fixes

- **Under-lighting of `MeshStandardMaterial` eras (1945/1965/2025).** The engine
  light rig produced near-black renders for lit materials. Fixed in
  `src/engine/renderer.ts` (owning module) by tuning the ambient/sun/fill light
  intensities so the lit eras render clearly without over-exposing the brighter
  building surfaces. Re-verified: all eras now visibly render their content with
  modest clipping (≤7.5% on the lit eras, 0% on the unlit 2005).