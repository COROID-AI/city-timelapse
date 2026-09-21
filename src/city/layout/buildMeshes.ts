/**
 * three.js bridge for the layout: the one file in this module that imports the
 * renderer library.
 *
 * `generateBlock` publishes engine-agnostic {@link MeshData}; this module turns
 * that data into `THREE.Mesh` objects grouped by {@link MeshGroup} and named
 * after their mesh data, so the layout's own harness page (and any scene layer)
 * can mount, count and inspect the block without the render pipeline.
 *
 * Materials here are deliberately era-neutral greys: period colour, texture,
 * road paint and signage belong to the era content layers, which receive the
 * same mesh names and simply swap materials.
 */

import * as THREE from 'three'
import {
  MESH_GROUPS,
  type BlockLayout,
  type MaterialKey,
  type MeshData,
  type MeshGroup,
} from './types'

/** Era-neutral material parameters, one record per {@link MaterialKey}. */
export interface LayoutMaterialSpec {
  readonly color: number
  readonly roughness: number
  readonly metalness: number
}

/** Default surface appearance; content layers replace these per era. */
export const LAYOUT_MATERIAL_SPECS: Readonly<Record<MaterialKey, LayoutMaterialSpec>> = {
  ground: { color: 0x6f6c66, roughness: 0.95, metalness: 0 },
  asphalt: { color: 0x3b3d40, roughness: 0.92, metalness: 0 },
  'lane-surface': { color: 0x45484c, roughness: 0.88, metalness: 0 },
  'parking-surface': { color: 0x43464a, roughness: 0.9, metalness: 0 },
  marking: { color: 0xe8e4d8, roughness: 0.7, metalness: 0 },
  sidewalk: { color: 0x9a978f, roughness: 0.86, metalness: 0 },
  curb: { color: 0x8d8a83, roughness: 0.8, metalness: 0 },
  crosswalk: { color: 0xf0eee6, roughness: 0.68, metalness: 0 },
  metal: { color: 0x5b5f63, roughness: 0.45, metalness: 0.6 },
}

/** One mounted mesh of the block. */
export interface BuiltLayoutMesh {
  readonly name: string
  readonly group: MeshGroup
  readonly materialKey: MaterialKey
  readonly triangles: number
  readonly mesh: THREE.Mesh
}

/** Grouped counts of a mounted block, ready for assertions and reports. */
export interface BuiltLayoutSummary {
  readonly meshCount: number
  readonly triangleCount: number
  readonly groups: Readonly<Record<MeshGroup, { readonly meshCount: number; readonly triangles: number }>>
  readonly names: readonly string[]
}

/** The mounted block: a root group with one child group per mesh group. */
export interface BuiltLayout {
  readonly root: THREE.Group
  readonly meshes: readonly BuiltLayoutMesh[]
  readonly groups: Readonly<Record<MeshGroup, THREE.Group>>
  readonly materials: Readonly<Record<MaterialKey, THREE.MeshStandardMaterial>>
  readonly summary: BuiltLayoutSummary
}

/** Builds a `BufferGeometry` from flat layout mesh data. */
export function toBufferGeometry(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...data.positions], 3))
  const maxIndex = data.indices.reduce((max, index) => Math.max(max, index), 0)
  geometry.setIndex(
    maxIndex > 65_535
      ? new THREE.Uint32BufferAttribute([...data.indices], 1)
      : new THREE.Uint16BufferAttribute([...data.indices], 1),
  )
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.name = data.name
  return geometry
}

/** Creates one material per layout material key. */
export function createLayoutMaterials(): Record<MaterialKey, THREE.MeshStandardMaterial> {
  const materials = {} as Record<MaterialKey, THREE.MeshStandardMaterial>
  for (const key of Object.keys(LAYOUT_MATERIAL_SPECS) as MaterialKey[]) {
    const spec = LAYOUT_MATERIAL_SPECS[key]
    const material = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      name: key,
    })
    materials[key] = material
  }
  return materials
}

function summarise(meshes: readonly BuiltLayoutMesh[]): BuiltLayoutSummary {
  const groups = {} as Record<MeshGroup, { meshCount: number; triangles: number }>
  for (const group of MESH_GROUPS) {
    groups[group] = { meshCount: 0, triangles: 0 }
  }
  let triangleCount = 0
  for (const entry of meshes) {
    triangleCount += entry.triangles
    groups[entry.group].meshCount += 1
    groups[entry.group].triangles += entry.triangles
  }
  return {
    meshCount: meshes.length,
    triangleCount,
    groups,
    names: meshes.map((entry) => entry.name),
  }
}

/**
 * Mounts the block meshes as three.js objects.
 *
 * The returned root is named `city-block-layout` and holds one child group per
 * {@link MeshGroup}. Every mesh keeps its layout name, its group and its
 * material key in `userData`, so harness assertions can address them without
 * walking the geometry.
 */
export function buildLayoutObject(
  layout: BlockLayout,
  materials: Record<MaterialKey, THREE.MeshStandardMaterial> = createLayoutMaterials(),
): BuiltLayout {
  const root = new THREE.Group()
  root.name = 'city-block-layout'

  const groups = {} as Record<MeshGroup, THREE.Group>
  for (const group of MESH_GROUPS) {
    const node = new THREE.Group()
    node.name = `group:${group}`
    node.userData['group'] = group
    groups[group] = node
    root.add(node)
  }

  const meshes: BuiltLayoutMesh[] = []
  for (const data of layout.meshes) {
    const geometry = toBufferGeometry(data)
    const material = materials[data.materialKey]
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = data.name
    mesh.userData['group'] = data.group
    mesh.userData['materialKey'] = data.materialKey
    mesh.userData['triangles'] = data.triangles
    mesh.userData['raised'] = data.raised
    mesh.receiveShadow = !data.raised
    groups[data.group].add(mesh)
    meshes.push({
      name: data.name,
      group: data.group,
      materialKey: data.materialKey,
      triangles: data.triangles,
      mesh,
    })
  }

  return { root, meshes, groups, materials, summary: summarise(meshes) }
}

/** Total triangles of a mounted block. */
export function countBuiltTriangles(layout: BuiltLayout): number {
  return layout.summary.triangleCount
}

/** Releases the geometries and materials of a mounted block. */
export function disposeLayoutObject(layout: BuiltLayout): void {
  for (const entry of layout.meshes) {
    entry.mesh.geometry.dispose()
    entry.mesh.removeFromParent()
  }
  for (const material of Object.values(layout.materials)) {
    material.dispose()
  }
  layout.root.clear()
}

/** Convenience for harnesses: the built mesh names of one group. */
export function builtMeshNames(layout: BuiltLayout, group: MeshGroup): string[] {
  return layout.meshes.filter((entry) => entry.group === group).map((entry) => entry.name)
}
