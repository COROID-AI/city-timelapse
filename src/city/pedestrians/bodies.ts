/**
 * Instanced three.js figures of the era pedestrian layer.
 *
 * Every person is drawn with eight shared, instanced parts — two legs, two arms,
 * a torso, a head, an optional hat and an optional carried prop — so a crowd of
 * any size costs eight draw calls and one matrix update per part per frame. The
 * figure itself is boxes: no mesh is loaded, nothing is fetched, and the walk
 * cycle comes from {@link posePedestrians}, the layer's single motion model.
 *
 * Distances are the layer's own LOD: the caller passes a distance to the camera
 * and far figures drop to the torso/head pair, which keeps the crowd inside the
 * shared quality budget as the tier falls.
 */

import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
} from 'three'
import type { BlockLayout } from '../layout'
import { posePedestrians } from './crowd'
import { outfitEraData } from './tables'
import type { OutfitSet, PedestrianPlan, PedestrianPose } from './types'

/* -------------------------------------------------------------------------- */
/* Figure geometry                                                            */
/* -------------------------------------------------------------------------- */

/** Nominal figure height the part offsets are authored against, in metres. */
export const FIGURE_HEIGHT_M = 1.8

/** Part offsets from the ground, in figure units (multiplied by height scale). */
const PART_HEIGHT = {
  hips: 0.9,
  shoulders: 1.34,
  torso: 1.05,
  head: 1.63,
  hat: 1.8,
  carried: 0.82,
} as const

/** One instanced part of the figure. */
interface FigurePart {
  readonly name: string
  readonly mesh: InstancedMesh
  readonly geometry: BufferGeometry
  readonly material: MeshStandardMaterial
}

function geometryBox(width: number, height: number, depth: number, pivotBottom = false): BufferGeometry {
  const geometry = new BoxGeometry(width, height, depth)
  if (pivotBottom) {
    geometry.translate(0, -height / 2, 0)
  }
  return geometry
}

function materialOf(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.02 })
}

function makePart(
  name: string,
  geometry: BufferGeometry,
  count: number,
  color: string,
): FigurePart {
  const material = materialOf()
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count))
  mesh.name = name
  mesh.count = count
  mesh.frustumCulled = false
  // One colour per instance: the era's outfit palette tints the shared geometry.
  for (let index = 0; index < count; index += 1) {
    setTint(mesh, index, color)
  }
  if (mesh.instanceColor !== null) {
    mesh.instanceColor.needsUpdate = true
  }
  return { name, mesh, geometry, material }
}

/* -------------------------------------------------------------------------- */
/* Scene object                                                               */
/* -------------------------------------------------------------------------- */

/** What a built crowd measures, for the census and the tests. */
export interface CrowdSceneCounts {
  readonly pedestrians: number
  readonly meshes: number
  readonly instancedMeshes: number
  readonly instances: number
  readonly triangles: number
}

/** A live crowd: the group the host mounts plus its per-frame animation. */
export interface CrowdSceneObject {
  readonly root: Group
  readonly plan: PedestrianPlan
  readonly counts: CrowdSceneCounts
  /** Last posed crowd, for inspection targets and tests. */
  readonly poses: readonly PedestrianPose[]
  /**
   * Re-poses and writes every instance matrix for one clock reading.
   *
   * `distanceM` is the viewer's distance to the crowd: beyond
   * {@link CrowdSceneOptions.lodDistanceM} far figures drop to the torso/head
   * pair, which is the layer's distance-based animation LOD.
   */
  update(clockSec: number, distanceM?: number): void
  dispose(): void
}

/** Options of {@link createCrowdSceneObject}. */
export interface CrowdSceneOptions {
  /** Frozen block whose splines and crosswalks pose the crowd. */
  readonly layout: BlockLayout
  /** Overrides the plan's night state (kept for symmetry with other layers). */
  readonly night?: boolean
  /** Distance beyond which far figures drop to the cheap part set. */
  readonly lodDistanceM?: number
}

const dummy = new Object3D()
dummy.rotation.order = 'YXZ'
const hidden = new Object3D()
hidden.scale.set(0, 0, 0)
hidden.updateMatrix()
const scratchColor = new Color()

/** Writes one instance tint without allocating a `Color` per call. */
function setTint(mesh: InstancedMesh, index: number, colour: string): void {
  scratchColor.set(colour)
  mesh.setColorAt(index, scratchColor)
}

/** Writes the tint of one part, tolerating a missing part descriptor. */
function tintPart(
  parts: readonly FigurePart[],
  partIndex: number,
  index: number,
  colour: string,
): void {
  const part = parts[partIndex]
  if (part !== undefined) {
    setTint(part.mesh, index, colour)
  }
}

function writeMatrix(
  part: FigurePart,
  index: number,
  position: { readonly x: number; readonly y: number; readonly z: number },
  yaw: number,
  pitch: number,
  scale: { readonly x: number; readonly y: number; readonly z: number },
): void {
  dummy.position.set(position.x, position.y, position.z)
  dummy.rotation.set(pitch, yaw, 0)
  dummy.scale.set(scale.x, scale.y, scale.z)
  dummy.updateMatrix()
  part.mesh.setMatrixAt(index, dummy.matrix)
}

function hideInstance(part: FigurePart, index: number): void {
  part.mesh.setMatrixAt(index, hidden.matrix)
}

/** Builds one crowd's group and its animation closure. */
export function createCrowdSceneObject(
  plan: PedestrianPlan,
  options: CrowdSceneOptions,
): CrowdSceneObject {
  const outfit = outfitEraData(plan.eraId)
  const count = plan.pedestrians.length
  const root = new Group()
  root.name = 'era-pedestrians'
  root.userData = { layerId: 'pedestrians', eraId: plan.eraId, outfitEraTag: plan.outfitEraTag }

  const legsGeometry = geometryBox(0.16, 0.9, 0.18, true)
  const armsGeometry = geometryBox(0.13, 0.62, 0.16, true)
  const torsoGeometry = geometryBox(0.46, 0.72, 0.28)
  const headGeometry = geometryBox(0.26, 0.3, 0.26)
  const hatGeometry = geometryBox(0.34, 0.16, 0.34)
  const carriedGeometry = geometryBox(0.26, 0.34, 0.16)

  const parts: FigurePart[] = [
    makePart('crowd:legs-left', legsGeometry, count, '#3a3f4a'),
    makePart('crowd:legs-right', legsGeometry, count, '#3a3f4a'),
    makePart('crowd:arms-left', armsGeometry, count, '#8a8f99'),
    makePart('crowd:arms-right', armsGeometry, count, '#8a8f99'),
    makePart('crowd:torso', torsoGeometry, count, '#8a8f99'),
    makePart('crowd:head', headGeometry, count, '#d8ab84'),
    makePart('crowd:hat', hatGeometry, count, '#6a5a48'),
    makePart('crowd:carried', carriedGeometry, count, '#6a5a48'),
  ]

  // Per-instance tints from the era's outfits.
  for (let index = 0; index < count; index += 1) {
    const person = plan.pedestrians[index]
    const set = outfit.outfits[person?.outfitIndex ?? 0]
    if (set === undefined) {
      continue
    }
    tintPart(parts, 0, index, set.lowerColor)
    tintPart(parts, 1, index, set.lowerColor)
    tintPart(parts, 2, index, set.upperColor)
    tintPart(parts, 3, index, set.upperColor)
    tintPart(parts, 4, index, set.upperColor)
    tintPart(parts, 5, index, set.skinColor)
    tintPart(parts, 6, index, set.accessoryColor)
    tintPart(parts, 7, index, set.accessoryColor)
  }
  for (const part of parts) {
    if (part.mesh.instanceColor !== null) {
      part.mesh.instanceColor.needsUpdate = true
    }
    root.add(part.mesh)
  }

  const legsLeft = parts[0]
  const legsRight = parts[1]
  const armsLeft = parts[2]
  const armsRight = parts[3]
  const torso = parts[4]
  const head = parts[5]
  const hat = parts[6]
  const carried = parts[7]

  let poses: readonly PedestrianPose[] = []
  const lodDistanceM = options.lodDistanceM ?? 120

  function update(clockSec: number, distanceM = 0): void {
    const cheap = distanceM > lodDistanceM
    poses = posePedestrians(plan, options.layout, clockSec)
    for (let index = 0; index < poses.length; index += 1) {
      const pose = poses[index]
      if (pose === undefined) {
        continue
      }
      const set: OutfitSet | undefined = outfit.outfits[pose.outfitIndex]
      const heightScale = pose.heightM / FIGURE_HEIGHT_M
      const build = pose.build
      const swing = pose.waiting ? Math.sin(pose.phase) * 0.12 : Math.sin(pose.phase) * 0.5
      const scale = { x: build, y: heightScale, z: build }
      const at = (offset: number): { readonly x: number; readonly y: number; readonly z: number } => ({
        x: pose.position.x,
        y: pose.position.y + offset * heightScale,
        z: pose.position.z,
      })

      if (torso !== undefined) {
        writeMatrix(torso, index, at(PART_HEIGHT.torso), pose.heading, 0, scale)
      }
      if (head !== undefined) {
        writeMatrix(head, index, at(PART_HEIGHT.head), pose.heading, 0, scale)
      }
      if (legsLeft !== undefined) {
        writeMatrix(legsLeft, index, at(PART_HEIGHT.hips), pose.heading, swing, scale)
      }
      if (legsRight !== undefined) {
        writeMatrix(legsRight, index, at(PART_HEIGHT.hips), pose.heading, -swing, scale)
      }
      if (armsLeft !== undefined) {
        if (cheap) {
          hideInstance(armsLeft, index)
        } else {
          writeMatrix(armsLeft, index, at(PART_HEIGHT.shoulders), pose.heading, -swing * 0.6, scale)
        }
      }
      if (armsRight !== undefined) {
        if (cheap) {
          hideInstance(armsRight, index)
        } else {
          writeMatrix(armsRight, index, at(PART_HEIGHT.shoulders), pose.heading, swing * 0.6, scale)
        }
      }
      if (hat !== undefined) {
        if (!cheap && set !== undefined && set.headwear !== 'none') {
          writeMatrix(hat, index, at(PART_HEIGHT.hat), pose.heading, 0, scale)
        } else {
          hideInstance(hat, index)
        }
      }
      if (carried !== undefined) {
        if (!cheap && set !== undefined && set.carried.length > 0) {
          writeMatrix(carried, index, at(PART_HEIGHT.carried), pose.heading, 0, scale)
        } else {
          hideInstance(carried, index)
        }
      }
    }
    for (const part of parts) {
      part.mesh.instanceMatrix.needsUpdate = true
    }
  }

  const triangles = parts.reduce((total, part) => {
    const positionCount =
      (part.geometry as unknown as { attributes?: { position?: { count: number } } }).attributes
        ?.position?.count ?? 0
    const indexCount = (part.geometry as unknown as { index?: { count: number } | null }).index?.count
    return total + Math.floor((indexCount ?? positionCount) / 3) * count
  }, 0)

  update(0)

  return {
    root,
    plan,
    counts: {
      pedestrians: count,
      meshes: parts.length,
      instancedMeshes: parts.length,
      instances: parts.length * count,
      triangles,
    },
    get poses(): readonly PedestrianPose[] {
      return poses
    },
    update,
    dispose(): void {
      for (const part of parts) {
        part.mesh.dispose()
        part.geometry.dispose()
        part.material.dispose()
      }
      root.clear()
    },
  }
}

/**
 * Cross-dresses a staged crowd change in place.
 *
 * The outgoing crowd shrinks into the pavement while the incoming one rises out
 * of it, so the block reads as the crowd changing period rather than blinking.
 */
export function applyCrowdSwap(
  from: CrowdSceneObject,
  to: CrowdSceneObject,
  mix: number,
): void {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(mix) ? mix : 0))
  from.root.scale.y = Math.max(0.001, 1 - clamped)
  from.root.visible = clamped < 1
  to.root.scale.y = Math.max(0.001, clamped)
  to.root.visible = clamped > 0
}

/** Measures a built crowd group from the scene graph. */
export function summariseCrowdGroup(group: Group): CrowdSceneCounts {
  let meshes = 0
  let instancedMeshes = 0
  let instances = 0
  let triangles = 0
  group.traverse((object) => {
    const mesh = object as InstancedMesh & { readonly isInstancedMesh?: boolean; readonly count?: number }
    if (mesh.isInstancedMesh !== true) {
      return
    }
    meshes += 1
    instancedMeshes += 1
    const count = mesh.count ?? 0
    instances += count
    const positionCount =
      (mesh.geometry as unknown as { attributes?: { position?: { count: number } } }).attributes
        ?.position?.count ?? 0
    const indexCount = (mesh.geometry as unknown as { index?: { count: number } | null }).index?.count
    triangles += Math.floor((indexCount ?? positionCount) / 3) * count
  })
  const first = instances > 0 && meshes > 0 ? Math.round(instances / meshes) : 0
  return {
    pedestrians: first,
    meshes,
    instancedMeshes,
    instances,
    triangles,
  }
}

/** Tints of one outfit, exposed so harness pages can label the demo figures. */
export function outfitTint(set: OutfitSet): readonly string[] {
  return [set.upperColor, set.lowerColor, set.skinColor, set.accessoryColor]
}
