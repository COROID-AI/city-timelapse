/**
 * three.js bridge of the vehicle layer: the only file here that imports the
 * renderer library.
 *
 * Vehicle models are procedural low-poly assemblies described as primitive
 * parts (see `tables.ts`); this module bakes each part into a geometry that is
 * already translated and rotated into its place inside the model, so a whole
 * model variant needs one {@link THREE.InstancedMesh} per part. Instances of
 * the same model and paint colour therefore share geometry and material, and a
 * frame costs one matrix per vehicle per part — no per-vehicle object graph.
 *
 * Road markings arrive as flat, engine-agnostic piece data and are merged into
 * one mesh per (group, colour, paint style) bucket, which keeps the paint at a
 * handful of draw calls.
 *
 * Nothing here reads a clock or a random source: the owner drives it with the
 * pure poses from `traffic.ts`.
 */

import * as THREE from 'three'
import { mergeMarkingPieces } from './markings'
import type {
  EraVehiclePlan,
  MarkingGeometry,
  MarkingPiece,
  ParkedVehicle,
  VehicleModelSpec,
  VehiclePartSpec,
  VehiclePose,
} from './types'

/** Material role a part renders with. */
type MaterialKey = 'glass' | 'trim' | 'tire' | 'sign' | 'metal' | 'headlampOn' | 'headlampOff' | 'taillampOn' | 'taillampOff' | 'glow'

/** Materials of one scene object; lamp materials follow the plan's light state. */
export interface VehicleMaterials {
  readonly body: (paint: string) => THREE.MeshStandardMaterial
  readonly fixed: Readonly<Record<Exclude<MaterialKey, 'headlampOn' | 'headlampOff' | 'taillampOn' | 'taillampOff'>, THREE.MeshStandardMaterial>>
  readonly headlamp: THREE.MeshStandardMaterial
  readonly taillamp: THREE.MeshStandardMaterial
  /** True when the plan lights its fleet at all. */
  readonly lampsLit: boolean
  readonly dispose: () => void
}

function material(parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(parameters)
}

/** Builds the materials of one plan (body colours are created on demand). */
export function createVehicleMaterials(plan: EraVehiclePlan): VehicleMaterials {
  const created: THREE.Material[] = []
  const bodies = new Map<string, THREE.MeshStandardMaterial>()
  const track = <T extends THREE.Material>(item: T): T => {
    created.push(item)
    return item
  }
  const lampsLit = plan.lights.headlampIntensity > 0
  const headlamp = track(
    material(
      lampsLit
        ? {
            color: 0xfff2cf,
            emissive: 0xffe6a8,
            emissiveIntensity: Math.max(0.4, plan.lights.headlampIntensity),
            roughness: 0.22,
            metalness: 0,
          }
        : { color: 0x2b2e33, roughness: 0.35, metalness: 0.1 },
    ),
  )
  const taillamp = track(
    material(
      lampsLit
        ? {
            color: 0xd6372a,
            emissive: 0xff2d16,
            emissiveIntensity: Math.max(0.35, plan.lights.taillampIntensity),
            roughness: 0.3,
            metalness: 0,
          }
        : { color: 0x2a2226, roughness: 0.4, metalness: 0.05 },
    ),
  )

  return {
    body: (paint: string) => {
      const existing = bodies.get(paint)
      if (existing !== undefined) {
        return existing
      }
      const created2 = track(material({ color: new THREE.Color(paint), roughness: 0.42, metalness: 0.2 }))
      bodies.set(paint, created2)
      return created2
    },
    fixed: {
      glass: track(material({ color: 0x1b2630, roughness: 0.16, metalness: 0.25 })),
      trim: track(material({ color: 0x22252a, roughness: 0.55, metalness: 0.35 })),
      tire: track(material({ color: 0x14161a, roughness: 0.9, metalness: 0 })),
      sign: track(material({ color: 0xd9d4c6, roughness: 0.6, metalness: 0.05 })),
      metal: track(material({ color: 0x8b9096, roughness: 0.32, metalness: 0.7 })),
      glow: track(
        material({
          color: 0xffa62b,
          emissive: 0xff8c1a,
          emissiveIntensity: 1.1,
          roughness: 0.4,
          metalness: 0,
        }),
      ),
    },
    headlamp,
    taillamp,
    lampsLit,
    dispose: () => {
      for (const item of created) {
        item.dispose()
      }
      created.length = 0
      bodies.clear()
    },
  }
}

/** Geometry cache key of one primitively described part. */
function partKey(part: VehiclePartSpec): string {
  return [
    part.shape,
    part.size.join(':'),
    part.offset.join(':'),
    part.rotationY ?? 0,
  ].join('|')
}

/** Creates the geometry of a part, already placed in the model's local space. */
function createPartGeometry(part: VehiclePartSpec): THREE.BufferGeometry {
  const [first, second, third] = part.size
  let geometry: THREE.BufferGeometry
  switch (part.shape) {
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(first, first, second, 10, 1)
      break
    case 'sphere':
      geometry = new THREE.SphereGeometry(first, 10, 8)
      break
    case 'wheel':
      geometry = new THREE.CylinderGeometry(first, first, second, 12, 1)
      geometry.rotateZ(Math.PI / 2)
      break
    case 'box':
    default:
      geometry = new THREE.BoxGeometry(first, second, third)
      break
  }
  if (part.rotationY !== undefined && part.rotationY !== 0) {
    geometry.rotateY(part.rotationY)
  }
  geometry.translate(part.offset[0], part.offset[1], part.offset[2])
  geometry.computeBoundingSphere()
  return geometry
}

/** Material a part renders with. */
function materialForPart(
  part: VehiclePartSpec,
  paint: string,
  materials: VehicleMaterials,
): THREE.MeshStandardMaterial {
  switch (part.colourKey) {
    case 'paint':
      return materials.body(paint)
    case 'glass':
      return materials.fixed.glass
    case 'trim':
      return materials.fixed.trim
    case 'tire':
      return materials.fixed.tire
    case 'sign':
      return materials.fixed.sign
    case 'metal':
      return materials.fixed.metal
    case 'glow':
      return materials.fixed.glow
    case 'headlamp':
      return materials.headlamp
    case 'taillamp':
      return materials.taillamp
  }
}

/** One instanced model variant: a model and paint colour shared by many vehicles. */
export interface VariantInstances {
  readonly key: string
  readonly modelKey: string
  readonly paint: string
  readonly count: number
  /** Instanced meshes of this variant, one primitive each. */
  readonly meshes: readonly THREE.InstancedMesh[]
  /** Number of triangles the variant renders at full occupancy. */
  readonly triangles: number
}

interface VariantPartEntry {
  readonly part: VehiclePartSpec
  readonly mesh: THREE.InstancedMesh
}

interface VariantWriter {
  readonly instances: VariantInstances
  readonly parts: readonly VariantPartEntry[]
  write: (index: number, pose: VehiclePose) => void
  hide: (index: number) => void
}

const UP = new THREE.Vector3(0, 1, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)
const HIDDEN_MATRIX = new THREE.Matrix4().compose(ORIGIN, new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))

/** Groups a fleet by `model + paint`, the granularity instancing works at. */
export function instanceVariantKey(modelKey: string, paint: string): string {
  return `${modelKey}|${paint}`
}

function createVariantWriter(
  model: VehicleModelSpec,
  paint: string,
  count: number,
  materials: VehicleMaterials,
  caches: {
    readonly geometry: Map<string, THREE.BufferGeometry>
    readonly created: THREE.BufferGeometry[]
  },
): VariantWriter {
  const parts: VariantPartEntry[] = []
  let triangles = 0
  for (const part of model.parts) {
    const key = partKey(part)
    let geometry = caches.geometry.get(key)
    if (geometry === undefined) {
      geometry = createPartGeometry(part)
      caches.geometry.set(key, geometry)
      caches.created.push(geometry)
    }
    const mesh = new THREE.InstancedMesh(geometry, materialForPart(part, paint, materials), count)
    mesh.name = `${model.key}:${part.name}`
    mesh.userData['modelKey'] = model.key
    mesh.userData['part'] = part.name
    mesh.userData['role'] = part.role
    mesh.castShadow = part.role === 'body' || part.role === 'trim'
    mesh.frustumCulled = false
    const index = geometry.getIndex()
    const vertexCount = index !== null ? index.count : (geometry.getAttribute('position')?.count ?? 0)
    triangles += (vertexCount / 3) * count
    // Start with every instance collapsed, so a freshly built scene never shows
    // a vehicle at the world origin before the first pose update.
    const hidden = new THREE.Matrix4().compose(ORIGIN, new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
    for (let slot = 0; slot < count; slot += 1) {
      mesh.setMatrixAt(slot, hidden)
    }
    mesh.instanceMatrix.needsUpdate = true
    parts.push({ part, mesh })
  }

  const instances: VariantInstances = {
    key: instanceVariantKey(model.key, paint),
    modelKey: model.key,
    paint,
    count,
    meshes: parts.map((entry) => entry.mesh),
    triangles,
  }

  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()

  return {
    instances,
    parts,
    write: (slot, pose) => {
      quaternion.setFromAxisAngle(UP, pose.headingRad)
      position.set(pose.position.x, pose.position.y, pose.position.z)
      scale.set(pose.scale, pose.scale, pose.scale)
      matrix.compose(position, quaternion, scale)
      const lit = pose.lamps.indicator
      for (const entry of parts) {
        const visible = entry.part.role !== 'glow' || lit
        entry.mesh.setMatrixAt(slot, visible ? matrix : HIDDEN_MATRIX)
        entry.mesh.instanceMatrix.needsUpdate = true
      }
    },
    hide: (slot) => {
      for (const entry of parts) {
        entry.mesh.setMatrixAt(slot, HIDDEN_MATRIX)
        entry.mesh.instanceMatrix.needsUpdate = true
      }
    },
  }
}

/** Marking meshes of a plan, merged per group and paint style. */
export interface BuiltMarkings {
  readonly root: THREE.Group
  readonly groupNames: readonly string[]
  readonly meshCount: number
  readonly triangles: number
  readonly dispose: () => void
}

/**
 * Merges the marking pieces into one mesh per (group, colour, style) bucket.
 *
 * The buckets keep the named marking groups intact — the harness and the tests
 * address `marking:<group>` meshes — while a whole street of dashes costs a
 * single draw call.
 */
export function buildMarkingObject(geometry: MarkingGeometry): BuiltMarkings {
  const root = new THREE.Group()
  root.name = 'vehicles:markings'
  const createdGeometries: THREE.BufferGeometry[] = []
  const createdMaterials: THREE.Material[] = []
  const buckets = new Map<string, MarkingPiece[]>()
  for (const piece of geometry.pieces) {
    const key = `${piece.group}|${piece.colour}|${piece.raised ? 'raised' : 'paint'}|${piece.opacity.toFixed(2)}`
    const bucket = buckets.get(key)
    if (bucket === undefined) {
      buckets.set(key, [piece])
    } else {
      bucket.push(piece)
    }
  }

  let triangles = 0
  for (const [key, pieces] of buckets) {
    const merged = mergeMarkingPieces(pieces)
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(merged.positions, 3))
    buffer.setIndex(merged.indices)
    buffer.computeVertexNormals()
    buffer.computeBoundingSphere()
    const first = pieces[0]
    if (first === undefined) {
      continue
    }
    buffer.name = key
    const paint = new THREE.MeshStandardMaterial({
      color: new THREE.Color(first.colour),
      roughness: first.raised ? 0.4 : 0.72,
      metalness: first.raised ? 0.55 : 0.04,
      transparent: first.opacity < 1,
      opacity: first.opacity,
      depthWrite: first.opacity >= 1,
    })
    createdGeometries.push(buffer)
    createdMaterials.push(paint)
    const mesh = new THREE.Mesh(buffer, paint)
    mesh.name = `marking:${first.group}`
    mesh.userData['group'] = first.group
    mesh.userData['colour'] = first.colour
    mesh.userData['pieces'] = pieces.length
    mesh.userData['raised'] = first.raised
    mesh.receiveShadow = false
    mesh.castShadow = false
    root.add(mesh)
    triangles += merged.indices.length / 3
  }

  const groupNames = uniqueSorted(geometry.pieces.map((piece) => piece.group))
  return {
    root,
    groupNames,
    meshCount: root.children.length,
    triangles,
    dispose: () => {
      for (const item of createdGeometries) {
        item.dispose()
      }
      for (const item of createdMaterials) {
        item.dispose()
      }
      root.clear()
    },
  }
}

function uniqueSorted(items: readonly string[]): string[] {
  return [...new Set(items)].sort()
}

/** Counters of a built vehicle scene, published to harnesses and assertions. */
export interface VehicleSceneCounts {
  readonly movingInstances: number
  readonly parkedInstances: number
  readonly movingVariants: number
  readonly parkedVariants: number
  readonly meshes: number
  readonly triangles: number
  readonly markingGroups: number
  readonly markingMeshes: number
  readonly markingTriangles: number
}

/** The mounted era fleet: instanced vehicles plus the era's road paint. */
export interface VehicleSceneObject {
  readonly root: THREE.Group
  readonly moving: VariantInstances[]
  readonly parked: VariantInstances[]
  readonly markings: BuiltMarkings
  readonly counts: VehicleSceneCounts
  /** Writes the poses of one clock reading into the instance matrices. */
  update: (poses: readonly VehiclePose[]) => void
  /** Releases every geometry and material this object created. */
  dispose: () => void
}

export interface VehicleSceneOptions {
  readonly plan: EraVehiclePlan
  readonly fleet: readonly { readonly modelKey: string; readonly paint: string; readonly model: VehicleModelSpec }[]
  readonly parked: readonly ParkedVehicle[]
  readonly markings: MarkingGeometry
}

/**
 * Builds the complete era fleet: one instanced variant per model and paint
 * colour, one instanced variant per parked model, and the era's paint merged
 * per marking group.
 */
export function createVehicleSceneObject(options: VehicleSceneOptions): VehicleSceneObject {
  const materials = createVehicleMaterials(options.plan)
  const geometryCache = new Map<string, THREE.BufferGeometry>()
  const createdGeometries: THREE.BufferGeometry[] = []
  const caches = { geometry: geometryCache, created: createdGeometries }

  const root = new THREE.Group()
  root.name = 'era-vehicles'
  const movingRoot = new THREE.Group()
  movingRoot.name = 'vehicles:moving'
  const parkedRoot = new THREE.Group()
  parkedRoot.name = 'vehicles:parked'
  root.add(movingRoot, parkedRoot)

  const movingWriters = new Map<string, VariantWriter>()
  const parkedWriters = new Map<string, VariantWriter>()
  const movingIndex = new Map<string, number>()
  const parkedIndex = new Map<string, number>()

  for (const vehicle of options.fleet) {
    const key = instanceVariantKey(vehicle.modelKey, vehicle.paint)
    const current = movingIndex.get(key)
    if (current === undefined) {
      movingIndex.set(key, 1)
      movingWriters.set(key, createVariantWriter(vehicle.model, vehicle.paint, countIn(options.fleet, key), materials, caches))
    } else {
      movingIndex.set(key, current + 1)
    }
  }
  for (const vehicle of options.parked) {
    const key = instanceVariantKey(vehicle.modelKey, vehicle.paint)
    const current = parkedIndex.get(key)
    if (current === undefined) {
      parkedIndex.set(key, 1)
      parkedWriters.set(key, createVariantWriter(vehicle.model, vehicle.paint, countIn(options.parked, key), materials, caches))
    } else {
      parkedIndex.set(key, current + 1)
    }
  }

  for (const writer of movingWriters.values()) {
    for (const mesh of writer.instances.meshes) {
      movingRoot.add(mesh)
    }
  }
  for (const writer of parkedWriters.values()) {
    for (const mesh of writer.instances.meshes) {
      parkedRoot.add(mesh)
    }
  }

  // Parked vehicles stand still: place them once, at their bay.
  const parkedCursor = new Map<string, number>()
  for (const vehicle of options.parked) {
    const key = instanceVariantKey(vehicle.modelKey, vehicle.paint)
    const writer = parkedWriters.get(key)
    if (writer === undefined) {
      continue
    }
    const slot = parkedCursor.get(key) ?? 0
    parkedCursor.set(key, slot + 1)
    if (slot >= writer.instances.count) {
      continue
    }
    writer.write(slot, {
      id: vehicle.id,
      modelKey: vehicle.modelKey,
      class: vehicle.class,
      micro: vehicle.micro,
      laneIndex: 0,
      splineName: 'parked',
      distance: 0,
      position: vehicle.position,
      headingRad: vehicle.headingRad,
      heading: { x: 0, z: 1 },
      speedMps: 0,
      paint: vehicle.paint,
      lengthM: vehicle.lengthM,
      widthM: vehicle.widthM,
      heightM: vehicle.heightM,
      scale: vehicle.scale,
      lamps: vehicle.lamps,
      tags: vehicle.tags,
      model: vehicle.model,
    })
  }

  const markings = buildMarkingObject(options.markings)
  root.add(markings.root)

  const moving = [...movingWriters.values()].map((writer) => writer.instances)
  const parked = [...parkedWriters.values()].map((writer) => writer.instances)
  let meshes = markings.meshCount
  let triangles = markings.triangles
  for (const variant of [...moving, ...parked]) {
    meshes += variant.meshes.length
    triangles += variant.triangles
  }

  return {
    root,
    moving,
    parked,
    markings,
    counts: {
      movingInstances: options.fleet.length,
      parkedInstances: options.parked.length,
      movingVariants: moving.length,
      parkedVariants: parked.length,
      meshes,
      triangles,
      markingGroups: markings.groupNames.length,
      markingMeshes: markings.meshCount,
      markingTriangles: markings.triangles,
    },
    update: (poses) => {
      const cursor = new Map<string, number>()
      for (const pose of poses) {
        const key = instanceVariantKey(pose.modelKey, pose.paint)
        const writer = movingWriters.get(key)
        if (writer === undefined) {
          continue
        }
        const slot = cursor.get(key) ?? 0
        cursor.set(key, slot + 1)
        if (slot < writer.instances.count) {
          writer.write(slot, pose)
        }
      }
      for (const [key, writer] of movingWriters) {
        const used = cursor.get(key) ?? 0
        for (let slot = used; slot < writer.instances.count; slot += 1) {
          writer.hide(slot)
        }
      }
    },
    dispose: () => {
      for (const item of geometryCache.values()) {
        item.dispose()
      }
      geometryCache.clear()
      for (const mesh of [...movingRoot.children, ...parkedRoot.children]) {
        mesh.removeFromParent()
      }
      markings.dispose()
      materials.dispose()
      root.clear()
    },
  }
}

/** How many vehicles of a fleet share one variant key. */
function countIn(
  vehicles: readonly { readonly modelKey: string; readonly paint: string }[],
  key: string,
): number {
  return vehicles.filter((vehicle) => instanceVariantKey(vehicle.modelKey, vehicle.paint) === key).length
}

/** Triangle count of a mounted scene, for budget assertions and reports. */
export function vehicleSceneTriangles(scene: VehicleSceneObject): number {
  return scene.counts.triangles
}

/** Convenience: the marking groups a mounted scene publishes. */
export function markingGroupNames(scene: VehicleSceneObject): string[] {
  return [...scene.markings.groupNames]
}
