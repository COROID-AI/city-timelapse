import * as THREE from 'three'
import type { EraId } from '../eras'
import { ERA_IDS } from '../eras'
import type { EraData } from '../era-data'
import { getEraData } from '../era-data'
import type { SceneModule } from './registry'

/**
 * CityBlock — the physical block layout.
 *
 * The district around the origin is one city block: a 100×100 plot area
 * subdivided into 4×2 plot slots, surrounded by a sidewalk-and-road ring
 * (two-lane streets with dashed center dividers and solid lane edges),
 * zebra crosswalks at the four street sides, and street lamps along the
 * inner sidewalk perimeter.
 *
 * The layout is data-driven from `EraData` (src/era-data.ts): road /
 * sidewalk / curb / crosswalk colors, lane-marking paint, lamp pole height,
 * lamp head color and lamp head intensity all reconfigure when the era
 * store emits a change. Plot slots are canonical and never move, so
 * building, storefront and vehicle tasks snap into the same slot ids on
 * every era.
 *
 * Performance: the entire layout is instanced from shared resources. Nine
 * shared BufferGeometries feed nine InstancedMeshes and eight shared
 * materials; placeholder slabs share one box geometry and one facade
 * material. No draw call is per-slot.
 */

/** World units — public so camera/lighting tasks can frame the block. */
export const BLOCK_WORLD_HALF_EXTENT = 50
export const BLOCK_WORLD_EXTENT = BLOCK_WORLD_HALF_EXTENT * 2

export const ROAD_WIDTH = 16
export const ROAD_GRID_LENGTH = 170
export const ROAD_GRID_WIDTH = 110

export const SIDEWALK_WIDTH = 6

/** Half of the road width, used across the layout math. */
export const ROAD_HALF = ROAD_WIDTH / 2
/** Center of the inner sidewalk band (adjacent to the block edge). */
export const SIDEWALK_INNER_CENTER = BLOCK_WORLD_HALF_EXTENT + SIDEWALK_WIDTH / 2
/** Center of the outer sidewalk band (after the road). */
export const SIDEWALK_OUTER_CENTER = BLOCK_WORLD_HALF_EXTENT + ROAD_WIDTH + SIDEWALK_WIDTH / 2
/** Road center line — halfway across the street ring. */
export const STREET_CENTER = BLOCK_WORLD_HALF_EXTENT + SIDEWALK_WIDTH + ROAD_WIDTH / 2

export const PLOT_COLS = 4
export const PLOT_ROWS = 2
export const PLOT_GAP = 0.8

/** Ground Y offsets keep flat layers from z-fighting. */
const Y_ROAD = 0.01
const Y_DASH = 0.02
const Y_EDGE = 0.021
const Y_SIDEWALK = 0.03
const Y_CURB = 0.04
const Y_CROSSWALK = 0.045

const LAMP_POLE_DIAMETER = 0.34
const LAMP_BASE_DIAMETER = 1.2
const LAMP_HEAD_DIAMETER = 0.9
/** Tilt applied to lamp heads on east/west sides (toward the street). */
const LAMP_HEAD_ROTATION_X = 0.35

/** Canonical plot slots — buildings/storefronts/vehicles snap in here. */
export interface PlotSlot {
  /** Stable id: `plot-{row}-{col}` — never changes across eras. */
  id: string
  row: number
  col: number
  /** Slot rectangle world center. */
  x: number
  z: number
  width: number
  depth: number
  /** 1 = full-width facade; 0.6 = corner lots get a slimmer footprint. */
  facingScale: number
}

/** Street furniture canonical positions (lamps, benches, hydrants, trees). */
export interface StreetFurnitureSlot {
  id: string
  x: number
  z: number
  /** 0..1 position along the sidewalk band. */
  u: number
  side: 'north' | 'east' | 'south' | 'west'
}

export interface CrosswalkDescriptor {
  /** Cluster center world position (on the street center line). */
  x: number
  z: number
  /** 0 = zebra bars run parallel to X; 90 = bars parallel to Z. */
  axis: 0 | 90
  /** Number of painted bars in the cluster. */
  barCount: number
}

/** The full static layout contract exposed for downstream era-content tasks. */
export interface CityBlockLayoutData {
  worldHalfExtent: number
  worldExtent: number
  roadWidth: number
  roadGridLength: number
  roadGridWidth: number
  sidewalkWidth: number
  sidewalkInnerCenter: number
  sidewalkOuterCenter: number
  streetCenter: number
  crosswalks: readonly CrosswalkDescriptor[]
  /** Canonical plot slots — buildings/storefronts/vehicles snap in here. */
  plots: readonly PlotSlot[]
  /** Street furniture slots (lamps rendered; benches/trees snap later). */
  streetFurniture: readonly StreetFurnitureSlot[]
  plotsPerRow: number
  plotWidth: number
  plotDepth: number
}

export interface CityBlockStats {
  meshes: number
  instancedMeshes: number
  instanceCount: number
  geometryCount: number
  materialCount: number
  era: EraId | null
}

/** Position/scale of an instantiated box geometry in world space. */
export interface InstancePlacement {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rx?: number
  ry?: number
  rz?: number
}

type MeshKind =
  | 'road'
  | 'dashes'
  | 'laneEdges'
  | 'sidewalk'
  | 'curb'
  | 'crosswalk'
  | 'lampPole'
  | 'lampBase'
  | 'lampHead'

const TEMP_MATRIX = new THREE.Matrix4()
const TEMP_QUAT = new THREE.Quaternion()
const TEMP_SCALE = new THREE.Vector3()
const TEMP_POSITION = new THREE.Vector3()

function matrixFromPlacement(out: THREE.Matrix4, placement: InstancePlacement): THREE.Matrix4 {
  TEMP_QUAT.setFromEuler(
    new THREE.Euler(placement.rx ?? 0, placement.ry ?? 0, placement.rz ?? 0),
  )
  out.compose(
    TEMP_POSITION.set(placement.x, placement.y, placement.z),
    TEMP_QUAT,
    TEMP_SCALE.set(placement.sx, placement.sy, placement.sz),
  )
  return out
}

function applyInstanceMatrix(
  mesh: THREE.InstancedMesh,
  placements: readonly InstancePlacement[],
): void {
  const count = Math.min(mesh.count, placements.length)
  for (let i = 0; i < count; i++) {
    matrixFromPlacement(TEMP_MATRIX, placements[i])
    mesh.setMatrixAt(i, TEMP_MATRIX)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

function makeGeometry(name: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = make()
  geometry.name = name
  geometry.computeVertexNormals()
  return geometry
}

/** Flat ground geometry rotated once so scaling maps to world XZ extents. */
function flatPlane(width: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth)
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Build the shared geometry + material assets. Four base materials (road,
 * sidewalk, curb, crosswalk) plus clones for dashes, lane edges and lamp
 * poles (so era recoloring never mutates a shared surface) and one emissive
 * lamp-head material.
 */
export function createLayoutAssets(): {
  geometries: Record<MeshKind, THREE.BufferGeometry>
  baseMaterials: {
    road: THREE.MeshStandardMaterial
    sidewalk: THREE.MeshStandardMaterial
    curb: THREE.MeshStandardMaterial
    crosswalk: THREE.MeshStandardMaterial
  }
  dashMaterial: THREE.MeshStandardMaterial
  edgeMaterial: THREE.MeshStandardMaterial
  lampPoleMaterial: THREE.MeshStandardMaterial
  lampHeadMaterial: THREE.MeshBasicMaterial
  dispose: () => void
} {
  const geometries: Record<MeshKind, THREE.BufferGeometry> = {
    road: makeGeometry('Layout road', () => flatPlane(1, 1)),
    dashes: makeGeometry('Layout dashed divider', () => flatPlane(1, 1)),
    laneEdges: makeGeometry('Layout lane edge', () => flatPlane(0.2, 1)),
    sidewalk: makeGeometry('Layout sidewalk', () => flatPlane(1, 1)),
    curb: makeGeometry('Layout curb', () => flatPlane(0.5, 1)),
    crosswalk: makeGeometry('Layout crosswalk bar', () => flatPlane(1, 1)),
    lampPole: makeGeometry('Layout lamp pole', () => new THREE.CylinderGeometry(0.06, 0.075, 1, 10)),
    lampBase: makeGeometry('Layout lamp base', () => new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12)),
    lampHead: makeGeometry('Layout lamp head', () => new THREE.SphereGeometry(0.15, 10, 8)),
  }

  const road = new THREE.MeshStandardMaterial({
    color: 0x71716a,
    roughness: 0.94,
    metalness: 0.05,
  })
  road.name = 'Layout road surface'
  const sidewalk = new THREE.MeshStandardMaterial({
    color: 0xb8b0a0,
    roughness: 0.92,
    metalness: 0,
  })
  sidewalk.name = 'Layout sidewalk concrete'
  const curb = new THREE.MeshStandardMaterial({
    color: 0x8f887a,
    roughness: 0.88,
    metalness: 0,
  })
  curb.name = 'Layout curb concrete'
  const crosswalkMaterial = new THREE.MeshStandardMaterial({
    color: 0xefe9da,
    roughness: 0.8,
    metalness: 0,
  })
  crosswalkMaterial.name = 'Layout crosswalk paint'

  const dashMaterial = road.clone()
  dashMaterial.name = 'Layout dashed center line'
  const edgeMaterial = road.clone()
  edgeMaterial.name = 'Layout lane edge line'
  const lampPoleMaterial = curb.clone()
  lampPoleMaterial.name = 'Layout lamp pole'
  const lampHeadMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    toneMapped: false,
  })
  lampHeadMaterial.name = 'Layout lamp head light'

  return {
    geometries,
    baseMaterials: { road, sidewalk, curb, crosswalk: crosswalkMaterial },
    dashMaterial,
    edgeMaterial,
    lampPoleMaterial,
    lampHeadMaterial,
    dispose: () => {
      for (const geometry of Object.values(geometries)) geometry.dispose()
      for (const material of [
        road,
        sidewalk,
        curb,
        crosswalkMaterial,
        dashMaterial,
        edgeMaterial,
        lampPoleMaterial,
        lampHeadMaterial,
      ]) {
        material.dispose()
      }
    },
  }
}

function buildInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  kind: MeshKind,
  count: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.name = `CityBlock ${kind} instanced`
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return mesh
}

/**
 * CityBlock module. Owns the shared layout assets and the instanced meshes;
 * `setEra()` reconfigures colors, paint and lamp styling from EraData.
 * Representative placeholder slabs per plot slot make "buildings/props snap
 * to plot slots" visible until the building task lands.
 */
export class CityBlock implements SceneModule {
  readonly group: THREE.Group
  readonly layout: CityBlockLayoutData

  private readonly assets: ReturnType<typeof createLayoutAssets>
  private readonly staticPlacements: ReturnType<typeof buildStaticLayoutPlacements>
  private readonly roadMeshes: THREE.InstancedMesh[] = []
  private readonly lampMeshes: THREE.InstancedMesh[] = []
  private readonly placeholderGroup = new THREE.Group()
  private readonly placeholders: THREE.Mesh[] = []
  private preparedEra: EraId | null = null
  private sharedPlaceholderGeometry: THREE.BufferGeometry | null = null
  private sharedPlaceholderMaterial: THREE.MeshStandardMaterial | null = null

  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'CityBlock'

    this.layout = buildBlockLayoutData()
    this.assets = createLayoutAssets()
    this.staticPlacements = buildStaticLayoutPlacements(this.layout)

    const lampCount = this.layout.streetFurniture.length

    // Road / dash / lane-edge / sidewalk / curb / crosswalk instanced meshes.
    this.roadMeshes.push(
      buildInstancedMesh(this.assets.geometries.road, this.assets.baseMaterials.road, 'road', this.staticPlacements.roads.length),
      buildInstancedMesh(this.assets.geometries.dashes, this.assets.dashMaterial, 'dashes', this.staticPlacements.dashes.length),
      buildInstancedMesh(this.assets.geometries.laneEdges, this.assets.edgeMaterial, 'laneEdges', this.staticPlacements.laneEdges.length),
      buildInstancedMesh(this.assets.geometries.sidewalk, this.assets.baseMaterials.sidewalk, 'sidewalk', this.staticPlacements.sidewalks.length),
      buildInstancedMesh(this.assets.geometries.curb, this.assets.baseMaterials.curb, 'curb', this.staticPlacements.curbs.length),
      buildInstancedMesh(this.assets.geometries.crosswalk, this.assets.baseMaterials.crosswalk, 'crosswalk', this.staticPlacements.crosswalks.length),
    )
    for (const mesh of this.roadMeshes) {
      mesh.castShadow = false
      mesh.receiveShadow = true
      this.group.add(mesh)
    }

    // Street lamps: pole + base + emissive head per furniture slot.
    const lampPole = buildInstancedMesh(
      this.assets.geometries.lampPole,
      this.assets.lampPoleMaterial,
      'lampPole',
      lampCount,
    )
    const lampBase = buildInstancedMesh(
      this.assets.geometries.lampBase,
      this.assets.lampPoleMaterial,
      'lampBase',
      lampCount,
    )
    const lampHead = buildInstancedMesh(
      this.assets.geometries.lampHead,
      this.assets.lampHeadMaterial,
      'lampHead',
      lampCount,
    )
    lampPole.castShadow = true
    lampBase.castShadow = true
    lampHead.castShadow = false
    this.lampMeshes.push(lampPole, lampBase, lampHead)
    for (const mesh of this.lampMeshes) this.group.add(mesh)

    this.placeholderGroup.name = 'Placeholder buildings'
    this.group.add(this.placeholderGroup)

    // First era applies all static matrices + placeholder slabs.
    this.setEra('1945')
  }

  get stats(): CityBlockStats {
    let instanceCount = 0
    for (const mesh of this.roadMeshes) instanceCount += mesh.count
    for (const mesh of this.lampMeshes) instanceCount += mesh.count
    return {
      meshes: this.roadMeshes.length + this.lampMeshes.length,
      instancedMeshes: this.roadMeshes.length + this.lampMeshes.length,
      instanceCount,
      geometryCount: Object.keys(this.assets.geometries).length,
      materialCount: 8,
      era: this.preparedEra,
    }
  }

  /** Reconfigure the block appearance from EraData (colors + lamp style). */
  setEra(eraId: EraId): void {
    const data = getEraData(eraId)

    // Ground layers.
    this.assets.baseMaterials.road.color.set(data.lighting.roadSurfaceColor)
    this.assets.baseMaterials.sidewalk.color.set(data.lighting.sidewalkColor)
    this.assets.baseMaterials.curb.color.set(data.lighting.curbColor)
    this.assets.baseMaterials.crosswalk.color.set(data.lighting.crosswalkColor)
    this.assets.dashMaterial.color.set(data.lighting.dashedMarkingColor)
    this.assets.edgeMaterial.color.set(data.lighting.laneMarkingColor)
    this.assets.lampPoleMaterial.color.set(data.lighting.lampPoleColor)

    // Lamp heads: emissive color scaled by the era's head intensity.
    const headColor = new THREE.Color(data.lighting.lampHeadColor)
    headColor.multiplyScalar(Math.min(2.4, data.lighting.lampHeadIntensity * 0.45))
    this.assets.lampHeadMaterial.color.copy(headColor)

    // Static road/lane/sidewalk/crosswalk matrices (same for every era).
    this.applyRoadMatrices()

    // Lamp matrices depend on the era pole height + arm reach/style.
    this.applyLampMatrices(data)

    // Representative placeholder slabs re-stack to the era's heights.
    this.rebuildPlaceholders(data)

    this.preparedEra = eraId
  }

  private applyRoadMatrices(): void {
    const staticRoad = this.staticPlacements
    applyInstanceMatrix(this.roadMeshes[0], staticRoad.roads)
    applyInstanceMatrix(this.roadMeshes[1], staticRoad.dashes)
    applyInstanceMatrix(this.roadMeshes[2], staticRoad.laneEdges)
    applyInstanceMatrix(this.roadMeshes[3], staticRoad.sidewalks)
    applyInstanceMatrix(this.roadMeshes[4], staticRoad.curbs)
    applyInstanceMatrix(this.roadMeshes[5], staticRoad.crosswalks)
  }

  private applyLampMatrices(data: EraData): void {
    const furniture = this.layout.streetFurniture
    const poleHeight = data.lighting.lampHeight
    const armReach = data.lighting.lampArmReach

    const poles: InstancePlacement[] = []
    const bases: InstancePlacement[] = []
    const heads: InstancePlacement[] = []
    for (const slot of furniture) {
      poles.push({
        x: slot.x,
        y: poleHeight / 2,
        z: slot.z,
        sx: LAMP_POLE_DIAMETER,
        sy: poleHeight,
        sz: LAMP_POLE_DIAMETER,
      })
      bases.push({
        x: slot.x,
        y: LAMP_BASE_DIAMETER / 4,
        z: slot.z,
        sx: LAMP_BASE_DIAMETER,
        sy: LAMP_BASE_DIAMETER / 2,
        sz: LAMP_BASE_DIAMETER,
      })
      const towardX = slot.side === 'east' ? -1 : slot.side === 'west' ? 1 : 0
      const towardZ = slot.side === 'north' ? -1 : slot.side === 'south' ? 1 : 0
      const tiltArm = slot.side === 'north' || slot.side === 'south' ? 0 : LAMP_HEAD_ROTATION_X
      heads.push({
        x: slot.x + towardX * armReach,
        y: poleHeight + 0.18,
        z: slot.z + towardZ * armReach,
        sx: LAMP_HEAD_DIAMETER,
        sy: LAMP_HEAD_DIAMETER,
        sz: LAMP_HEAD_DIAMETER,
        rx: tiltArm,
      })
    }
    applyInstanceMatrix(this.lampMeshes[0], poles)
    applyInstanceMatrix(this.lampMeshes[1], bases)
    applyInstanceMatrix(this.lampMeshes[2], heads)
  }

  /** Rebuild the representative per-slot placeholder slabs from EraData. */
  private rebuildPlaceholders(data: EraData): void {
    for (const mesh of this.placeholders) {
      this.placeholderGroup.remove(mesh)
    }
    this.placeholders.length = 0
    if (this.sharedPlaceholderGeometry) this.sharedPlaceholderGeometry.dispose()
    if (this.sharedPlaceholderMaterial) this.sharedPlaceholderMaterial.dispose()

    const facade = new THREE.Color(data.architecture.facadePalette[0])
    const accent = new THREE.Color(data.architecture.accentPalette[0])
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    geometry.name = `Placeholder slab ${data.era}`
    const material = new THREE.MeshStandardMaterial({
      color: facade.getHex(),
      roughness: data.architecture.roughness,
      metalness: data.architecture.metalness,
      emissive: accent.getHex(),
      emissiveIntensity: Math.min(0.6, data.architecture.emissiveIntensity * 0.35),
    })
    material.name = `Placeholder facade ${data.era}`
    this.sharedPlaceholderGeometry = geometry
    this.sharedPlaceholderMaterial = material

    for (let index = 0; index < this.layout.plots.length; index++) {
      const slot = this.layout.plots[index]
      const height = THREE.MathUtils.lerp(
        data.architecture.heightRange[0],
        data.architecture.heightRange[1],
        index / Math.max(1, this.layout.plots.length - 1),
      )
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(slot.x, height / 2, slot.z)
      mesh.scale.set(slot.width * slot.facingScale, height, slot.depth)
      mesh.name = `Placeholder ${slot.id}`
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.placeholders.push(mesh)
      this.placeholderGroup.add(mesh)
    }
  }

  update(): void {
    // The layout is static per era; nothing to animate.
  }

  /** Era-store event hook: shell.setEra(index) → reconfigures this block. */
  onEraChange(eraIndex: number): void {
    const era = ERA_IDS[eraIndex]
    if (era) this.setEra(era)
  }

  dispose(): void {
    for (const mesh of this.roadMeshes) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    for (const mesh of this.lampMeshes) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    for (const mesh of this.placeholders) {
      this.placeholderGroup.remove(mesh)
    }
    if (this.sharedPlaceholderGeometry) this.sharedPlaceholderGeometry.dispose()
    if (this.sharedPlaceholderMaterial) this.sharedPlaceholderMaterial.dispose()
    this.assets.dispose()
  }
}

// ---------------------------------------------------------------------------
// Static layout data + instance placements
// ---------------------------------------------------------------------------

/**
 * Build the canonical CityBlock layout contract. Pure, Three-free so the unit
 * test can assert plot/crosswalk/lamp counts directly.
 */
export function buildBlockLayoutData(): CityBlockLayoutData {
  const half = BLOCK_WORLD_HALF_EXTENT
  const gapRowsTotal = (PLOT_ROWS - 1) * PLOT_GAP
  const gapColsTotal = (PLOT_COLS - 1) * PLOT_GAP
  const plotWidth = (BLOCK_WORLD_EXTENT - gapColsTotal) / PLOT_COLS
  const plotDepth = (BLOCK_WORLD_EXTENT - gapRowsTotal) / PLOT_ROWS

  const plots: PlotSlot[] = []
  for (let row = 0; row < PLOT_ROWS; row++) {
    for (let col = 0; col < PLOT_COLS; col++) {
      const z = (row - (PLOT_ROWS - 1) / 2) * (plotDepth + PLOT_GAP)
      const x = (col - (PLOT_COLS - 1) / 2) * (plotWidth + PLOT_GAP)
      const corner =
        (row === 0 || row === PLOT_ROWS - 1) &&
        (col === 0 || col === PLOT_COLS - 1)
      plots.push({
        id: `plot-${row}-${col}`,
        row,
        col,
        x,
        z,
        width: plotWidth,
        depth: plotDepth,
        facingScale: corner ? 0.6 : 1,
      })
    }
  }

  // Four crosswalk clusters, one per street side of the block.
  const crosswalks: CrosswalkDescriptor[] = [
    { x: -20, z: -STREET_CENTER, axis: 0, barCount: 7 },
    { x: 20, z: STREET_CENTER, axis: 0, barCount: 7 },
    { x: -STREET_CENTER, z: -20, axis: 90, barCount: 7 },
    { x: STREET_CENTER, z: 20, axis: 90, barCount: 7 },
  ]

  // Street lamps along the inner sidewalk perimeter (4 sides × 7 positions).
  const streetFurniture: StreetFurnitureSlot[] = []
  const lampPerSide = 7
  const sides: Array<{
    side: StreetFurnitureSlot['side']
    axis: 'x' | 'z'
    fixed: number
  }> = [
    { side: 'north', axis: 'x', fixed: -SIDEWALK_INNER_CENTER },
    { side: 'south', axis: 'x', fixed: SIDEWALK_INNER_CENTER },
    { side: 'east', axis: 'z', fixed: SIDEWALK_INNER_CENTER },
    { side: 'west', axis: 'z', fixed: -SIDEWALK_INNER_CENTER },
  ]
  for (const side of sides) {
    for (let i = 0; i < lampPerSide; i++) {
      const u = i / (lampPerSide - 1)
      const along = THREE.MathUtils.lerp(-half, half, u)
      const x = side.axis === 'x' ? along : side.fixed
      const z = side.axis === 'x' ? side.fixed : along
      streetFurniture.push({
        id: `lamp-${side.side}-${i}`,
        x,
        z,
        u,
        side: side.side,
      })
    }
  }

  return {
    worldHalfExtent: half,
    worldExtent: BLOCK_WORLD_EXTENT,
    roadWidth: ROAD_WIDTH,
    roadGridLength: ROAD_GRID_LENGTH,
    roadGridWidth: ROAD_GRID_WIDTH,
    sidewalkWidth: SIDEWALK_WIDTH,
    sidewalkInnerCenter: SIDEWALK_INNER_CENTER,
    sidewalkOuterCenter: SIDEWALK_OUTER_CENTER,
    streetCenter: STREET_CENTER,
    crosswalks,
    plots,
    streetFurniture,
    plotsPerRow: PLOT_COLS,
    plotWidth,
    plotDepth,
  }
}

interface StaticLayoutPlacements {
  roads: InstancePlacement[]
  dashes: InstancePlacement[]
  laneEdges: InstancePlacement[]
  sidewalks: InstancePlacement[]
  curbs: InstancePlacement[]
  crosswalks: InstancePlacement[]
}

/** Pure matrix list for the non-lamp layout — identical for every era. */
export function buildStaticLayoutPlacements(
  layout: CityBlockLayoutData,
): StaticLayoutPlacements {
  const roadHalf = layout.roadWidth / 2
  const roadCenterZ = [-layout.streetCenter, layout.streetCenter]
  const roadCenterX = roadCenterZ

  const roads: InstancePlacement[] = []
  for (const cz of roadCenterZ) {
    roads.push({ x: 0, y: Y_ROAD, z: cz - roadHalf / 2, sx: layout.roadGridLength, sy: 1, sz: roadHalf })
    roads.push({ x: 0, y: Y_ROAD, z: cz + roadHalf / 2, sx: layout.roadGridLength, sy: 1, sz: roadHalf })
    roads.push({ x: 0, y: Y_ROAD + 0.004, z: cz, sx: layout.roadGridLength, sy: 1, sz: 1.2 })
  }
  for (const cx of roadCenterX) {
    roads.push({ x: cx - roadHalf / 2, y: Y_ROAD, z: 0, sx: roadHalf, sy: 1, sz: layout.roadGridWidth })
    roads.push({ x: cx + roadHalf / 2, y: Y_ROAD, z: 0, sx: roadHalf, sy: 1, sz: layout.roadGridWidth })
    roads.push({ x: cx, y: Y_ROAD + 0.004, z: 0, sx: 1.2, sy: 1, sz: layout.roadGridWidth })
  }

  // Dashed center lines.
  const dashes: InstancePlacement[] = []
  const dashStep = 15
  const dashHalfLen = 1.5
  for (let x = -layout.roadGridLength / 2 + dashHalfLen; x <= layout.roadGridLength / 2 - dashHalfLen; x += dashStep) {
    for (const cz of roadCenterZ) {
      dashes.push({ x, y: Y_DASH, z: cz, sx: 3, sy: 1, sz: 0.32 })
    }
  }
  for (let z = -layout.roadGridWidth / 2 + dashHalfLen; z <= layout.roadGridWidth / 2 - dashHalfLen; z += dashStep) {
    for (const cx of roadCenterX) {
      dashes.push({ x: cx, y: Y_DASH, z, sx: 0.32, sy: 1, sz: 3 })
    }
  }

  // Solid lane edge lines at ±(roadHalf - 0.55) from the street center.
  const laneEdges: InstancePlacement[] = []
  const edgeOffset = roadHalf - 0.55
  for (const cz of roadCenterZ) {
    laneEdges.push({ x: 0, y: Y_EDGE, z: cz - edgeOffset, sx: layout.roadGridLength, sy: 1, sz: 0.22 })
    laneEdges.push({ x: 0, y: Y_EDGE, z: cz + edgeOffset, sx: layout.roadGridLength, sy: 1, sz: 0.22 })
  }
  for (const cx of roadCenterX) {
    laneEdges.push({ x: cx - edgeOffset, y: Y_EDGE, z: 0, sx: 0.22, sy: 1, sz: layout.roadGridWidth })
    laneEdges.push({ x: cx + edgeOffset, y: Y_EDGE, z: 0, sx: 0.22, sy: 1, sz: layout.roadGridWidth })
  }

  // Sidewalks: inner + outer ring, full street length (8).
  const sidewalks: InstancePlacement[] = []
  for (const cz of roadCenterZ) {
    sidewalks.push({ x: 0, y: Y_SIDEWALK, z: cz - roadHalf - layout.sidewalkWidth / 2, sx: layout.roadGridLength, sy: 1, sz: layout.sidewalkWidth })
    sidewalks.push({ x: 0, y: Y_SIDEWALK, z: cz + roadHalf + layout.sidewalkWidth / 2, sx: layout.roadGridLength, sy: 1, sz: layout.sidewalkWidth })
  }
  for (const cx of roadCenterX) {
    sidewalks.push({ x: cx - roadHalf - layout.sidewalkWidth / 2, y: Y_SIDEWALK, z: 0, sx: layout.sidewalkWidth, sy: 1, sz: layout.roadGridWidth })
    sidewalks.push({ x: cx + roadHalf + layout.sidewalkWidth / 2, y: Y_SIDEWALK, z: 0, sx: layout.sidewalkWidth, sy: 1, sz: layout.roadGridWidth })
  }

  // Curbs: thin raised edge strips at the road edges (8).
  const curbs: InstancePlacement[] = []
  const curbOffset = roadHalf + 0.15
  for (const cz of roadCenterZ) {
    curbs.push({ x: 0, y: Y_CURB, z: cz - curbOffset, sx: layout.roadGridLength, sy: 1, sz: 0.5 })
    curbs.push({ x: 0, y: Y_CURB, z: cz + curbOffset, sx: layout.roadGridLength, sy: 1, sz: 0.5 })
  }
  for (const cx of roadCenterX) {
    curbs.push({ x: cx - curbOffset, y: Y_CURB, z: 0, sx: 0.5, sy: 1, sz: layout.roadGridWidth })
    curbs.push({ x: cx + curbOffset, y: Y_CURB, z: 0, sx: 0.5, sy: 1, sz: layout.roadGridWidth })
  }

  // Zebra crosswalks: bar clusters at the four sides (4 × 7 = 28).
  const crosswalks: InstancePlacement[] = []
  const barSpread = 2.0
  for (const descriptor of layout.crosswalks) {
    for (let k = 0; k < descriptor.barCount; k++) {
      if (descriptor.axis === 0) {
        // Bars run along X; stack along Z across the road.
        const z = descriptor.z - ((descriptor.barCount - 1) / 2) * barSpread + k * barSpread
        crosswalks.push({ x: descriptor.x, y: Y_CROSSWALK, z, sx: 2.4, sy: 1, sz: 0.6 })
      } else {
        // Bars run along Z; stack along X across the road.
        const x = descriptor.x - ((descriptor.barCount - 1) / 2) * barSpread + k * barSpread
        crosswalks.push({ x, y: Y_CROSSWALK, z: descriptor.z, sx: 0.6, sy: 1, sz: 2.4 })
      }
    }
  }

  return { roads, dashes, laneEdges, sidewalks, curbs, crosswalks }
}

// Public constants referenced by the pure builders above are exported at the
// top of the module; no duplicate re-export is emitted here.