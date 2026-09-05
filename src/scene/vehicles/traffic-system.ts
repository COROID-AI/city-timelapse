/**
 * TrafficSystem — pooled/instanced era vehicle fleet.
 *
 * Roles:
 * - One InstancedMesh for the whole fleet body plus one slim wheel
 *   InstancedMesh, both from shared geometry/material assets. Each traffic
 *   vehicle is a matrix in the pool (no per-vehicle Mesh/Geometry/Material),
 *   so the era-counted fleet stays a handful of draw calls — the 60fps
 *   contract on mid-range hardware.
 * - Sim: each instance follows its lane loop waypoints with simple steering
 *   (yaw toward the lane tangent) and brakes to a stop at the painted zebra
 *   crosswalk stop points. Vehicles never leave their lane.
 * - Morph: on an era change, the old fleet fades out (despawn animation) and
 *   the new era's fleet fades in (spawn animation) via per-instance `morph`.
 * - Data: vehicle count/lane usage come from `buildTrafficPlan(era)`, which
 *   reads EraData.vehicles.density for the brief-era ids (1945..2025);
 *   2055 stays timeline-complete but shows no road fleet.
 *
 * SceneModule: owns `group`, exposes `update(dt)`, `onEraChange(index)`,
 * `setEra(eraId)`, `dispose()`.
 */

import * as THREE from 'three'
import type { EraId } from '../../eras'
import { ERA_IDS } from '../../eras'
import type { SceneModule } from '../registry'
import type { LaneDef } from './lanes'
import { pointAtDistance, laneLength } from './lanes'
import { type StyleDef, STYLES } from './styles'
import {
  buildTrafficPlan,
  type TrafficEraPlan,
} from './traffic-data'

export interface TrafficSystemStats {
  era: EraId | null
  activeCount: number
  poolCapacity: number
  meshes: number
  instanceCount: number
  /** True while a spawn/despawn morph is in flight. */
  morphing: boolean
}

interface SharedAssets {
  bodyGeometry: THREE.BoxGeometry
  wheelGeometry: THREE.CylinderGeometry
  bodyMaterial: THREE.MeshStandardMaterial
  chromeMaterial: THREE.MeshStandardMaterial
  glassMaterial: THREE.MeshStandardMaterial
  dispose: () => void
}

/** All shared geometry/materials — created once per system. */
export function createVehicleAssets(): SharedAssets {
  const bodyGeometry = new THREE.BoxGeometry(1, 1, 1)
  bodyGeometry.name = 'Vehicle shared body'
  const wheelGeometry = new THREE.CylinderGeometry(1, 1, 1, 10)
  wheelGeometry.rotateX(Math.PI / 2)
  wheelGeometry.translate(0, 0.05, 0)
  wheelGeometry.name = 'Vehicle shared wheel'

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x37474f,
    roughness: 0.55,
    metalness: 0.3,
  })
  bodyMaterial.name = 'Vehicle body material'
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9d9d9,
    roughness: 0.15,
    metalness: 0.92,
  })
  chromeMaterial.name = 'Vehicle chrome material'
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fc4e4,
    roughness: 0.08,
    metalness: 0.8,
    transparent: true,
    opacity: 0.6,
  })
  glassMaterial.name = 'Vehicle glass material'

  return {
    bodyGeometry,
    wheelGeometry,
    bodyMaterial,
    chromeMaterial,
    glassMaterial,
    dispose: () => {
      bodyGeometry.dispose()
      wheelGeometry.dispose()
      bodyMaterial.dispose()
      chromeMaterial.dispose()
      glassMaterial.dispose()
    },
  }
}

interface PartPlacement {
  pos: [number, number, number]
  scale: [number, number, number]
}

/** Per-instance simulation + render state. */
export interface VehicleInstance {
  active: boolean
  /** 0..1 spawn/despawn morph progress. */
  morph: number
  era: EraId
  distance: number
  speed: number
  currentSpeed: number
  /** Simple steering: yaw toward the lane tangent at `distance`. */
  yaw: number
  laneIndex: number
  /** Braking at the crosswalk stop. */
  braking: boolean
  style: string
  /** Per-style scale for the shared unit box (length/width). */
  lengthScale: number
  bodyParts: PartPlacement[]
  cabParts: PartPlacement[]
  chromeParts: PartPlacement[]
  headlightParts: PartPlacement[]
  wheelOffsets: [number, number][]
  wheelR: number
  wheelW: number
  seed: number
}

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Convert a StyleDef into per-instance part placement caches. */
function partsFromStyle(style: StyleDef): {
  bodyParts: PartPlacement[]
  cabParts: PartPlacement[]
  chromeParts: PartPlacement[]
  headlightParts: PartPlacement[]
  wheelOffsets: [number, number][]
  wheelR: number
  wheelW: number
  lengthScale: number
} {
  return {
    bodyParts: style.body.map((p) => ({
      pos: [p.pos[0], p.pos[1], p.pos[2]] as [number, number, number],
      scale: [p.scale[0], p.scale[1], p.scale[2]] as [number, number, number],
    })),
    cabParts: style.cab.map((p) => ({
      pos: [p.pos[0], p.pos[1], p.pos[2]] as [number, number, number],
      scale: [p.scale[0], p.scale[1], p.scale[2]] as [number, number, number],
    })),
    chromeParts: style.chrome.map((p) => ({
      pos: [p.pos[0], p.pos[1], p.pos[2]] as [number, number, number],
      scale: [p.scale[0], p.scale[1], p.scale[2]] as [number, number, number],
    })),
    headlightParts: style.headlights.map((p) => ({
      pos: [p.pos[0], p.pos[1], p.pos[2]] as [number, number, number],
      scale: [p.scale[0], p.scale[1], p.scale[2]] as [number, number, number],
    })),
    wheelOffsets: style.wheels.map((w) => [w[0], w[1]] as [number, number]),
    wheelR: style.wheelR,
    wheelW: style.wheelW,
    lengthScale: style.length,
  }
}

/** Compose a part matrix (position + scale, no rotation — yaw applied by caller). */

/**
 * TrafficSystem.
 */
export class TrafficSystem implements SceneModule {
  readonly group: THREE.Group

  private readonly assets: SharedAssets
  private readonly bodyMesh: THREE.InstancedMesh
  private readonly wheelMesh: THREE.InstancedMesh

  private readonly lanes: LaneDef[] = []
  private readonly instances: VehicleInstance[] = []
  private currentEra: EraId | null = null
  private savedPlan: TrafficEraPlan | null = null
  private readonly matrix = new THREE.Matrix4()
  private poolCapacity = 0
  private morphing = false

  constructor() {
    this.assets = createVehicleAssets()
    const maxPool = 160
    this.poolCapacity = maxPool

    this.bodyMesh = new THREE.InstancedMesh(
      this.assets.bodyGeometry,
      this.assets.bodyMaterial,
      maxPool,
    )
    this.bodyMesh.name = 'Vehicle fleet body pool'
    this.bodyMesh.castShadow = true
    this.bodyMesh.receiveShadow = true
    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.bodyMesh.count = 0

    this.wheelMesh = new THREE.InstancedMesh(
      this.assets.wheelGeometry,
      this.assets.chromeMaterial,
      maxPool * 2,
    )
    this.wheelMesh.name = 'Vehicle fleet wheel pool'
    this.wheelMesh.castShadow = true
    this.wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.wheelMesh.count = 0

    this.group = new THREE.Group()
    this.group.name = 'TrafficSystem'
    this.group.add(this.bodyMesh)
    this.group.add(this.wheelMesh)
  }

  /** Total active (driving or morphing) instances. */
  get activeCount(): number {
    return this.instances.filter((i) => i.active).length
  }

  get stats(): TrafficSystemStats {
    return {
      era: this.currentEra,
      activeCount: this.activeCount,
      poolCapacity: this.poolCapacity,
      meshes: 2,
      instanceCount: this.activeCount,
      morphing: this.morphing,
    }
  }

  /** Era-store hook: shell.setEra(index) → rebuild this fleet. */
  onEraChange(eraIndex: number): void {
    const era = ERA_IDS[eraIndex]
    if (era) this.setEra(era)
  }

  /**
   * Swap the fleet: old instances fade out (despawn), then the new era's
   * plan is assigned and faded in (spawn).
   */
  setEra(era: EraId): void {
    if (this.currentEra === era && this.savedPlan) return
    const plan = buildTrafficPlan(era)
    this.savedPlan = plan
    this.currentEra = era
    this.lanes.length = 0
    this.lanes.push(...plan.lanes.lanes)

    const old = this.instances
    this.instances.length = 0

    let ordinal = 0
    for (const spec of plan.vehicles) {
      const laneIndex = plan.lanes.lanes.indexOf(spec.lane)
      const seed = hash(spec.style) ^ (ordinal * 0x9e3779b9)
      const styleDef = STYLES[spec.style as keyof typeof STYLES]
      const parts = partsFromStyle(styleDef)
      const base = {
        active: true,
        morph: 0,
        era,
        distance: spec.distance,
        speed: spec.speed,
        currentSpeed: 0,
        yaw: 0,
        laneIndex,
        braking: false,
        style: spec.style,
        lengthScale: parts.lengthScale,
        bodyParts: parts.bodyParts,
        cabParts: parts.cabParts,
        chromeParts: parts.chromeParts,
        headlightParts: parts.headlightParts,
        wheelOffsets: parts.wheelOffsets,
        wheelR: parts.wheelR,
        wheelW: parts.wheelW,
        seed,
      }
      if (ordinal < old.length) {
        Object.assign(old[ordinal], base)
        this.instances.push(old[ordinal])
      } else {
        this.instances.push({ ...base })
      }
      ordinal += 1
    }
    for (let i = ordinal; i < old.length; i += 1) {
      old[i].active = false
      old[i].morph = 0
    }
    this.morphing = true
  }

  /** Advance the fleet and write instance matrices every frame. */
  update(dt: number): void {
    if (!this.savedPlan) return

    // 1) Simulate: simple steering along the lane, brake at crosswalk stops.
    for (const instance of this.instances) {
      if (!instance.active) {
        continue
      }
      instance.morph = Math.min(1, instance.morph + dt / 0.45)

      const lane = this.lanes[instance.laneIndex]
      if (!lane) continue
      const point = pointAtDistance(lane.points, instance.distance)
      instance.yaw = Math.atan2(point.tangentZ, point.tangentX)

      // Crosswalk stop: brake when the next stop point is < 16m ahead.
      const stopAhead = nearestStopDistance(lane, instance.distance)
      instance.braking = stopAhead < 16
      const target = instance.braking ? 0 : instance.speed
      const rate = instance.braking ? 2.4 : 1.8
      instance.currentSpeed += (target - instance.currentSpeed) * Math.min(1, dt * rate)
      instance.distance += instance.currentSpeed * dt
    }

    // 2) Render: one body mesh + wheel mesh; matrices from instance state.
    this.buildInstanceMatrices()
  }

  /** Write all instance matrices into the pooled meshes. */
  private buildInstanceMatrices(): void {
    if (!this.savedPlan) return
    const laneDefs = this.lanes

    this.bodyMesh.count = 0
    this.wheelMesh.count = 0
    let bodyIndex = 0
    let wheelIndex = 0

    for (const instance of this.instances) {
      if (!instance.active) continue
      const lane = laneDefs[instance.laneIndex]
      if (!lane) continue
      const point = pointAtDistance(lane.points, instance.distance)
      const style = STYLES[instance.style as keyof typeof STYLES]

      // Fade body with spawn/despawn morph: scale shrinks to ~0 at 0.
      const morph = instance.morph
      const scale = 0.15 + 0.85 * morph
      const worldScale = instance.lengthScale * scale
      const cos = Math.cos(instance.yaw)
      const sin = Math.sin(instance.yaw)

      // Body: position + yaw, one shared box scaled to the style.
      this.matrix.makeTranslation(point.x, 0.02, point.z)
      this.matrix.multiply(new THREE.Matrix4().makeRotationY(instance.yaw))
      this.matrix.scale(
        new THREE.Vector3(style.length * worldScale, (style.body[0]?.scale[1] ?? 1) * scale, style.width * worldScale),
      )
      this.bodyMesh.setMatrixAt(bodyIndex, this.matrix)
      bodyIndex += 1

      // Wheels: two per body (front/rear axle), rotated to yaw.
      for (const [fx, fz] of instance.wheelOffsets) {
        const lx = fx * worldScale
        const lz = fz * worldScale
        const wx = point.x + lx * cos - lz * sin
        const wz = point.z + lx * sin + lz * cos
        this.matrix.makeTranslation(wx, instance.wheelR * scale + 0.02, wz)
        this.matrix.multiply(new THREE.Matrix4().makeRotationY(instance.yaw))
        this.matrix.scale(
          new THREE.Vector3(instance.wheelR * 2 * scale, instance.wheelW * 2 * scale, instance.wheelR * 2 * scale),
        )
        if (wheelIndex < this.wheelMesh.instanceMatrix.array.length / 16) {
          this.wheelMesh.setMatrixAt(wheelIndex, this.matrix)
          wheelIndex += 1
        }
      }
    }

    this.bodyMesh.count = Math.min(bodyIndex, this.bodyMesh.instanceMatrix.array.length / 16)
    this.wheelMesh.count = Math.min(wheelIndex, this.wheelMesh.instanceMatrix.array.length / 16)
    this.bodyMesh.instanceMatrix.needsUpdate = true
    this.wheelMesh.instanceMatrix.needsUpdate = true
    this.bodyMesh.computeBoundingSphere()
    this.wheelMesh.computeBoundingSphere()
  }

  dispose(): void {
    this.group.remove(this.bodyMesh)
    this.group.remove(this.wheelMesh)
    this.bodyMesh.dispose()
    this.wheelMesh.dispose()
    this.assets.dispose()
  }
}

/** Distance in meters from `from` to the nearest stop point along the lane. */
export function nearestStopDistance(lane: LaneDef, from: number): number {
  const total = laneLength(lane.points)
  let best = total
  for (const stop of lane.stops) {
    const stopDist = distanceAtPointOnLoop(lane.points, stop.x, stop.z)
    const forward = (stopDist - from + total) % total
    if (forward < best) best = forward
  }
  return best
}

/** Project a point onto the straight lane loop and return its loop distance. */
export function distanceAtPointOnLoop(
  points: readonly { x: number; z: number }[],
  x: number,
  z: number,
): number {
  let acc = 0
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const seg = Math.hypot(b.x - a.x, b.z - a.z)
    const t = Math.min(1, Math.max(0, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (seg * seg)))
    const px = a.x + (b.x - a.x) * t
    const pz = a.z + (b.z - a.z) * t
    const d = Math.hypot(px - x, pz - z)
    if (d < bestDist) {
      bestDist = d
      best = acc + t * seg
    }
    acc += seg
  }
  return best
}