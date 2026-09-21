/**
 * The building layer's three.js bridge, its imperative layer object and the
 * React component the scene mounts.
 *
 * Three pieces, in order of dependency:
 *
 * 1. {@link buildBuildingSet} turns one era's deterministic plan
 *    (`massing.ts`) into merged meshes: one buffer per building for the masses,
 *    one for the facades and one for the roof kit, plus one batch per add-on
 *    kind — an `InstancedMesh` once the repetition passes the quality tier's
 *    threshold, individual meshes below it. Draw calls therefore stay around
 *    `3 × buildings + kinds`, well inside the tier budget.
 * 2. {@link createBuildingLayer} is the live layer: a `THREE.Group` named
 *    `city-buildings`, two mounted era sets at most, and the state the scene
 *    reads. {@link applyEra} applies one era instantly (the reduced-motion
 *    path); {@link applyEraTransition} cross-fades, shrinks and grows two eras
 *    for a staged switch. Both are exported from the barrel, so the transition
 *    director never touches layer internals.
 * 3. {@link BuildingsLayer} is the React binding: it adds the layer's root to
 *    the render pipeline's world group and re-applies the era or the blend
 *    whenever its props change, returning no JSX of its own.
 */

import { useEffect, useMemo, type ReactElement } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  Texture,
} from 'three'
import type { EraId } from '../../era'
import { QUALITY_TIERS, type QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'
import { createCityLayout, type BlockLayout } from '../layout'
import { useScenePipeline } from '../../scene'
import { blendBuildingStats, planBuildingSet } from './massing'
import { BUILDING_ERA_IDS, getBuildingTable } from './tables'
import {
  DEFAULT_TEXTURE_FACTORY,
  TEXTURE_SURFACES,
  facadeTextureRequest,
  materialSpecsFor,
  type FacadeTextureFactory,
  type TextureHandle,
  type TextureSurface,
} from './textures'
import type {
  AddOnKind,
  BoxPrimitive,
  BuildingGroup,
  BuildingLayerState,
  BuildingMaterialKey,
  BuildingSetPlan,
  EraTransitionRequest,
  PlacedAddOn,
  QuadPrimitive,
} from './types'
import {
  BUILDING_GROUPS,
  BUILDING_MATERIAL_KEYS,
  INSTANCING_THRESHOLDS,
} from './types'

/* ------------------------------------------------------------------------- *
 * Geometry accumulation
 * ------------------------------------------------------------------------- */

interface Vector {
  readonly x: number
  readonly y: number
  readonly z: number
}

interface Face {
  readonly n: Vector
  readonly u: Vector
  readonly v: Vector
}

/** The six box faces, each with two in-plane axes whose cross product is the normal. */
const BOX_FACES: readonly Face[] = [
  { n: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  { n: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 1, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 1, y: 0, z: 0 } },
  { n: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  { n: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 0, z: -1 }, u: { x: 0, y: 1, z: 0 }, v: { x: 1, y: 0, z: 0 } },
]

/** Accumulates triangles into one non-indexed buffer geometry. */
interface Accumulator {
  addBox(box: BoxPrimitive): void
  addQuad(quad: QuadPrimitive): void
  toGeometry(name: string): BufferGeometry | null
  readonly triangles: number
}

/** Creates a geometry accumulator. */
export function createAccumulator(): Accumulator {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  let triangles = 0

  const pushVertex = (point: Vector, normal: Vector, u: number, v: number): void => {
    positions.push(point.x, point.y, point.z)
    normals.push(normal.x, normal.y, normal.z)
    uvs.push(u, v)
  }

  const pushQuad = (a: Vector, b: Vector, c: Vector, d: Vector, normal: Vector): void => {
    pushVertex(a, normal, 0, 0)
    pushVertex(b, normal, 1, 0)
    pushVertex(c, normal, 1, 1)
    pushVertex(a, normal, 0, 0)
    pushVertex(c, normal, 1, 1)
    pushVertex(d, normal, 0, 1)
    triangles += 2
  }

  return {
    addBox(box: BoxPrimitive): void {
      const hw = box.size.width / 2
      const hh = box.size.height / 2
      const hd = box.size.depth / 2
      const cos = Math.cos(box.rotationY)
      const sin = Math.sin(box.rotationY)
      const point = (face: Face, su: number, sv: number): Vector => {
        const halfN = Math.abs(face.n.x) * hw + Math.abs(face.n.y) * hh + Math.abs(face.n.z) * hd
        const halfU = Math.abs(face.u.x) * hw + Math.abs(face.u.y) * hh + Math.abs(face.u.z) * hd
        const halfV = Math.abs(face.v.x) * hw + Math.abs(face.v.y) * hh + Math.abs(face.v.z) * hd
        const dx = face.n.x * halfN + face.u.x * halfU * su + face.v.x * halfV * sv
        const dy = face.n.y * halfN + face.u.y * halfU * su + face.v.y * halfV * sv
        const dz = face.n.z * halfN + face.u.z * halfU * su + face.v.z * halfV * sv
        return {
          x: box.centre.x + dx * cos + dz * sin,
          y: box.centre.y + dy,
          z: box.centre.z - dx * sin + dz * cos,
        }
      }
      for (const face of BOX_FACES) {
        const normal: Vector = {
          x: face.n.x * cos + face.n.z * sin,
          y: face.n.y,
          z: -face.n.x * sin + face.n.z * cos,
        }
        pushQuad(point(face, 1, -1), point(face, 1, 1), point(face, -1, 1), point(face, -1, -1), normal)
      }
    },
    addQuad(quad: QuadPrimitive): void {
      const n = { x: quad.normal.x, y: 0, z: quad.normal.z }
      const u = { x: 0, y: 1, z: 0 }
      const v = n.x !== 0 ? { x: 0, y: 0, z: n.x } : { x: -n.z, y: 0, z: 0 }
      const halfU = quad.height / 2
      const halfV = quad.width / 2
      const point = (su: number, sv: number): Vector => ({
        x: quad.centre.x + v.x * halfV * sv,
        y: quad.centre.y + u.y * halfU * su,
        z: quad.centre.z + v.z * halfV * sv,
      })
      pushQuad(point(1, -1), point(1, 1), point(-1, 1), point(-1, -1), n)
    },
    toGeometry(name: string): BufferGeometry | null {
      if (triangles === 0) {
        return null
      }
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
      geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
      geometry.computeBoundingSphere()
      geometry.name = name
      return geometry
    },
    get triangles(): number {
      return triangles
    },
  }
}

/* ------------------------------------------------------------------------- *
 * Mounting one era
 * ------------------------------------------------------------------------- */

/** Input of {@link buildBuildingSet}. */
export interface BuildBuildingSetInput {
  readonly layout: BlockLayout
  readonly eraId: EraId
  readonly qualityTier?: QualityTierName
  readonly detail?: number
  readonly seed?: Seed
  /** Injected texture source; defaults to the runtime canvas factory. */
  readonly textureFactory?: FacadeTextureFactory
  /** Overrides the tier's texture resolution. */
  readonly textureSize?: number
}

/** One mounted batch of the layer. */
export interface BuiltBatch {
  readonly name: string
  readonly group: BuildingGroup
  readonly instanced: boolean
  /** Instances (1 for a plain mesh). */
  readonly count: number
  readonly triangles: number
  readonly mesh: Mesh | InstancedMesh
}

/** Counters of a mounted era. */
export interface BuiltBuildingsSummary {
  readonly meshCount: number
  readonly instancedMeshCount: number
  readonly triangleCount: number
  readonly vertexCount: number
  readonly groupMeshCounts: Readonly<Record<BuildingGroup, number>>
  readonly groupTriangles: Readonly<Record<BuildingGroup, number>>
  readonly names: readonly string[]
}

/** The mounted geometry of one era. */
export interface BuiltBuildings {
  readonly eraId: EraId
  readonly plan: BuildingSetPlan
  readonly root: Group
  readonly groups: Readonly<Record<BuildingGroup, Group>>
  readonly materials: Readonly<Record<BuildingMaterialKey, MeshStandardMaterial>>
  readonly textureHandles: readonly TextureHandle[]
  readonly batches: readonly BuiltBatch[]
  readonly summary: BuiltBuildingsSummary
}

function emptyGroupCounts(): Record<BuildingGroup, number> {
  const counts = {} as Record<BuildingGroup, number>
  for (const group of BUILDING_GROUPS) {
    counts[group] = 0
  }
  return counts
}

/**
 * Builds one era's buildings as merged meshes plus batched add-ons.
 *
 * Because both the plan and this bridge read the same primitive lists, the
 * triangle count of the mounted geometry equals
 * {@link BuildingSetPlan.stats}.triangleEstimate and the mesh count equals
 * {@link BuildingSetPlan.stats}.meshCount; the composition suite asserts both.
 */
export function buildBuildingSet(input: BuildBuildingSetInput): BuiltBuildings {
  const tier = input.qualityTier ?? 'high'
  const plan = planBuildingSet({
    layout: input.layout,
    eraId: input.eraId,
    qualityTier: tier,
    detail: input.detail,
    seed: input.seed,
  })
  const table = getBuildingTable(plan.eraId)
  const factory = input.textureFactory ?? DEFAULT_TEXTURE_FACTORY
  const textureSize = input.textureSize ?? QUALITY_TIERS[tier].effects.textureResolution

  // --- procedural materials ---------------------------------------------
  const firstBuilding = plan.plots.find((plot) => plot.state === 'building')
  // Every glazing quad is one storey tall, so the texture carries a single row
  // of windows with the era's column count across it.
  const grid = firstBuilding === undefined ? null : { ...firstBuilding.facade.grid, rows: 1 }
  // Coursing and panel joints are drawn per facade height: masonry courses for
  // the brick eras, one joint per storey for the concrete and glass ones.
  const courses =
    table.facade.masonryCourseHeight !== null
      ? Math.max(8, Math.min(64, Math.round(plan.stats.heightMean / table.facade.masonryCourseHeight)))
      : Math.max(6, Math.min(64, Math.round(plan.stats.floorsMean)))
  const handles: TextureHandle[] = []
  const maps = {} as Record<TextureSurface, Texture | null>
  for (const surface of TEXTURE_SURFACES) {
    const handle = factory.create(
      facadeTextureRequest({ table, surface, grid, size: textureSize, courses }),
    )
    handles.push(handle)
    const payload = handle.payload
    if (payload instanceof Texture) {
      payload.wrapS = RepeatWrapping
      payload.wrapT = RepeatWrapping
    }
    maps[surface] = payload instanceof Texture ? payload : null
  }

  const specs = materialSpecsFor(table)
  const materials = {} as Record<BuildingMaterialKey, MeshStandardMaterial>
  for (const key of BUILDING_MATERIAL_KEYS) {
    const spec = specs[key]
    const map = spec.textureSurface === null ? null : maps[spec.textureSurface]
    const material = new MeshStandardMaterial({
      // A procedural texture already carries the era's colour, so the base
      // colour stays white to avoid darkening the surface twice.
      color: map === null ? spec.color : 0xffffff,
      roughness: spec.roughness,
      metalness: spec.metalness,
      emissive: spec.emissive,
      emissiveIntensity: spec.emissiveIntensity,
      name: key,
    })
    if (map !== null) {
      material.map = map
    }
    materials[key] = material
  }

  // --- scene graph -------------------------------------------------------
  const root = new Group()
  root.name = `era-buildings:${plan.eraId}`
  const groups = {} as Record<BuildingGroup, Group>
  for (const group of BUILDING_GROUPS) {
    const node = new Group()
    node.name = `group:${group}`
    node.userData['group'] = group
    groups[group] = node
    root.add(node)
  }

  const batches: BuiltBatch[] = []
  const addOnBoxes = new Map<AddOnKind, PlacedAddOn[]>()

  const mountMerged = (
    name: string,
    group: BuildingGroup,
    accumulator: Accumulator,
    material: MeshStandardMaterial,
  ): void => {
    const geometry = accumulator.toGeometry(name)
    if (geometry === null) {
      return
    }
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.userData['group'] = group
    mesh.castShadow = true
    mesh.receiveShadow = true
    groups[group].add(mesh)
    batches.push({
      name,
      group,
      instanced: false,
      count: 1,
      triangles: accumulator.triangles,
      mesh,
    })
  }

  for (const plot of plan.plots) {
    if (plot.state === 'building') {
      const massAccumulator = createAccumulator()
      for (const mass of plot.masses) {
        massAccumulator.addBox(mass)
      }
      mountMerged(`building:${plot.parcelId}:mass`, 'masses', massAccumulator, materials.mass)

      const facadeAccumulator = createAccumulator()
      for (const primitive of plot.facade.primitives) {
        if (primitive.kind === 'box') {
          facadeAccumulator.addBox(primitive)
        } else {
          facadeAccumulator.addQuad(primitive)
        }
      }
      mountMerged(`building:${plot.parcelId}:facade`, 'facades', facadeAccumulator, materials.glass)

      const roofAccumulator = createAccumulator()
      for (const primitive of plot.rooftop.primitives) {
        if (primitive.kind === 'box') {
          roofAccumulator.addBox(primitive)
        } else {
          roofAccumulator.addQuad(primitive)
        }
      }
      mountMerged(`building:${plot.parcelId}:roof`, 'roof-kits', roofAccumulator, materials.roof)

      for (const addOn of plot.addOns) {
        const list = addOnBoxes.get(addOn.addOn)
        if (list === undefined) {
          addOnBoxes.set(addOn.addOn, [addOn])
        } else {
          list.push(addOn)
        }
      }
      continue
    }

    const group: BuildingGroup = plot.state === 'vacant-lot' ? 'lots' : 'construction'
    const accumulator = createAccumulator()
    for (const primitive of plot.stateDetail.primitives) {
      if (primitive.kind === 'box') {
        accumulator.addBox(primitive)
      } else {
        accumulator.addQuad(primitive)
      }
    }
    mountMerged(
      plot.state === 'vacant-lot' ? `lot:${plot.parcelId}` : `construction:${plot.parcelId}`,
      group,
      accumulator,
      plot.state === 'vacant-lot' ? materials.lot : materials.construction,
    )
  }

  // --- add-ons: one instanced batch per kind, or individual meshes -------
  const unitBox = new BoxGeometry(1, 1, 1)
  unitBox.name = 'building:unit-box'
  const dummy = new Object3D()
  for (const [kind, boxes] of addOnBoxes) {
    const facadeAttached = boxes[0]?.attach === 'facade'
    const material = facadeAttached ? materials.detail : materials['add-on']
    if (boxes.length >= INSTANCING_THRESHOLDS[tier]) {
      const instanced = new InstancedMesh(unitBox, material, boxes.length)
      instanced.name = `addons:${kind}`
      instanced.userData['group'] = 'add-ons'
      instanced.userData['addOn'] = kind
      instanced.castShadow = true
      instanced.instanceMatrix.setUsage(35048) // THREE.DynamicDrawUsage
      boxes.forEach((box, index) => {
        dummy.position.set(box.centre.x, box.centre.y, box.centre.z)
        dummy.rotation.set(0, box.rotationY, 0)
        dummy.scale.set(box.size.width, box.size.height, box.size.depth)
        dummy.updateMatrix()
        instanced.setMatrixAt(index, dummy.matrix)
      })
      instanced.instanceMatrix.needsUpdate = true
      groups['add-ons'].add(instanced)
      batches.push({
        name: instanced.name,
        group: 'add-ons',
        instanced: true,
        count: boxes.length,
        triangles: 12 * boxes.length,
        mesh: instanced,
      })
      continue
    }
    for (const box of boxes) {
      const mesh = new Mesh(unitBox, material)
      mesh.name = box.id
      mesh.userData['group'] = 'add-ons'
      mesh.userData['addOn'] = kind
      mesh.position.set(box.centre.x, box.centre.y, box.centre.z)
      mesh.rotation.y = box.rotationY
      mesh.scale.set(box.size.width, box.size.height, box.size.depth)
      mesh.castShadow = true
      groups['add-ons'].add(mesh)
      batches.push({
        name: mesh.name,
        group: 'add-ons',
        instanced: false,
        count: 1,
        triangles: 12,
        mesh,
      })
    }
  }

  const groupMeshCounts = emptyGroupCounts()
  const groupTriangles = emptyGroupCounts()
  let triangleCount = 0
  let instancedMeshCount = 0
  let vertexCount = 0
  for (const batch of batches) {
    groupMeshCounts[batch.group] += 1
    groupTriangles[batch.group] += batch.triangles
    triangleCount += batch.triangles
    if (batch.instanced) {
      instancedMeshCount += 1
    }
    vertexCount += batch.mesh.geometry.getAttribute('position').count * (batch.instanced ? batch.count : 1)
  }

  return {
    eraId: plan.eraId,
    plan,
    root,
    groups,
    materials,
    textureHandles: handles,
    batches,
    summary: {
      meshCount: batches.length,
      instancedMeshCount,
      triangleCount,
      vertexCount,
      groupMeshCounts,
      groupTriangles,
      names: batches.map((batch) => batch.name),
    },
  }
}

/* ------------------------------------------------------------------------- *
 * Disposal
 * ------------------------------------------------------------------------- */

/** Releases the geometry, materials and textures of a mounted era. */
export function disposeBuildingSet(built: BuiltBuildings): void {
  const geometries = new Set<BufferGeometry>()
  for (const batch of built.batches) {
    geometries.add(batch.mesh.geometry)
  }
  for (const geometry of geometries) {
    // The shared unit box is used by several batches; disposing once is enough.
    geometry.dispose()
  }
  for (const material of Object.values(built.materials)) {
    material.dispose()
  }
  for (const handle of built.textureHandles) {
    if (handle.payload instanceof Texture) {
      handle.payload.dispose()
    }
  }
  built.root.clear()
}

/* ------------------------------------------------------------------------- *
 * The live layer
 * ------------------------------------------------------------------------- */

/** Options of {@link createBuildingLayer}. */
export interface BuildingLayerOptions {
  readonly layout: BlockLayout
  readonly eraId?: EraId
  readonly qualityTier?: QualityTierName
  readonly textureFactory?: FacadeTextureFactory
  readonly seed?: Seed
  readonly detail?: number
  readonly textureSize?: number
}

/**
 * The live layer.
 *
 * `applyEra` and `applyEraTransition` are the only entry points the transition
 * director needs; everything else is read-only state.
 */
export interface BuildingLayer {
  readonly root: Group
  readonly layout: BlockLayout
  readonly qualityTier: QualityTierName
  readonly textureFactory: FacadeTextureFactory
  readonly seed: Seed
  /** Current era and blend snapshot. */
  state(): BuildingLayerState
  /** Applies one era instantly: the reduced-motion and settled path. */
  applyEra(eraId: EraId): BuildingLayerState
  /** Applies a staged blend between two eras at weight `t`. */
  applyTransition(request: EraTransitionRequest): BuildingLayerState
  /** Mounted era geometry, `from` first. `to` is `null` when settled. */
  mounted(which: 'from' | 'to'): BuiltBuildings | null
  dispose(): void
}

/** Alias of {@link BuildingLayer}: the context `applyEra` acts on. */
export type BuildingLayerContext = BuildingLayer

function anchorOpacity(built: BuiltBuildings): number {
  return built.materials.mass.opacity
}

function setSetOpacity(built: BuiltBuildings, opacity: number): void {
  const value = Math.min(1, Math.max(0, opacity))
  const transparent = value < 1
  for (const material of Object.values(built.materials)) {
    if (material.opacity !== value || material.transparent !== transparent) {
      material.opacity = value
      material.transparent = transparent
      material.depthWrite = !transparent
      material.needsUpdate = true
    }
  }
}

/** Creates a layer that immediately mounts `options.eraId` (default: the first era). */
export function createBuildingLayer(options: BuildingLayerOptions): BuildingLayer {
  const qualityTier = options.qualityTier ?? 'high'
  const textureFactory = options.textureFactory ?? DEFAULT_TEXTURE_FACTORY
  const seed: Seed = options.seed ?? options.layout.seedInput
  const initialEra: EraId = options.eraId ?? BUILDING_ERA_IDS[0] ?? '1945'

  const root = new Group()
  root.name = 'city-buildings'

  const build = (eraId: EraId): BuiltBuildings =>
    buildBuildingSet({
      layout: options.layout,
      eraId,
      qualityTier,
      textureFactory,
      seed: options.seed,
      detail: options.detail,
      textureSize: options.textureSize,
    })

  let fromSet: BuiltBuildings = build(initialEra)
  let toSet: BuiltBuildings | null = null
  let fromEra: EraId = initialEra
  let toEra: EraId = initialEra
  let progress = 0
  let disposed = false

  const mount = (built: BuiltBuildings, scaleY: number, opacity: number): void => {
    setSetOpacity(built, opacity)
    built.root.scale.set(1, Math.max(scaleY, 0.0001), 1)
    built.root.visible = opacity > 0.001
    if (built.root.parent !== root) {
      root.add(built.root)
    }
  }

  const release = (built: BuiltBuildings | null): void => {
    if (built === null) {
      return
    }
    built.root.removeFromParent()
    disposeBuildingSet(built)
  }

  /**
   * Rebuilds a disposed layer.
   *
   * React 18 runs effect cleanups and then re-runs effects, so a mounted layer
   * can be disposed and immediately used again (StrictMode does exactly this).
   * Reviving keeps that path identical to a fresh mount instead of rendering
   * released buffers.
   */
  const revive = (): void => {
    if (!disposed) {
      return
    }
    disposed = false
    fromSet = build(fromEra)
    toSet = null
    progress = 0
    root.clear()
    mount(fromSet, 1, 1)
  }

  const state = (): BuildingLayerState => {
    const blended =
      toSet === null || fromEra === toEra
        ? fromSet.plan.stats
        : blendBuildingStats(fromSet.plan.stats, toSet.plan.stats, progress)
    const dominantTo = toSet !== null && progress >= 0.5
    const dominantSet = dominantTo ? toSet : fromSet
    return {
      eraId: dominantTo ? toEra : fromEra,
      fromEra,
      toEra,
      progress: toSet === null ? 0 : progress,
      transitioning: toSet !== null && fromEra !== toEra && progress < 1,
      night: dominantSet === null ? fromSet.plan.night : dominantSet.plan.night,
      stats: blended,
      mounted: {
        fromMeshes: fromSet.summary.meshCount,
        toMeshes: toSet === null ? 0 : toSet.summary.meshCount,
        fromTriangles: fromSet.summary.triangleCount,
        toTriangles: toSet === null ? 0 : toSet.summary.triangleCount,
        fromScaleY: fromSet.root.scale.y,
        toScaleY: toSet === null ? 0 : toSet.root.scale.y,
        fromOpacity: anchorOpacity(fromSet),
        toOpacity: toSet === null ? 0 : anchorOpacity(toSet),
      },
    }
  }

  const layer: BuildingLayer = {
    root,
    layout: options.layout,
    qualityTier,
    textureFactory,
    seed,
    state,
    mounted: (which) => (which === 'from' ? fromSet : toSet),
    applyEra(eraId: EraId): BuildingLayerState {
      revive()
      if (fromEra === eraId && toSet === null && fromSet.eraId === eraId) {
        return state()
      }
      const built = build(eraId)
      const previousFrom = fromSet
      const previousTo = toSet
      fromSet = built
      toSet = null
      fromEra = eraId
      toEra = eraId
      progress = 0
      release(previousTo)
      release(previousFrom)
      root.clear()
      mount(built, 1, 1)
      return state()
    },
    applyTransition(request: EraTransitionRequest): BuildingLayerState {
      revive()
      const weight = Math.min(1, Math.max(0, request.t))
      if (request.from === request.to) {
        return layer.applyEra(request.to)
      }
      if (fromSet.eraId !== request.from) {
        const previous = fromSet
        fromSet = build(request.from)
        release(previous)
      }
      if (toSet === null || toSet.eraId !== request.to) {
        const previous = toSet
        toSet = build(request.to)
        release(previous)
      }
      fromEra = request.from
      toEra = request.to
      progress = weight
      root.clear()
      mount(fromSet, 1 - weight, 1 - weight)
      mount(toSet, weight, weight)
      return state()
    },
    dispose(): void {
      release(toSet)
      release(fromSet)
      root.clear()
      toSet = null
      disposed = true
    },
  }

  mount(fromSet, 1, 1)
  return layer
}

/* ------------------------------------------------------------------------- *
 * Exported director API
 * ------------------------------------------------------------------------- */

/**
 * Applies one era to a layer instantly.
 *
 * This is the reduced-motion path: the outgoing block is released and the
 * incoming one mounted in the same call, with no blend left in flight.
 */
export function applyEra(eraId: EraId, ctx: BuildingLayerContext): BuildingLayerState {
  return ctx.applyEra(eraId)
}

/**
 * Applies a staged era change to a layer.
 *
 * `t = 0` reports exactly the `from` era, `t = 1` exactly the `to` era, and any
 * value in between mounts both sets with the outgoing one shrinking and fading
 * as the incoming one grows through it.
 */
export function applyEraTransition(
  request: EraTransitionRequest,
  ctx: BuildingLayerContext,
): BuildingLayerState {
  return ctx.applyTransition(request)
}

/* ------------------------------------------------------------------------- *
 * React binding
 * ------------------------------------------------------------------------- */

/** Props of {@link BuildingsLayer}. */
export interface BuildingsLayerProps {
  /** Era to show when no transition is supplied. */
  readonly eraId: EraId
  /** Block to build on; defaults to the canonical layout for `seed`. */
  readonly layout?: BlockLayout
  readonly seed?: Seed
  readonly qualityTier?: QualityTierName
  readonly textureFactory?: FacadeTextureFactory
  readonly detail?: number
  readonly textureSize?: number
  /** Staged blend; when present it wins over `eraId` and drives the cross-fade. */
  readonly transition?: EraTransitionRequest | null
  readonly onState?: (state: BuildingLayerState) => void
  readonly onReady?: (layer: BuildingLayer) => void
}

/**
 * Mounts the building layer into the render pipeline's world group.
 *
 * The component renders no JSX of its own: it owns one {@link BuildingLayer},
 * attaches its root when the pipeline becomes available, applies the era or the
 * blend whenever those props change, and disposes the layer on unmount.
 */
export function BuildingsLayer(props: BuildingsLayerProps): ReactElement | null {
  const pipeline = useScenePipeline()
  const {
    eraId,
    layout,
    seed,
    qualityTier,
    textureFactory,
    detail,
    textureSize,
    transition,
    onState,
    onReady,
  } = props

  const block = useMemo(() => layout ?? createCityLayout(seed), [layout, seed])
  const layer = useMemo(
    () =>
      createBuildingLayer({
        layout: block,
        eraId,
        qualityTier,
        textureFactory,
        seed,
        detail,
        textureSize,
      }),
    // The era is applied imperatively below, so it is intentionally not a
    // dependency: an era change must never rebuild the WebGL resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block, qualityTier, textureFactory, seed, detail, textureSize],
  )

  useEffect(() => {
    pipeline.world.add(layer.root)
    onReady?.(layer)
    return () => {
      layer.root.removeFromParent()
      layer.dispose()
    }
  }, [pipeline, layer, onReady])

  useEffect(() => {
    const next = transition != null ? applyEraTransition(transition, layer) : applyEra(eraId, layer)
    onState?.(next)
  }, [layer, eraId, transition, onState])

  return null
}

/** Options of {@link createBuildingScene}. */
export interface BuildingSceneOptions {
  readonly seed?: Seed
  readonly eraId?: EraId
  readonly qualityTier?: QualityTierName
  readonly textureFactory?: FacadeTextureFactory
  readonly detail?: number
  readonly textureSize?: number
}

/**
 * Generates the real block and mounts the building layer on it.
 *
 * The layer's harness page uses this so per-era browser verification only needs
 * the layer's own barrel — never the composed application.
 */
export function createBuildingScene(options: BuildingSceneOptions = {}): {
  readonly layout: BlockLayout
  readonly layer: BuildingLayer
} {
  const layout = createCityLayout(options.seed)
  const layer = createBuildingLayer({
    layout,
    eraId: options.eraId,
    qualityTier: options.qualityTier,
    textureFactory: options.textureFactory,
    seed: options.seed,
    detail: options.detail,
    textureSize: options.textureSize,
  })
  return { layout, layer }
}

