/**
 * Composition suite: the real layout, the real era registry and the real
 * building layer working together.
 *
 * This is the cross-module proof the plan asks for. It generates the canonical
 * block with `createCityLayout`, reads the shipped era table with `getEra`, and
 * builds all five eras over the *same* parcel set with an injected recording
 * texture factory (so no DOM canvas is needed). It then asserts the
 * integration properties that only exist when the three modules meet: anchors
 * used really exist in the layout, window counts differ per era, mounted
 * geometry matches the declared triangle and draw-call estimates, both
 * instancing paths are exercised, the procedural textures are requested per
 * era, `applyEra` / `applyEraTransition` interpolate to the target, and the
 * React layer attaches to the render pipeline's world group.
 */

import { createElement, type ReactElement } from 'react'
import { Group, InstancedMesh, Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ERA_IDS, getEra, type EraId } from '../../src/era'
import { ScenePipelineContext, type RenderPipeline } from '../../src/scene'
import {
  BUILDING_GROUPS,
  BUILDING_TABLES,
  BuildingsLayer,
  addOnBatch,
  applyEra,
  applyEraTransition,
  blendBuildingStats,
  buildBuildingSet,
  createBuildingLayer,
  createBuildingScene,
  createCanvasTextureFactory,
  createCityLayout,
  createRecordingTextureFactory,
  disposeBuildingSet,
  facadeTextureRequest,
  getBuildingTable,
  materialSpecsFor,
  planBuildingSet,
  plotRect,
  plotRectContains,
  plotRectsOverlap,
  resolveDetail,
  shouldInstance,
  stateQuota,
  type BuiltBuildings,
  type BuildingLayerState,
} from '../../src/city/buildings'

const LAYOUT = createCityLayout()
const ERAS: readonly EraId[] = [...ERA_IDS]

interface EraVariant {
  readonly eraId: EraId
  readonly built: BuiltBuildings
  readonly requests: readonly ReturnType<typeof facadeTextureRequest>[]
}

function buildVariants(): readonly EraVariant[] {
  return ERAS.map((eraId) => {
    const factory = createRecordingTextureFactory(`recording:${eraId}`)
    const built = buildBuildingSet({ layout: LAYOUT, eraId, textureFactory: factory })
    return { eraId, built, requests: [...factory.requests] }
  })
}

const VARIANTS = buildVariants()

function variant(eraId: EraId): EraVariant {
  const found = VARIANTS.find((entry) => entry.eraId === eraId)
  if (found === undefined) {
    throw new Error(`No built variant for ${eraId}`)
  }
  return found
}

/** Minimal pipeline stub: the layer only ever touches the world group. */
function stubPipeline(): { pipeline: RenderPipeline; world: Group } {
  // A real three.js group keeps the assertion honest about the layer's parent.
  const world = new Group()
  return { pipeline: { world } as unknown as RenderPipeline, world }
}

describe('era building layer over the real block layout', () => {
  it('resolves the same parcels for every era', () => {
    const ids = LAYOUT.parcels.map((parcel) => parcel.id).sort()
    for (const entry of VARIANTS) {
      expect(entry.built.plan.plots.map((plot) => plot.parcelId).sort()).toEqual(ids)
      expect(entry.built.plan.plots).toHaveLength(LAYOUT.parcels.length)
    }
    expect(LAYOUT.parcels).toHaveLength(16)
  })

  it('contains every footprint in its own parcel, with no gaps or overlaps', () => {
    for (const entry of VARIANTS) {
      const stats = entry.built.plan.stats
      expect(stats.buildingCount + stats.vacantLotCount + stats.constructionCount).toBe(
        LAYOUT.parcels.length,
      )
      expect(entry.built.plan.plots).toHaveLength(LAYOUT.parcels.length)

      for (const plot of entry.built.plan.plots) {
        const parcel = LAYOUT.parcels.find((candidate) => candidate.id === plot.parcelId)
        expect(parcel, `${plot.parcelId} exists in the layout`).toBeDefined()
        if (parcel === undefined) continue
        const parcelRect = plotRect(
          parcel.footprint.min.x,
          parcel.footprint.min.z,
          parcel.footprint.max.x,
          parcel.footprint.max.z,
        )
        expect(
          plotRectContains(parcelRect, plot.footprint),
          `${entry.eraId} ${plot.parcelId} footprint inside its parcel footprint`,
        ).toBe(true)
        if (plot.state === 'building') {
          expect(plotRectContains(parcelRect, plot.basePlate)).toBe(true)
          expect(plotRectContains(parcelRect, plot.upperPlate)).toBe(true)
        }
      }

      for (let i = 0; i < entry.built.plan.plots.length; i += 1) {
        for (let j = i + 1; j < entry.built.plan.plots.length; j += 1) {
          const a = entry.built.plan.plots[i]
          const b = entry.built.plan.plots[j]
          if (a === undefined || b === undefined) continue
          expect(plotRectsOverlap(a.footprint, b.footprint), `${a.parcelId}/${b.parcelId}`).toBe(false)
        }
      }
    }
  })

  it('differs from every adjacent era by a defined margin', () => {
    for (let index = 1; index < VARIANTS.length; index += 1) {
      const previous = VARIANTS[index - 1] as EraVariant
      const current = VARIANTS[index] as EraVariant
      const before = previous.built.plan.stats
      const after = current.built.plan.stats
      expect(after, `${previous.eraId} != ${current.eraId}`).not.toEqual(before)
      expect(Math.abs(after.heightMean - before.heightMean)).toBeGreaterThan(1)
      expect(Math.abs(after.floorsMean - before.floorsMean)).toBeGreaterThan(0.5)
      expect(Math.abs(after.footprintAreaMean - before.footprintAreaMean)).toBeGreaterThan(5)
      expect(Math.abs(after.windowCount - before.windowCount)).toBeGreaterThan(0)
      expect(after.triangleEstimate).not.toBe(before.triangleEstimate)
      expect(BUILDING_TABLES[current.eraId].massing.family).not.toBe(
        BUILDING_TABLES[previous.eraId].massing.family,
      )
    }
  })

  it('shows exactly the vacant and construction quota each era requests', () => {
    for (const entry of VARIANTS) {
      const table = BUILDING_TABLES[entry.eraId]
      const stats = entry.built.plan.stats
      const construction = stateQuota(table.construction, LAYOUT.parcels.length)
      const vacancy = Math.min(
        stateQuota(table.vacancy, LAYOUT.parcels.length),
        LAYOUT.parcels.length - construction,
      )
      expect(stats.constructionCount, `${entry.eraId} construction`).toBe(construction)
      expect(stats.vacantLotCount, `${entry.eraId} vacant lots`).toBe(vacancy)
      expect(stats.roofKitCount).toBe(stats.buildingCount)
    }
  })

  it('attaches only to anchors the layout published', () => {
    const byName = new Map(LAYOUT.anchors.map((anchor) => [anchor.name, anchor]))
    for (const entry of VARIANTS) {
      expect(entry.built.plan.anchorsUsed.length).toBeGreaterThan(16)
      for (const name of entry.built.plan.anchorsUsed) {
        expect(byName.has(name), `${entry.eraId} used ${name}`).toBe(true)
      }
      for (const plot of entry.built.plan.plots) {
        expect(byName.has(`parcel:${plot.parcelId}:prop:1`)).toBe(true)
        for (const clearance of plot.frontage) {
          const anchor = byName.get(clearance.anchor)
          expect(anchor, `${clearance.anchor} exists`).toBeDefined()
          expect(anchor?.kind).toBe('storefront-bay')
          expect(anchor?.owner.id).toBe(plot.parcelId)
          expect(anchor?.facing).toBe(clearance.street)
        }
        for (const addOn of plot.addOns) {
          expect(addOn.parcelId).toBe(plot.parcelId)
        }
      }
    }
  })

  it('produces era-distinct window counts, massing and roof kits', () => {
    const windows = VARIANTS.map((entry) => entry.built.plan.stats.windowCount)
    expect(new Set(windows).size).toBe(windows.length)
    const heights = VARIANTS.map((entry) => entry.built.plan.stats.heightMean)
    expect(heights).toEqual([...heights].sort((left, right) => left - right))
    const kits = VARIANTS.map((entry) => entry.built.plan.stats.roofKitsByKit)
    expect(kits[0]?.['masonry-watertank']).toBeGreaterThan(0)
    expect(kits[0]?.['green-solar']).toBe(0)
    expect(kits[4]?.['green-solar']).toBeGreaterThan(0)
    expect(kits[4]?.['masonry-watertank']).toBe(0)
    // Adjacent eras never share a facade language either.
    const styles = ERAS.map((eraId) => BUILDING_TABLES[eraId].facade.style)
    expect(new Set(styles).size).toBe(styles.length)
  })

  it('mounts exactly the geometry the plan declared', () => {
    for (const entry of VARIANTS) {
      const { built } = entry
      const stats = built.plan.stats
      expect(built.summary.triangleCount, `${entry.eraId} triangles`).toBe(stats.triangleEstimate)
      expect(built.summary.meshCount, `${entry.eraId} meshes`).toBe(stats.meshCount)
      expect(built.summary.groupMeshCounts.masses).toBe(stats.buildingCount)
      expect(built.summary.groupMeshCounts.facades).toBe(stats.buildingCount)
      expect(built.summary.groupMeshCounts['roof-kits']).toBe(stats.roofKitCount)
      expect(built.summary.groupMeshCounts.lots).toBe(stats.vacantLotCount)
      expect(built.summary.groupMeshCounts.construction).toBe(stats.constructionCount)
      expect(built.summary.groupMeshCounts['add-ons']).toBe(stats.addOnMeshCount)
      expect(stats.meshCount).toBe(
        stats.buildingCount * 3 +
          stats.vacantLotCount +
          stats.constructionCount +
          stats.addOnMeshCount,
      )
      const summedTriangles = BUILDING_GROUPS.reduce(
        (total, group) => total + built.summary.groupTriangles[group],
        0,
      )
      expect(summedTriangles).toBe(built.summary.triangleCount)
      for (const name of built.summary.names) {
        expect(built.root.getObjectByName(name), `${name} is mounted`).toBeDefined()
      }
      expect(built.root.name).toBe(`era-buildings:${entry.eraId}`)
      expect(built.groups.masses.name).toBe('group:masses')
    }
  })

  it('stays inside the shared triangle and draw-call budget with room to spare', () => {
    for (const entry of VARIANTS) {
      const stats = entry.built.plan.stats
      expect(stats.triangleEstimate).toBeLessThanOrEqual(stats.triangleBudget)
      expect(stats.meshCount).toBeLessThanOrEqual(stats.drawCallBudget)
      expect(entry.built.summary.triangleCount).toBeLessThanOrEqual(stats.triangleBudget)
    }
  })

  it('differs measurably between 1945 and 2025 in triangles and draw calls', () => {
    const first = variant('1945').built.plan.stats
    const last = variant('2025').built.plan.stats
    expect(last.triangleEstimate).toBeGreaterThan(first.triangleEstimate * 2)
    expect(last.heightMean).toBeGreaterThan(first.heightMean * 3)
    expect(last.floorsMean).toBeGreaterThan(first.floorsMean * 2)
    expect(last.drawCallEstimate).not.toBe(first.drawCallEstimate)
    expect(last.windowCount).not.toBe(first.windowCount)
    expect(last.footprintAreaMean).toBeLessThan(first.footprintAreaMean)
  })

  it('requests the procedural facade textures once per era surface', () => {
    for (const entry of VARIANTS) {
      expect(entry.requests.map((request) => request.surface)).toEqual([
        'mass',
        'glass',
        'roof',
        'lot',
      ])
      const glass = entry.requests.find((request) => request.surface === 'glass')
      expect(glass).toBeDefined()
      expect(glass?.eraId).toBe(entry.eraId)
      expect(glass?.night).toBe(getEra(entry.eraId).lighting.sunElevationDeg < 0)
      // The glazing geometry is one band per storey, so the grid is one row tall.
      expect(glass?.grid?.rows).toBe(1)
      expect(glass?.grid?.columns).toBeGreaterThan(0)
      expect(glass?.size).toBeGreaterThanOrEqual(128)
      const mass = entry.requests.find((request) => request.surface === 'mass')
      expect(mass?.textureSet).toBe(BUILDING_TABLES[entry.eraId].textureSet)
      expect(mass?.courses).toBeGreaterThan(4)
    }
    // The layer's own build path requests the same surfaces through the factory.
    const factory = createRecordingTextureFactory()
    buildBuildingSet({ layout: LAYOUT, eraId: '1985', textureFactory: factory, qualityTier: 'medium' })
    expect(factory.requests).toHaveLength(4)
    expect(factory.create(facadeTextureRequest({
      table: getBuildingTable('1985'),
      surface: 'glass',
      grid: null,
      size: 64,
    })).request.id).toBe('1985:glass:concrete-band')
  })

  it('switches the window emissive material with the era night flag', () => {
    for (const entry of VARIANTS) {
      const table = getBuildingTable(entry.eraId)
      const specs = materialSpecsFor(table)
      const emissive = entry.built.materials.glass.emissiveIntensity
      expect(emissive).toBe(specs.glass.emissiveIntensity)
      if (table.night) {
        expect(emissive).toBeGreaterThan(0)
        expect(entry.built.materials.glass.emissive.getHex()).toBeGreaterThan(0)
      } else {
        expect(emissive).toBe(0)
      }
    }
    expect(variant('1985').built.materials.glass.emissiveIntensity).toBeGreaterThan(0)
    expect(variant('1945').built.materials.glass.emissiveIntensity).toBe(0)
  })

  it('keeps procedural surfaces from darkening twice', () => {
    // Without a texture payload (the recording factory) the palette colour is
    // applied directly by the material.
    for (const entry of VARIANTS) {
      const specs = materialSpecsFor(getBuildingTable(entry.eraId))
      for (const key of Object.keys(entry.built.materials) as (keyof typeof specs)[]) {
        const material = entry.built.materials[key]
        const spec = specs[key]
        expect(material.map, `${entry.eraId} ${key} has no texture`).toBeNull()
        expect(material.color.getHex(), `${entry.eraId} ${key}`).toBe(spec.color)
        expect(material.roughness).toBe(spec.roughness)
        expect(material.metalness).toBe(spec.metalness)
        expect(material.emissiveIntensity).toBe(spec.emissiveIntensity)
      }
    }

    // With a real texture the tint lives in the map, so the base colour stays
    // white instead of multiplying the colour twice. A document that cannot
    // create canvases drives the factory's documented data-texture fallback,
    // which is also the path a renderer without a 2D context takes.
    const built = buildBuildingSet({
      layout: LAYOUT,
      eraId: '1985',
      textureFactory: createCanvasTextureFactory({
        size: 32,
        document: { createElement: () => null } as unknown as Document,
      }),
    })
    try {
      const specs = materialSpecsFor(getBuildingTable('1985'))
      let mapped = 0
      for (const key of Object.keys(built.materials) as (keyof typeof specs)[]) {
        const material = built.materials[key]
        const spec = specs[key]
        if (spec.textureSurface === null) {
          expect(material.map).toBeNull()
          expect(material.color.getHex()).toBe(spec.color)
        } else {
          expect(material.map, `${key} is textured`).not.toBeNull()
          expect(material.color.getHex()).toBe(0xffffff)
          mapped += 1
        }
      }
      expect(mapped).toBe(4)
      expect(built.materials.glass.emissiveIntensity).toBeGreaterThan(0)
    } finally {
      disposeBuildingSet(built)
    }
  })

  it('uses both instancing paths, keyed off the quality tier threshold', () => {
    let instanced = 0
    let individual = 0
    for (const entry of VARIANTS) {
      for (const batch of entry.built.batches) {
        if (batch.group !== 'add-ons') {
          continue
        }
        if (batch.instanced) {
          instanced += 1
          expect(batch.mesh).toBeInstanceOf(InstancedMesh)
          expect(batch.count).toBeGreaterThanOrEqual(20)
        } else {
          individual += 1
          expect(batch.mesh).toBeInstanceOf(Mesh)
        }
      }
      for (const [kind, boxes] of Object.entries(
        entry.built.plan.plots.flatMap((plot) => plot.addOns).reduce<Record<string, number>>(
          (counts, addOn) => {
            counts[addOn.addOn] = (counts[addOn.addOn] ?? 0) + 1
            return counts
          },
          {},
        ),
      )) {
        expect(shouldInstance(boxes, 'high'), `${entry.eraId} ${kind}`).toBe(
          boxes >= 20,
        )
      }
      expect(addOnBatch(entry.built.plan.stats.addOnsByKind, 'high').meshCount).toBe(
        entry.built.plan.stats.addOnMeshCount,
      )
    }
    expect(instanced).toBeGreaterThan(0)
    expect(individual).toBeGreaterThan(0)
  })

  it('keeps the medium tier lighter than the high tier', () => {
    const factory = createRecordingTextureFactory()
    const high = buildBuildingSet({
      layout: LAYOUT,
      eraId: '1985',
      qualityTier: 'high',
      textureFactory: factory,
    })
    const medium = buildBuildingSet({
      layout: LAYOUT,
      eraId: '1985',
      qualityTier: 'medium',
      textureFactory: factory,
    })
    expect(resolveDetail('medium')).toBeLessThan(resolveDetail('high'))
    expect(medium.plan.detail).toBeLessThan(high.plan.detail)
    expect(medium.plan.stats.windowCount).toBeLessThan(high.plan.stats.windowCount)
    disposeBuildingSet(high)
    disposeBuildingSet(medium)
  })
})

describe('applyEra and applyEraTransition', () => {
  it('applies an era instantly, which is the reduced-motion path', () => {
    const factory = createRecordingTextureFactory()
    const layer = createBuildingLayer({ layout: LAYOUT, eraId: '1945', textureFactory: factory })
    try {
      const after = applyEra('1985', layer)
      expect(after.eraId).toBe('1985')
      expect(after.fromEra).toBe('1985')
      expect(after.toEra).toBe('1985')
      expect(after.progress).toBe(0)
      expect(after.transitioning).toBe(false)
      expect(after.night).toBe(true)
      expect(after.stats).toEqual(planBuildingSet({ layout: LAYOUT, eraId: '1985' }).stats)
      expect(after.mounted.toMeshes).toBe(0)
      expect(layer.root.children).toHaveLength(1)
      expect(layer.root.children[0]?.name).toBe('era-buildings:1985')

      // Re-applying the same era is a no-op rather than a rebuild.
      const again = applyEra('1985', layer)
      expect(again.stats).toEqual(after.stats)

      const back = applyEra('1945', layer)
      expect(back.eraId).toBe('1945')
      expect(back.stats.windowEmissiveIntensity).toBe(0)
      expect(layer.root.children).toHaveLength(1)
      expect(layer.mounted('to')).toBeNull()
    } finally {
      layer.dispose()
    }
    expect(layer.root.children).toHaveLength(0)
  })

  it('interpolates a staged switch at t = 0, 0.5 and 1', () => {
    const factory = createRecordingTextureFactory()
    const layer = createBuildingLayer({ layout: LAYOUT, eraId: '1945', textureFactory: factory })
    try {
      const from = planBuildingSet({ layout: LAYOUT, eraId: '1945' }).stats
      const to = planBuildingSet({ layout: LAYOUT, eraId: '2025' }).stats

      const states = [0, 0.5, 1].map((t) =>
        applyEraTransition({ from: '1945', to: '2025', t }, layer),
      )
      const [atZero, atHalf, atOne] = states as [
        BuildingLayerState,
        BuildingLayerState,
        BuildingLayerState,
      ]

      expect(atZero.progress).toBe(0)
      expect(atHalf.progress).toBe(0.5)
      expect(atOne.progress).toBe(1)
      expect(atZero.eraId).toBe('1945')
      expect(atHalf.eraId).toBe('2025')
      expect(atOne.eraId).toBe('2025')
      expect(atZero.transitioning).toBe(true)
      expect(atHalf.transitioning).toBe(true)
      expect(atOne.transitioning).toBe(false)

      expect(atZero.stats.heightMean).toBe(from.heightMean)
      expect(atOne.stats.heightMean).toBe(to.heightMean)
      expect(atHalf.stats.heightMean).toBe(
        blendBuildingStats(from, to, 0.5).heightMean,
      )
      expect(atHalf.stats.heightMean).toBeGreaterThan(from.heightMean)
      expect(atHalf.stats.heightMean).toBeLessThan(to.heightMean)
      expect(atHalf.stats.windowCount).toBeGreaterThan(from.windowCount)
      expect(atHalf.stats.windowCount).toBeLessThan(to.windowCount)
      expect(atHalf.stats.triangleEstimate).toBeGreaterThan(from.triangleEstimate)
      expect(atHalf.stats.triangleEstimate).toBeLessThan(to.triangleEstimate)
      // Both 1945 and 2025 are day eras, so the blended glow stays dark.
      expect(atHalf.stats.windowEmissiveIntensity).toBe(0)
      const intoNight = applyEraTransition({ from: '1945', to: '1985', t: 0.5 }, layer)
      expect(intoNight.stats.windowEmissiveIntensity).toBeGreaterThan(0)
      expect(intoNight.night).toBe(true)

      // Both eras are mounted during the blend, and the weights cross-fade.
      expect(layer.root.children).toHaveLength(2)
      expect(atZero.mounted.toScaleY).toBeCloseTo(0, 3)
      expect(atHalf.mounted.fromScaleY).toBeCloseTo(0.5, 6)
      expect(atHalf.mounted.toScaleY).toBeCloseTo(0.5, 6)
      expect(atHalf.mounted.fromOpacity).toBeCloseTo(0.5, 6)
      expect(atHalf.mounted.toOpacity).toBeCloseTo(0.5, 6)
      expect(atOne.mounted.fromOpacity).toBe(0)
      expect(atOne.mounted.toOpacity).toBe(1)
      expect(atZero.mounted.fromTriangles).toBe(from.triangleEstimate)
      expect(atOne.mounted.toTriangles).toBe(to.triangleEstimate)

      // A settled pair collapses back to the instant path.
      const settled = applyEraTransition({ from: '2025', to: '2025', t: 0.4 }, layer)
      expect(settled.transitioning).toBe(false)
      expect(settled.eraId).toBe('2025')
      expect(layer.root.children).toHaveLength(1)
    } finally {
      layer.dispose()
    }
  })

  it('cross-fades between adjacent eras without rebuilding the world group', () => {
    const factory = createRecordingTextureFactory()
    const layer = createBuildingLayer({ layout: LAYOUT, eraId: '1985', textureFactory: factory })
    try {
      const requestCount = factory.requests.length
      const first = applyEraTransition({ from: '1985', to: '2005', t: 0.25 }, layer)
      const afterFirst = factory.requests.length
      expect(afterFirst).toBe(requestCount + 4)
      const second = applyEraTransition({ from: '1985', to: '2005', t: 0.75 }, layer)
      expect(first.progress).toBe(0.25)
      expect(second.progress).toBe(0.75)
      expect(second.stats.heightMean).toBeGreaterThan(first.stats.heightMean)
      expect(second.mounted.fromOpacity).toBeCloseTo(0.25, 6)
      // Re-targeting the same pair reuses the mounted sets instead of rebuilding.
      expect(factory.requests.length).toBe(afterFirst)
    } finally {
      layer.dispose()
    }
  })

  it('interpolates every adjacent era pair and reaches both ends', () => {
    const factory = createRecordingTextureFactory()
    const layer = createBuildingLayer({ layout: LAYOUT, eraId: '1945', textureFactory: factory })
    try {
      for (let index = 1; index < ERAS.length; index += 1) {
        const from = ERAS[index - 1] as EraId
        const to = ERAS[index] as EraId
        const fromStats = planBuildingSet({ layout: LAYOUT, eraId: from }).stats
        const toStats = planBuildingSet({ layout: LAYOUT, eraId: to }).stats

        const atZero = applyEraTransition({ from, to, t: 0 }, layer)
        expect(atZero.stats.heightMean).toBe(fromStats.heightMean)
        expect(atZero.stats.windowCount).toBe(fromStats.windowCount)

        let previousHeight = fromStats.heightMean
        for (const t of [0.25, 0.5, 0.75]) {
          const state = applyEraTransition({ from, to, t }, layer)
          const expected = blendBuildingStats(fromStats, toStats, t)
          expect(state.stats.heightMean).toBe(expected.heightMean)
          expect(state.stats.windowCount).toBe(expected.windowCount)
          expect(state.stats.heightMean).toBeGreaterThan(previousHeight)
          previousHeight = state.stats.heightMean
        }

        const atOne = applyEraTransition({ from, to, t: 1 }, layer)
        expect(atOne.stats).toEqual(toStats)
        expect(atOne.eraId).toBe(to)
        expect(atOne.transitioning).toBe(false)
        // The staged result at t = 1 equals the instant, reduced-motion result.
        expect(applyEra(to, layer).stats).toEqual(atOne.stats)
      }
    } finally {
      layer.dispose()
    }
  })

  it('exposes the generated block and layer for a harness in one call', () => {
    const factory = createRecordingTextureFactory()
    const scene = createBuildingScene({ eraId: '1965', textureFactory: factory })
    try {
      expect(scene.layout.stats.parcelCount).toBe(16)
      expect(scene.layer.state().eraId).toBe('1965')
      expect(factory.requests).toHaveLength(4)
      expect(scene.layer.root.parent).toBeNull()
    } finally {
      scene.layer.dispose()
    }
  })

  it('revives after disposal, which is what a StrictMode re-mount does', () => {
    const factory = createRecordingTextureFactory()
    const layer = createBuildingLayer({ layout: LAYOUT, eraId: '1985', textureFactory: factory })
    try {
      layer.dispose()
      expect(layer.root.children).toHaveLength(0)

      const revived = applyEra('1985', layer)
      expect(revived.stats.buildingCount).toBeGreaterThan(0)
      expect(layer.root.children).toHaveLength(1)
      const mounted = layer.mounted('from')
      expect(mounted?.summary.meshCount ?? 0).toBeGreaterThan(0)
      expect(mounted?.groups.masses.children.length ?? 0).toBe(revived.stats.buildingCount)
      expect(mounted?.groups['roof-kits'].children.length ?? 0).toBe(revived.stats.roofKitCount)
      expect(mounted?.groups.facades.children.length ?? 0).toBe(revived.stats.buildingCount)
    } finally {
      layer.dispose()
    }
  })
})

describe('BuildingLayer React binding', () => {
  it('attaches to the pipeline world group and follows its era props', () => {
    const { pipeline, world } = stubPipeline()
    const states: BuildingLayerState[] = []
    const factory = createRecordingTextureFactory()
    const tree = (eraId: EraId): ReactElement =>
      createElement(
        ScenePipelineContext.Provider,
        { value: pipeline },
        createElement(BuildingsLayer, { eraId, textureFactory: factory, onState: (state) => states.push(state) }),
      )

    const view = render(tree('1945'))
    expect(world.children).toHaveLength(1)
    const attached = world.children[0]
    expect(attached?.name).toBe('city-buildings')
    expect(states[0]?.stats.buildingCount).toBeGreaterThan(0)
    expect(states[0]?.stats.heightMean).toBe(
      planBuildingSet({ layout: LAYOUT, eraId: '1945' }).stats.heightMean,
    )

    view.rerender(tree('2025'))
    expect(world.children).toHaveLength(1)
    expect(states[states.length - 1]?.eraId).toBe('2025')
    expect(states[states.length - 1]?.stats.heightMean).toBeGreaterThan(
      states[0]?.stats.heightMean ?? 0,
    )

    view.rerender(
      createElement(
        ScenePipelineContext.Provider,
        { value: pipeline },
        createElement(BuildingsLayer, {
          eraId: '2025',
          textureFactory: factory,
          transition: { from: '2025', to: '1945', t: 0.5 },
          onState: (state) => states.push(state),
        }),
      ),
    )
    const blended = states[states.length - 1]
    expect(blended?.progress).toBe(0.5)
    expect(blended?.fromEra).toBe('2025')
    expect(blended?.toEra).toBe('1945')

    view.unmount()
    expect(world.children).toHaveLength(0)
  })
})
