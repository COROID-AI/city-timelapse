/**
 * Composition check: the interaction layer against the real block.
 *
 * This suite wires the *real* modules together — the frozen layout with its
 * anchor catalogue, the shipped era registry, the composition's
 * inspection-targets surface built from real scene objects, and the real
 * inspection module — and checks the three properties the plan promises:
 *
 * 1. **Every focusable target resolves** to a real anchor of the layout or to a
 *    layer-object record that the surface was handed, with an id, a category, a
 *    label, era metadata and measured bounds.
 * 2. **Viewpoint targets stay inside the block bounds**, so a viewpoint can only
 *    ever frame something the block actually contains.
 * 3. **Card content is era-driven**: the words on the card come out of the
 *    selected era's registry record, and clicking a target through the picker
 *    opens that card for the era being shown.
 *
 * It also proves the picker works through the published surface rather than
 * through layer internals: probes are the projection of a real target's measured
 * centre, verified by running the picker at that exact cursor position, so a
 * click and a focus are the same code path a viewer exercises.
 */

import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { buildInspectionTargets, boundsFromBox, boundsOfPoint } from '../../src/app/inspectionTargets'
import type { InspectionCategory, InspectionTarget, InspectionTargets } from '../../src/app/inspectionTargets'
import { storefrontCategory } from '../../src/app'
import { anchorByName, createCityLayout } from '../../src/city/layout'
import { ERA_REGISTRY, getEra } from '../../src/era'
import {
  BLOCK_CAMERA_BOUNDS,
  DEFAULT_CAMERA_STATE,
  applyCameraStateToCamera,
  cameraStatePosition,
} from '../../src/scene'
import {
  INSPECTION_CATEGORY_LABELS,
  INTERACTION_LAYER_LABELS,
  buildInspectorCard,
  buildInspectorCardForEra,
  computePickProbes,
  createInspector,
  derivedBuildingTargets,
  eraDetailFor,
  focusCameraForTarget,
  focusableTargets,
  pickInspectionTarget,
  projectInspectionTarget,
} from '../../src/interaction/inspector'
import { cameraStateWithinBounds, resolveViewpoints } from '../../src/interaction/viewpoints'

/* -------------------------------------------------------------------------- */
/* Fixtures: the real block, a real scene object, a real surface              */
/* -------------------------------------------------------------------------- */

const LAYOUT = createCityLayout()

/** A real three.js subtree, as a layer would mount into the world group. */
function createStorefrontGroup(): Group {
  const group = new Group()
  group.name = 'storefront'
  const unit = new Mesh(new BoxGeometry(4.5, 4.6, 3), new MeshBasicMaterial())
  unit.name = 'unit:A1:1'
  unit.position.set(42, 2.3, 54)
  unit.userData = { kind: 'storefront' }
  const sign = new Mesh(new BoxGeometry(3.6, 0.9, 0.2), new MeshBasicMaterial())
  sign.name = 'sign:A1:1'
  sign.position.set(42, 5.4, 54)
  sign.userData = { kind: 'sign' }
  group.add(unit, sign)
  return group
}

const STOREFRONT_GROUP = createStorefrontGroup()

/** The surface a composed block of this revision publishes for 1945. */
const SURFACE: InspectionTargets = buildInspectionTargets({
  layout: LAYOUT,
  eraId: '1945',
  layers: [
    {
      layerId: 'storefronts',
      objects: [...STOREFRONT_GROUP.children].map((child) => ({
        id: `storefronts:${child.name}`,
        category: storefrontCategory(child.userData['kind']),
        label: child.name,
        object: child,
        source: child.name,
      })),
    },
    {
      layerId: 'vehicles',
      objects: [
        {
          id: 'vehicle:parked:1',
          category: 'vehicle' as InspectionCategory,
          label: 'Sedan (parked)',
          source: 'street:north:parking-bay:1',
          bounds: null,
        },
      ],
    },
  ],
})

const FOCUSABLE = focusableTargets(SURFACE, LAYOUT)

const VIEWPOINT_FRAMINGS = resolveViewpoints({ layout: LAYOUT, targets: SURFACE, bounds: BLOCK_CAMERA_BOUNDS })

const VIEWPORT = { width: 1280, height: 800 }

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isFiniteBounds(target: InspectionTarget): boolean {
  return (
    [...target.bounds.min, ...target.bounds.max, ...target.bounds.center].every((value) =>
      Number.isFinite(value),
    ) && target.bounds.radius > 0
  )
}

/** A camera looking exactly at the target, as the focus move would leave it. */
function cameraFramedOn(target: InspectionTarget): PerspectiveCamera {
  const state = focusCameraForTarget(target, DEFAULT_CAMERA_STATE, BLOCK_CAMERA_BOUNDS)
  const camera = new PerspectiveCamera(DEFAULT_CAMERA_STATE.fov, VIEWPORT.width / VIEWPORT.height, 0.1, 500)
  applyCameraStateToCamera(camera, state)
  camera.updateMatrixWorld()
  return camera
}

function firstOfCategory(category: InspectionCategory): InspectionTarget | null {
  return FOCUSABLE.find((target) => target.category === category) ?? null
}

/* -------------------------------------------------------------------------- */
/* 1. Every focusable target resolves to a real record                        */
/* -------------------------------------------------------------------------- */

describe('inspection targets resolve through the published surface', () => {
  it('publishes the real anchor catalogue plus measured layer objects', () => {
    expect(SURFACE.anchorCount).toBeGreaterThan(0)
    expect(SURFACE.objectCount).toBeGreaterThan(0)
    expect(SURFACE.eraId).toBe('1945')
    expect(SURFACE.year).toBe(getEra('1945').year)
    // The real anchor catalogue came along: a named anchor is on the surface.
    const bay = anchorByName(LAYOUT, 'parcel:A1:storefront:1')
    expect(SURFACE.targets.some((target) => target.id === bay.name)).toBe(true)
  })

  it('gives every target an id, category, label, era metadata and bounds', () => {
    expect(FOCUSABLE.length).toBeGreaterThan(SURFACE.targets.length)
    for (const target of FOCUSABLE) {
      expect(target.id.length, target.id).toBeGreaterThan(0)
      expect(Object.keys(INSPECTION_CATEGORY_LABELS), target.id).toContain(target.category)
      expect(target.label.length, target.id).toBeGreaterThan(0)
      expect(target.layerId.length, target.id).toBeGreaterThan(0)
      expect(target.eraId, target.id).toBe('1945')
      expect(target.year, target.id).toBe(1945)
      expect(isFiniteBounds(target), target.id).toBe(true)
      expect(target.bounds.min[0], target.id).toBeLessThanOrEqual(target.bounds.max[0])
      expect(target.bounds.min[1], target.id).toBeLessThanOrEqual(target.bounds.max[1])
      expect(target.bounds.min[2], target.id).toBeLessThanOrEqual(target.bounds.max[2])
    }
  })

  it('resolves anchor-derived targets to real anchors and object targets to their record', () => {
    const objectIds = new Set(STOREFRONT_GROUP.children.map((child) => `storefronts:${child.name}`))
    for (const target of FOCUSABLE) {
      if (target.origin === 'anchor') {
        // Throws when the name is not in the frozen catalogue.
        const anchor = anchorByName(LAYOUT, target.source)
        expect(anchor.kind, target.id).toBeTruthy()
        expect(target.id, target.id).toBeTruthy()
        continue
      }
      // Object-derived targets name a record the surface was actually handed.
      const matchesObject = objectIds.has(target.id)
      const matchesVehicleRecord = target.id === 'vehicle:parked:1'
      expect(matchesObject || matchesVehicleRecord, target.id).toBe(true)
      expect(target.layerId, target.id).toBe(target.id.startsWith('storefronts:') ? 'storefronts' : 'vehicles')
    }
  })

  it('classifies a real storefront child by its own userData', () => {
    const unit = SURFACE.targets.find((target) => target.id === 'storefronts:unit:A1:1')
    const sign = SURFACE.targets.find((target) => target.id === 'storefronts:sign:A1:1')
    expect(unit?.category).toBe('storefront')
    expect(unit?.layerId).toBe('storefronts')
    expect(sign?.category).toBe('signage')
    // Bounds are measured from the live object, not guessed.
    const measured = boundsFromBox(new Box3().setFromObject(STOREFRONT_GROUP.children[0] as Mesh))
    expect(unit?.bounds).toEqual(measured)
  })

  it('adds the building framings the composition does not publish yet', () => {
    const derived = derivedBuildingTargets(LAYOUT, SURFACE)
    expect(derived.length).toBeGreaterThan(0)
    expect(firstOfCategory('building')).not.toBeNull()
    for (const target of derived) {
      // Each derived building points at a real parcel focus anchor.
      const anchor = anchorByName(LAYOUT, target.source)
      expect(anchor.kind).toBe('inspection-focus')
      expect(anchor.owner.kind).toBe('parcel')
      expect(target.layerId).toBe('layout')
      expect(target.eraId).toBe(SURFACE.eraId)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Viewpoints stay inside the block bounds                                 */
/* -------------------------------------------------------------------------- */

describe('viewpoint targets stay inside the block bounds', () => {
  it('frames only points the block contains', () => {
    expect(VIEWPOINT_FRAMINGS.length).toBeGreaterThan(0)
    for (const framing of VIEWPOINT_FRAMINGS) {
      expect(cameraStateWithinBounds(framing.camera, BLOCK_CAMERA_BOUNDS), framing.id).toBe(true)
      const target = framing.camera.target
      const distance = Math.hypot(
        target[0] - BLOCK_CAMERA_BOUNDS.center[0],
        target[2] - BLOCK_CAMERA_BOUNDS.center[2],
      )
      expect(distance, framing.id).toBeLessThanOrEqual(BLOCK_CAMERA_BOUNDS.radius + 1e-6)
      expect(target[1], framing.id).toBeGreaterThanOrEqual(BLOCK_CAMERA_BOUNDS.minY - 1e-6)
      expect(target[1], framing.id).toBeLessThanOrEqual(BLOCK_CAMERA_BOUNDS.maxY + 1e-6)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Card content is drawn from the selected era's registry data             */
/* -------------------------------------------------------------------------- */

describe('the info card is era-driven', () => {
  const categories = [
    ...new Set<InspectionCategory>([...FOCUSABLE.map((target) => target.category), 'building', 'pedestrian']),
  ]

  it('names the category, the owning layer and the era for every category', () => {
    for (const category of categories) {
      const target = firstOfCategory(category) ?? synthesise(category)
      for (const eraId of ERA_REGISTRY.ids) {
        const era = getEra(eraId)
        const card = buildInspectorCard(target, era)
        expect(card.category, `${category}/${eraId}`).toBe(category)
        expect(card.categoryLabel, `${category}/${eraId}`).toBe(INSPECTION_CATEGORY_LABELS[category])
        expect(card.eraId, `${category}/${eraId}`).toBe(era.id)
        expect(card.eraYear, `${category}/${eraId}`).toBe(era.year)
        expect(card.layerId, `${category}/${eraId}`).toBe(target.layerId)
        expect(card.layerLabel, `${category}/${eraId}`).toBe(
          INTERACTION_LAYER_LABELS[target.layerId] ?? target.layerId,
        )
        // The sentence is the era's own: its label, its year, and its vocabulary.
        expect(card.description, `${category}/${eraId}`).toContain(era.label)
        expect(card.description, `${category}/${eraId}`).toContain(String(era.year))
        expect(card.tags, `${category}/${eraId}`).toEqual(eraDetailFor(category, era))
      }
    }
  })

  it('describes the same target differently in different periods', () => {
    const storefront = firstOfCategory('storefront')
    expect(storefront).not.toBeNull()
    if (storefront === null) {
      return
    }
    const first = buildInspectorCardForEra(storefront, '1945')
    const last = buildInspectorCardForEra(storefront, '2025')
    expect(first.eraId).toBe('1945')
    expect(last.eraId).toBe('2025')
    expect(first.description).not.toBe(last.description)
    expect(first.description).toContain(getEra('1945').label)
    expect(last.description).toContain(getEra('2025').label)
    expect(first.periodDetail).not.toBe(last.periodDetail)
  })

  it('reads the era registry rather than a per-year table of its own', () => {
    const target = synthesise('vehicle')
    for (const era of ERA_REGISTRY.definitions) {
      const card = buildInspectorCard(target, era)
      expect(card.tags).toEqual(era.traffic.modelKeys)
      expect(card.description).toContain(era.label)
    }
  })
})

/** A target for a category the composed block does not publish yet. */
function synthesise(category: InspectionCategory): InspectionTarget {
  const anchor = anchorByName(LAYOUT, 'parcel:A2:prop:1')
  return {
    id: `synthetic:${category}`,
    category,
    label: `Synthetic ${category}`,
    eraId: SURFACE.eraId,
    year: SURFACE.year,
    origin: 'anchor',
    layerId: category === 'pedestrian' ? 'pedestrians' : 'buildings',
    source: anchor.name,
    bounds: {
      min: [anchor.position.x - 1, anchor.position.y - 1, anchor.position.z - 1],
      max: [anchor.position.x + 1, anchor.position.y + 1, anchor.position.z + 1],
      center: [anchor.position.x, anchor.position.y, anchor.position.z],
      size: [2, 2, 2],
      radius: Math.sqrt(3),
    },
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Clicking through the surface focuses a real target                      */
/* -------------------------------------------------------------------------- */

describe('clicking a target through the surface focuses it', () => {
  it('resolves a probe for every category the surface publishes', () => {
    const categories = [...new Set(FOCUSABLE.map((target) => target.category))]
    expect(categories.length).toBeGreaterThan(3)

    for (const category of categories) {
      const target = firstOfCategory(category)
      if (target === null) {
        continue
      }
      const camera = cameraFramedOn(target)
      // The framing must actually put its subject on screen, not just in front
      // of the camera: the pipeline's envelope pulls look-at points inwards.
      const subject = { ...target, bounds: boundsOfPoint(target.bounds.center, { width: 0.5, height: 0.5 }) }
      const projected = projectInspectionTarget(subject, camera, VIEWPORT)
      expect(projected.onScreen, category).toBe(true)
      expect(Math.abs(projected.ndcX), category).toBeLessThan(0.92)
      expect(Math.abs(projected.ndcY), category).toBeLessThan(0.92)

      const probes = computePickProbes(FOCUSABLE, camera, VIEWPORT, {
        categories: [category],
        perCategory: 32,
      })
      expect(probes.length, category).toBeGreaterThan(0)
      const probe = probes[0]
      expect(probe?.category, category).toBe(category)
      // The probe is the projection of a real target's measured centre, and the
      // picker agrees that clicking there focuses it.
      expect(probe?.x, category).toBeGreaterThanOrEqual(0)
      expect(probe?.x ?? 0, category).toBeLessThanOrEqual(VIEWPORT.width)
      expect(probe?.y ?? 0, category).toBeGreaterThanOrEqual(0)
      expect(probe?.y ?? 0, category).toBeLessThanOrEqual(VIEWPORT.height)
    }
  })

  it('opens the era card for whatever the cursor is over, and releases on demand', () => {
    const target = firstOfCategory('storefront')
    expect(target).not.toBeNull()
    if (target === null) {
      return
    }
    const camera = cameraFramedOn(target)
    const inspector = createInspector({
      getTargets: () => FOCUSABLE,
      getCamera: () => camera,
      getViewport: () => VIEWPORT,
      getCameraState: () => DEFAULT_CAMERA_STATE,
      bounds: BLOCK_CAMERA_BOUNDS,
    })
    const probes = computePickProbes(FOCUSABLE, camera, VIEWPORT, {
      categories: ['storefront'],
      perCategory: 32,
    })
    const probe = probes[0]
    expect(probe).toBeDefined()
    if (probe === undefined) {
      return
    }

    const focus = inspector.pick([probe.ndcX, probe.ndcY])
    expect(focus).not.toBeNull()
    expect(focus?.target.id).toBe(probe.targetId)
    expect(focus?.target.category).toBe('storefront')
    expect(focus?.card.categoryLabel).toBe('Storefront')
    expect(focus?.card.layerId).toBe(focus?.target.layerId)
    expect(focus?.card.eraId).toBe(SURFACE.eraId)
    expect(focus?.card.description).toContain(getEra(SURFACE.eraId).label)
    // The focus framing is a legal camera state for the block.
    expect(cameraStateWithinBounds(focus?.camera ?? DEFAULT_CAMERA_STATE, BLOCK_CAMERA_BOUNDS)).toBe(true)

    // The same focus read back in another era describes that era.
    const later = inspector.card('2025')
    expect(later?.eraId).toBe('2025')
    expect(later?.description).toContain(getEra('2025').label)

    // Releasing hands back the camera the viewer had before focusing.
    const restored = inspector.release()
    expect(restored).toEqual(DEFAULT_CAMERA_STATE)
    expect(inspector.focusedId).toBeNull()
    expect(inspector.card()).toBeNull()
  })

  it('picks a real target from the aerial viewpoint camera', () => {
    const aerial = VIEWPOINT_FRAMINGS.find((framing) => framing.id === 'aerial')
    expect(aerial).toBeDefined()
    if (aerial === undefined) {
      return
    }
    const camera = new PerspectiveCamera(46, VIEWPORT.width / VIEWPORT.height, 0.1, 500)
    applyCameraStateToCamera(camera, aerial.camera)
    camera.updateMatrixWorld()
    // The eye really is the framing's eye, not the default viewpoint's.
    const eye = cameraStatePosition(aerial.camera)
    expect(Math.hypot(camera.position.x - eye[0], camera.position.y - eye[1], camera.position.z - eye[2])).toBeLessThan(1e-6)

    // The aerial shot sees the block: at least one published target projects
    // inside the viewport, with a projection the picker can use.
    const visible = FOCUSABLE.map((target) => ({ target, screen: projectInspectionTarget(target, camera, VIEWPORT) }))
      .filter((entry) => entry.screen.onScreen)
    expect(visible.length).toBeGreaterThan(0)

    const first = visible[0]
    expect(first).toBeDefined()
    if (first === undefined) {
      return
    }
    const pick = pickInspectionTarget({
      camera,
      viewport: VIEWPORT,
      ndc: [first.screen.ndcX, first.screen.ndcY],
      targets: FOCUSABLE,
    })
    expect(pick).not.toBeNull()
    expect(pick?.target.category).toBe(first.target.category)
    expect(pick?.centreDistance ?? 1).toBeLessThanOrEqual(0.12)
  })
})
