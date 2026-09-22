/**
 * three.js painter and React host of the era buildings layer.
 *
 * The plan (`massing.ts`) is plain data; this module is the only place that
 * touches the render graph. `createBuildingsGroup` turns one era's plan into a
 * named group tree — one child group per parcel, each holding the mass, the
 * window grid, the facade detail and the roof kit — and the React component
 * mounts the very same builder inside a react-three-fiber host.
 *
 * Group shape (stable, addressed by name):
 *
 * ```text
 * era-buildings
 *   parcel:A1            (userData.kind = 'building' | 'vacant-lot' | 'construction')
 *     mass:A1
 *     windows:A1         (InstancedMesh, one pane per facade window)
 *     facade-detail:A1   (InstancedMesh, bands / mullions / courses / balconies)
 *     structure:A1       (InstancedMesh, exposed frame, when the era has one)
 *     roof:<kind>:A1     (InstancedMesh per roof item kind)
 * ```
 *
 * A staged era change never rebuilds: the outgoing tree shrinks to nothing and
 * the incoming one grows out of the ground
 * ({@link applyProgressiveSwap}), which reads as the block being rebuilt in
 * place. Under reduced motion the director swaps the two groups in one step.
 */

import { useEffect, useMemo, type ReactElement } from 'react'
import {
  BoxGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type Material,
} from 'three'
import { DEFAULT_ERA_ID, type EraId } from '../../era'
import type { QualityTierName } from '../../lib/quality'
import type { Seed } from '../../lib/rng'
import type { BlockLayout, FootprintRect } from '../layout'
import { facadeWindowPlacements, ROOF_ITEM_SIZES, roofItemPlacements } from './facades'
import { applyEra, applyEraTransition } from './massing'
import type { BuildingContext, BuildingInstance, BuildingPlan, BuildingTransitionInput } from './types'

/* -------------------------------------------------------------------------- */
/* Group build                                                                */
/* -------------------------------------------------------------------------- */

/** Options accepted by {@link createBuildingsGroup}. */
export interface BuildingsGroupOptions {
  /** Overrides the plan's own night state for the emissive windows. */
  readonly night?: boolean
}

/** Counters measured from a built group, for the census and the tests. */
export interface BuildingsSceneSummary {
  readonly parcels: number
  readonly buildings: number
  readonly vacantLots: number
  readonly constructionSites: number
  readonly meshes: number
  readonly instancedMeshes: number
  readonly instances: number
  readonly windowInstances: number
  readonly roofInstances: number
  readonly facadeDetailInstances: number
  readonly triangles: number
}

function centreOf(rect: FootprintRect): { readonly x: number; readonly z: number } {
  return { x: (rect.min.x + rect.max.x) / 2, z: (rect.min.z + rect.max.z) / 2 }
}

function tag(object: Object3D, kind: string, id: string): Object3D {
  object.userData = { kind, parcelId: id }
  return object
}

/** One box mesh, positioned by its centre. */
function box(
  name: string,
  size: { readonly width: number; readonly height: number; readonly depth: number },
  at: { readonly x: number; readonly y: number; readonly z: number },
  material: Material,
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(Math.max(0.01, size.width), Math.max(0.01, size.height), Math.max(0.01, size.depth)),
    material,
  )
  mesh.name = name
  mesh.position.set(at.x, at.y, at.z)
  return mesh
}

interface BuildingMaterials {
  readonly base: MeshStandardMaterial
  readonly accent: MeshStandardMaterial
  readonly trim: MeshStandardMaterial
  readonly roof: MeshStandardMaterial
  readonly glass: MeshStandardMaterial
  readonly pad: MeshStandardMaterial
}

function createMaterials(plan: BuildingPlan, night: boolean): BuildingMaterials {
  const bump = night ? Math.max(0.35, plan.lighting.windowEmissive) : 0
  const glass = new MeshStandardMaterial({
    color: plan.palette.glass,
    roughness: 0.35,
    metalness: 0.1,
    side: DoubleSide,
  })
  if (plan.lighting.windowEmissive > 0) {
    glass.emissive.set(plan.lighting.artificialLightColor)
    glass.emissiveIntensity = bump * plan.lighting.artificialLightIntensity
  }
  return {
    base: new MeshStandardMaterial({ color: plan.palette.base, roughness: 0.85, metalness: 0.05 }),
    accent: new MeshStandardMaterial({ color: plan.palette.accent, roughness: 0.8, metalness: 0.08 }),
    trim: new MeshStandardMaterial({ color: plan.palette.trim, roughness: 0.6, metalness: 0.15 }),
    roof: new MeshStandardMaterial({ color: plan.palette.roof, roughness: 0.9, metalness: 0.05 }),
    glass,
    pad: new MeshStandardMaterial({ color: plan.palette.accent, roughness: 1 }),
  }
}

/** Builds one InstancedMesh from a list of transforms. */
function instanced(
  name: string,
  geometry: BoxGeometry | PlaneGeometry,
  material: Material,
  transforms: readonly { readonly x: number; readonly y: number; readonly z: number; readonly rotationY: number; readonly scale?: readonly [number, number, number] }[],
): InstancedMesh | null {
  if (transforms.length === 0) {
    return null
  }
  const mesh = new InstancedMesh(geometry, material, transforms.length)
  mesh.name = name
  const dummy = new Object3D()
  for (let index = 0; index < transforms.length; index += 1) {
    const transform = transforms[index]
    if (transform === undefined) {
      continue
    }
    dummy.position.set(transform.x, transform.y, transform.z)
    dummy.rotation.set(0, transform.rotationY, 0)
    if (transform.scale !== undefined) {
      dummy.scale.set(transform.scale[0], transform.scale[1], transform.scale[2])
    } else {
      dummy.scale.set(1, 1, 1)
    }
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** Facade-detail strips of one building: bands, mullions, courses, balconies. */
interface DetailStrip {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly rotationY: number
  readonly scale: readonly [number, number, number]
}

/** One facade of a building, with what a strip spans along it. */
interface FacadeFace {
  readonly x: number
  readonly z: number
  readonly rotationY: number
  /** Length of the facade in metres. */
  readonly span: number
  /** Horizontal axis the facade runs along. */
  readonly axis: 'x' | 'z'
}

function facesOf(footprint: FootprintRect): readonly FacadeFace[] {
  const centre = centreOf(footprint)
  return [
    { x: centre.x, z: footprint.min.z, rotationY: Math.PI, span: footprint.width, axis: 'x' },
    { x: centre.x, z: footprint.max.z, rotationY: 0, span: footprint.width, axis: 'x' },
    { x: footprint.max.x, z: centre.z, rotationY: Math.PI / 2, span: footprint.depth, axis: 'z' },
    { x: footprint.min.x, z: centre.z, rotationY: -Math.PI / 2, span: footprint.depth, axis: 'z' },
  ]
}

/** A point `offset` metres along one facade, from its start edge. */
function alongFace(face: FacadeFace, footprint: FootprintRect, offset: number): { readonly x: number; readonly z: number } {
  const start = face.axis === 'x' ? footprint.min.x : footprint.min.z
  return face.axis === 'x' ? { x: start + offset, z: face.z } : { x: face.x, z: start + offset }
}

function facadeDetailStrips(instance: BuildingInstance): readonly DetailStrip[] {
  const { facade, footprint, height } = instance
  const faces = facesOf(footprint)
  const strips: DetailStrip[] = []
  const rows = facade.window.rows
  const stepY = facade.window.height + facade.window.spacingY
  const baseY = instance.groundFloorHeight
  const bodyHeight = Math.max(0.5, height - baseY)

  if (facade.hasSpandrelBands) {
    for (let row = 0; row < rows; row += 1) {
      const y = baseY + row * stepY + facade.window.height + facade.window.spacingY / 2
      for (const face of faces) {
        const point = alongFace(face, footprint, face.span / 2)
        strips.push({ x: point.x, y, z: point.z, rotationY: face.rotationY, scale: [face.span, 0.28, 0.18] })
      }
    }
  }

  if (facade.hasMullions) {
    const y = baseY + bodyHeight / 2
    for (const face of faces) {
      const columns = face.axis === 'x' ? facade.window.columnsX : facade.window.columnsZ
      for (let column = 0; column <= columns; column += 1) {
        const point = alongFace(face, footprint, (face.span * column) / Math.max(1, columns))
        strips.push({ x: point.x, y, z: point.z, rotationY: face.rotationY, scale: [0.12, bodyHeight, 0.14] })
      }
    }
  }

  if (facade.hasMasonryCoursing) {
    const courses = Math.min(40, Math.max(1, Math.floor(bodyHeight / 0.9)))
    for (let course = 1; course <= courses; course += 1) {
      const y = baseY + course * 0.9
      for (const face of faces.slice(0, 2)) {
        const point = alongFace(face, footprint, face.span / 2)
        strips.push({ x: point.x, y, z: point.z, rotationY: face.rotationY, scale: [face.span, 0.08, 0.1] })
      }
    }
  }

  if (facade.balconyCount > 0) {
    const balconyRows = Math.min(rows, Math.max(1, facade.balconyCount))
    for (let index = 0; index < balconyRows; index += 1) {
      const face = faces[index % 2]
      if (face === undefined) {
        continue
      }
      const y = baseY + index * stepY + facade.window.height / 2
      const point = alongFace(face, footprint, face.span * (0.25 + 0.5 * (index % 3) / 2))
      strips.push({ x: point.x, y, z: point.z, rotationY: face.rotationY, scale: [2.4, 0.35, 1.2] })
    }
  }

  return strips
}

/** Exposed structural frame of one building (1985 concrete / 2025 towers). */
function structureStrips(instance: BuildingInstance): readonly DetailStrip[] {
  const { footprint, height } = instance
  const centre = centreOf(footprint)
  const baseY = instance.groundFloorHeight
  const frameHeight = Math.max(1, height - baseY)
  const corners: readonly { readonly x: number; readonly z: number }[] = [
    { x: footprint.min.x + 0.2, z: footprint.min.z + 0.2 },
    { x: footprint.max.x - 0.2, z: footprint.min.z + 0.2 },
    { x: footprint.max.x - 0.2, z: footprint.max.z - 0.2 },
    { x: footprint.min.x + 0.2, z: footprint.max.z - 0.2 },
  ]
  return corners.map((corner) => ({
    x: corner.x,
    y: baseY + frameHeight / 2,
    z: corner.z,
    rotationY: Math.atan2(centre.x - corner.x, centre.z - corner.z),
    scale: [0.4, frameHeight, 0.4],
  }))
}

/** Builds the named group tree of one era's buildings. */
export function createBuildingsGroup(plan: BuildingPlan, options: BuildingsGroupOptions = {}): Group {
  const night = options.night ?? plan.night
  const materials = createMaterials(plan, night)
  const root = new Group()
  root.name = 'era-buildings'
  root.userData = { layerId: 'buildings', eraId: plan.eraId, style: plan.style }

  const windowGeometry = new PlaneGeometry(1, 1)

  for (const instance of plan.buildings) {
    const parcel = new Group()
    parcel.name = `parcel:${instance.id}`
    tag(parcel, instance.state, instance.id)
    root.add(parcel)

    const centre = centreOf(instance.footprint)
    const centrePoint = { x: centre.x, y: 0, z: centre.z }

    if (instance.state !== 'building') {
      const pad = box(
        `ground:${instance.id}`,
        { width: instance.footprint.width, height: 0.14, depth: instance.footprint.depth },
        { x: centrePoint.x, y: 0.07, z: centrePoint.z },
        materials.pad,
      )
      tag(pad, instance.state, instance.id)
      parcel.add(pad)

      if (instance.state === 'construction') {
        const scaffoldHeight = Math.max(3, instance.groundFloorHeight * 1.6)
        const scaffold = box(
          `construction:${instance.id}`,
          { width: instance.footprint.width * 0.8, height: scaffoldHeight, depth: instance.footprint.depth * 0.8 },
          { x: centrePoint.x, y: scaffoldHeight / 2, z: centrePoint.z },
          materials.trim,
        )
        tag(scaffold, 'construction', instance.id)
        parcel.add(scaffold)
      } else {
        const fence = box(
          `fence:${instance.id}`,
          { width: instance.footprint.width * 0.9, height: 1, depth: 0.12 },
          { x: centrePoint.x, y: 0.5, z: instance.footprint.min.z + 0.3 },
          materials.trim,
        )
        tag(fence, 'vacant-lot', instance.id)
        parcel.add(fence)
      }
      continue
    }

    const mass = box(
      `mass:${instance.id}`,
      { width: instance.footprint.width, height: instance.height, depth: instance.footprint.depth },
      { x: centrePoint.x, y: instance.height / 2, z: centrePoint.z },
      materials.base,
    )
    tag(mass, 'building', instance.id)
    parcel.add(mass)

    const windows = instanced(
      `windows:${instance.id}`,
      windowGeometry,
      materials.glass,
      facadeWindowPlacements({
        id: instance.id,
        footprint: instance.footprint,
        facade: instance.facade,
        height: instance.height,
        groundFloorHeight: instance.groundFloorHeight,
      }).map((placement) => ({
        ...placement,
        scale: [instance.facade.window.width, instance.facade.window.height, 1] as const,
      })),
    )
    if (windows !== null) {
      tag(windows, 'building', instance.id)
      parcel.add(windows)
    }

    const detail = instanced(
      `facade-detail:${instance.id}`,
      new BoxGeometry(1, 1, 1),
      materials.trim,
      facadeDetailStrips(instance),
    )
    if (detail !== null) {
      tag(detail, 'facade-detail', instance.id)
      parcel.add(detail)
    }

    if (instance.facade.hasExposedStructure) {
      const structure = instanced(
        `structure:${instance.id}`,
        new BoxGeometry(1, 1, 1),
        materials.accent,
        structureStrips(instance),
      )
      if (structure !== null) {
        tag(structure, 'structure', instance.id)
        parcel.add(structure)
      }
    }

    for (const placement of roofItemPlacements({
      id: instance.id,
      footprint: instance.footprint,
      height: instance.height,
      roof: instance.roof,
    })) {
      const size = ROOF_ITEM_SIZES[placement.kind]
      const roofMesh = box(
        `roof:${placement.kind}:${instance.id}`,
        size,
        { x: placement.x, y: placement.y, z: placement.z },
        materials.roof,
      )
      roofMesh.rotation.y = placement.rotationY
      tag(roofMesh, `roof-${placement.kind}`, instance.id)
      parcel.add(roofMesh)
    }
  }

  return root
}

/** Releases every geometry, material and instance buffer of a built group. */
export function disposeBuildingsGroup(group: Group): void {
  group.traverse((object) => {
    const mesh = object as Mesh & { readonly isInstancedMesh?: boolean; dispose?: () => void }
    if (mesh.isInstancedMesh === true) {
      mesh.dispose?.()
    }
    const geometry = (mesh as unknown as { geometry?: { dispose(): void } }).geometry
    geometry?.dispose()
    const material = (mesh as unknown as { material?: Material | Material[] }).material
    if (Array.isArray(material)) {
      for (const entry of material) {
        entry.dispose()
      }
    } else {
      material?.dispose()
    }
  })
  group.clear()
}

/** Measures one built group: parcels, instances and triangle cost. */
export function summariseBuildingsGroup(group: Group): BuildingsSceneSummary {
  let parcels = 0
  let buildings = 0
  let vacantLots = 0
  let constructionSites = 0
  let meshes = 0
  let instancedMeshes = 0
  let instances = 0
  let windowInstances = 0
  let roofInstances = 0
  let facadeDetailInstances = 0
  let triangles = 0

  group.children.forEach((child) => {
    parcels += 1
    const kind = child.userData['kind']
    if (kind === 'building') {
      buildings += 1
    } else if (kind === 'vacant-lot') {
      vacantLots += 1
    } else if (kind === 'construction') {
      constructionSites += 1
    }
    child.traverse((object) => {
      const mesh = object as Mesh & { readonly isInstancedMesh?: boolean; readonly count?: number }
      if (mesh.isMesh !== true) {
        return
      }
      meshes += 1
      const positionCount =
        (mesh.geometry as unknown as { attributes?: { position?: { count: number } } }).attributes
          ?.position?.count ?? 0
      const indexCount = (mesh.geometry as unknown as { index?: { count: number } | null }).index?.count
      const geometryTriangles = Math.floor((indexCount ?? positionCount) / 3)
      if (mesh.isInstancedMesh === true) {
        instancedMeshes += 1
        const count = mesh.count ?? 0
        instances += count
        triangles += geometryTriangles * count
        if (mesh.name.startsWith('windows:')) {
          windowInstances += count
        } else if (mesh.name.startsWith('roof:')) {
          roofInstances += count
        } else if (mesh.name.startsWith('facade-detail:') || mesh.name.startsWith('structure:')) {
          facadeDetailInstances += count
        }
      } else {
        triangles += geometryTriangles
        // Roof add-ons are placed as individual sized boxes, one per item.
        if (mesh.name.startsWith('roof:')) {
          roofInstances += 1
        }
      }
    })
  })

  return {
    parcels,
    buildings,
    vacantLots,
    constructionSites,
    meshes,
    instancedMeshes,
    instances,
    windowInstances,
    roofInstances,
    facadeDetailInstances,
    triangles,
  }
}

/**
 * Cross-fades a staged building change in place.
 *
 * `from` shrinks into the ground while `to` grows out of it, so the block reads
 * as being rebuilt rather than swapped. `mix = 0` leaves only the outgoing era,
 * `mix = 1` only the incoming one; reduced-motion hosts snap to one end.
 */
export function applyProgressiveSwap(from: Group, to: Group, mix: number): void {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(mix) ? mix : 0))
  from.visible = clamped < 1
  to.visible = clamped > 0
  for (const child of from.children) {
    child.scale.y = Math.max(0.001, 1 - clamped)
    child.visible = clamped < 1
  }
  for (const child of to.children) {
    child.scale.y = Math.max(0.001, clamped)
    child.visible = clamped > 0
  }
}

/* -------------------------------------------------------------------------- */
/* React host                                                                 */
/* -------------------------------------------------------------------------- */

/** Props of the {@link BuildingsLayer} component. */
export interface BuildingsLayerProps {
  /** Frozen block every parcel belongs to. */
  readonly layout: BlockLayout
  /** Era to show when no transition is in flight. */
  readonly eraId?: EraId
  /** Staged era change; wins over {@link eraId} while present. */
  readonly transition?: BuildingTransitionInput
  readonly seed?: Seed
  readonly quality?: QualityTierName
  readonly night?: boolean
  readonly reducedMotion?: boolean
  /** Called with the mounted group, or `null` once it is disposed. */
  readonly onGroupReady?: (group: Group | null) => void
}

/** React host that mounts the built group inside a react-three-fiber scene. */
export function BuildingsLayer(props: BuildingsLayerProps): ReactElement {
  const {
    layout,
    eraId = DEFAULT_ERA_ID,
    transition,
    seed,
    quality,
    night,
    reducedMotion,
    onGroupReady,
  } = props

  const context = useMemo<BuildingContext>(
    () => ({
      layout,
      ...(quality === undefined ? {} : { qualityTier: quality }),
      ...(seed === undefined ? {} : { seed }),
      ...(night === undefined ? {} : { night }),
      ...(reducedMotion === undefined ? {} : { reducedMotion }),
    }),
    [layout, quality, seed, night, reducedMotion],
  )

  const plan = useMemo<BuildingPlan>(
    () =>
      transition === undefined
        ? applyEra(eraId, context)
        : applyEraTransition(transition, context).plan,
    [eraId, transition, context],
  )
  const group = useMemo(() => createBuildingsGroup(plan), [plan])

  useEffect(() => {
    onGroupReady?.(group)
    return () => {
      onGroupReady?.(null)
      disposeBuildingsGroup(group)
    }
  }, [group, onGroupReady])

  return <primitive object={group} name="era-buildings" />
}

/** Alias kept for hosts that name the layer after the module. */
export const BuildingsLayerComponent = BuildingsLayer
