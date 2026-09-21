/**
 * Contract tests for the parcel, anchor and mesh half of the canonical block.
 *
 * These lock down the promises every era content layer depends on: identical
 * serialised output for a given seed, a parcel grid that covers the block with
 * non-overlapping footprints and per-parcel building capacity, storefront bays
 * that face the streets, a uniquely named anchor catalogue, and named mesh
 * groups that stay inside the shared triangle budget and are wound to face the
 * right way.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_KINDS,
  ANCHOR_NAME_PATTERN,
  BLOCK_DECK_HEIGHT,
  BUILD_LINE,
  CORNER_NAMES,
  CURB_HEIGHT,
  DEFAULT_LAYOUT_SEED,
  FLOOR_HEIGHT,
  GROUND_FLOOR_HEIGHT,
  LAYOUT_TRIANGLE_BUDGETS,
  MESH_GROUPS,
  PARCEL_COLUMNS,
  PARCEL_ROWS,
  PARCEL_SIZE,
  STOREFRONT_BAY_WIDTH,
  STREET_NAMES,
  anchorByName,
  anchorsOfKind,
  classifyGround,
  generateBlock,
  layoutHash,
  serializeLayout,
  type Anchor,
  type BlockLayout,
  type MeshData,
} from '../../src/city/layout'
import { hashString, stableStringify } from '../support/hash'

const SEED = DEFAULT_LAYOUT_SEED
const block = generateBlock(SEED)

function at<T>(items: readonly T[], index: number): T {
  const value = items[index]
  if (value === undefined) {
    throw new RangeError(`Index ${index} outside ${items.length}`)
  }
  return value
}

function findProjectRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, 'package.json')) && existsSync(join(current, 'src'))) {
      return current
    }
    const parent = join(current, '..')
    if (parent === current) break
    current = parent
  }
  throw new Error(`Could not locate the project root from ${process.cwd()}`)
}

const projectRoot = findProjectRoot()

/** Mesh data by name; throws when the mesh is missing. */
function meshNamed(layout: BlockLayout, name: string): MeshData {
  const mesh = layout.meshes.find((candidate) => candidate.name === name)
  if (mesh === undefined) {
    throw new RangeError(`Missing mesh ${name}`)
  }
  return mesh
}

/** Vertices of a mesh as tuples. */
function vertices(mesh: MeshData): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = []
  for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
    points.push([
      at(mesh.positions, index),
      at(mesh.positions, index + 1),
      at(mesh.positions, index + 2),
    ])
  }
  return points
}

/** Unit normal of the mesh's first triangle, derived the way a renderer does. */
function firstTriangleNormal(mesh: MeshData): [number, number, number] {
  const points = vertices(mesh)
  const p0 = at(points, at(mesh.indices, 0))
  const p1 = at(points, at(mesh.indices, 1))
  const p2 = at(points, at(mesh.indices, 2))
  const ux = p1[0] - p0[0]
  const uy = p1[1] - p0[1]
  const uz = p1[2] - p0[2]
  const vx = p2[0] - p0[0]
  const vy = p2[1] - p0[1]
  const vz = p2[2] - p0[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.hypot(nx, ny, nz)
  return [nx / length, ny / length, nz / length]
}

/** Along-axis coordinate of a column letter, west to east. */
function columnIndex(column: string): number {
  return PARCEL_COLUMNS.indexOf(column as (typeof PARCEL_COLUMNS)[number])
}

/** Along-axis coordinate of a row number, north to south. */
function rowIndex(row: number): number {
  return PARCEL_ROWS.indexOf(row as (typeof PARCEL_ROWS)[number])
}

describe('deterministic generation', () => {
  it('produces byte-identical serialised output for the same seed', () => {
    const first = generateBlock(SEED)
    const second = generateBlock(SEED)
    expect(serializeLayout(second)).toBe(serializeLayout(first))
    expect(layoutHash(second)).toBe(layoutHash(first))
    expect(stableStringify(second)).toBe(stableStringify(first))
    expect(second.stats).toEqual(first.stats)
    // Repeating the run after an unrelated generation proves no shared state.
    generateBlock('city-block-unrelated')
    expect(layoutHash(generateBlock(SEED))).toBe(layoutHash(first))
  })

  it('publishes a hash that matches the shared determinism helper', () => {
    expect(layoutHash(block)).toBe(hashString(serializeLayout(block)))
    expect(layoutHash(block)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('produces a different but equally valid block for another seed', () => {
    const other = generateBlock('city-block-alternate')
    expect(layoutHash(other)).not.toBe(layoutHash(block))
    expect(other.stats.parcelCount).toBe(block.stats.parcelCount)
    expect(other.stats.meshCount).toBe(block.stats.meshCount)
    expect(other.parcels.some((parcel, index) => parcel.capacity.maxHeight !== at(block.parcels, index).capacity.maxHeight)).toBe(true)
    expect(other.meshes.every((mesh) => mesh.triangles > 0)).toBe(true)
    expect(other.stats.triangleCount).toBeLessThanOrEqual(other.stats.triangleBudget)
  })

  it('never reads ambient randomness or the clock', () => {
    const originalRandom = Math.random
    const originalNow = Date.now
    try {
      Math.random = () => {
        throw new Error('layout generation used Math.random')
      }
      Date.now = () => {
        throw new Error('layout generation used Date.now')
      }
      expect(layoutHash(generateBlock(SEED))).toBe(layoutHash(block))
    } finally {
      Math.random = originalRandom
      Date.now = originalNow
    }

    for (const file of readdirSync(join(projectRoot, 'src/city/layout'))) {
      if (!file.endsWith('.ts')) continue
      const source = readFileSync(join(projectRoot, 'src/city/layout', file), 'utf8')
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(code, `${file} reads Math.random`).not.toMatch(/Math\.random/)
      expect(code, `${file} reads the clock`).not.toMatch(/Date\.now|new Date|performance\.now/)
      expect(code, `${file} reaches into era content`).not.toMatch(/from '.*\.\.\/era/)
    }
  })
})

describe('parcel grid', () => {
  it('tiles the parcel zone exactly with non-overlapping cells', () => {
    expect(block.parcels).toHaveLength(PARCEL_COLUMNS.length * PARCEL_ROWS.length)
    let area = 0
    for (const parcel of block.parcels) {
      expect(parcel.cell.width).toBe(PARCEL_SIZE)
      expect(parcel.cell.depth).toBe(PARCEL_SIZE)
      expect(parcel.cell.min.x).toBeGreaterThanOrEqual(-BUILD_LINE)
      expect(parcel.cell.max.x).toBeLessThanOrEqual(BUILD_LINE)
      expect(parcel.cell.min.z).toBeGreaterThanOrEqual(-BUILD_LINE)
      expect(parcel.cell.max.z).toBeLessThanOrEqual(BUILD_LINE)
      area += parcel.cell.area
      // Column letters run west to east, row numbers north to south.
      expect(columnIndex(parcel.column)).toBeGreaterThanOrEqual(0)
      expect(rowIndex(parcel.row)).toBeGreaterThanOrEqual(0)
    }
    expect(area).toBeCloseTo((BUILD_LINE * 2) ** 2, 6)
  })

  it('keeps every footprint inside its cell, clear of its neighbours', () => {
    for (const parcel of block.parcels) {
      const footprint = parcel.footprint
      expect(footprint.area).toBeGreaterThan(0)
      expect(footprint.min.x).toBeGreaterThanOrEqual(parcel.cell.min.x)
      expect(footprint.min.z).toBeGreaterThanOrEqual(parcel.cell.min.z)
      expect(footprint.max.x).toBeLessThanOrEqual(parcel.cell.max.x)
      expect(footprint.max.z).toBeLessThanOrEqual(parcel.cell.max.z)
      expect(footprint.width).toBeCloseTo(footprint.max.x - footprint.min.x, 3)
      expect(footprint.depth).toBeCloseTo(footprint.max.z - footprint.min.z, 3)
    }

    for (let i = 0; i < block.parcels.length; i += 1) {
      for (let j = i + 1; j < block.parcels.length; j += 1) {
        const a = at(block.parcels, i).footprint
        const b = at(block.parcels, j).footprint
        const separated =
          a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.z <= b.min.z || b.max.z <= a.min.z
        expect(
          separated,
          `${at(block.parcels, i).id} and ${at(block.parcels, j).id} overlap`,
        ).toBe(true)
      }
    }
  })

  it('publishes building capacity for every parcel', () => {
    for (const parcel of block.parcels) {
      const capacity = parcel.capacity
      expect(capacity.footprintArea).toBeCloseTo(parcel.footprint.area, 3)
      expect(capacity.maxHeight).toBeGreaterThanOrEqual(10)
      expect(capacity.maxHeight).toBeLessThanOrEqual(38)
      expect(capacity.groundFloorHeight).toBe(GROUND_FLOOR_HEIGHT)
      expect(capacity.upperFloorHeight).toBe(FLOOR_HEIGHT)
      expect(capacity.floors).toBe(
        Math.max(1, Math.floor((capacity.maxHeight - GROUND_FLOOR_HEIGHT) / FLOOR_HEIGHT) + 1),
      )
      expect(capacity.buildableVolume).toBeCloseTo(capacity.footprintArea * capacity.maxHeight, 2)
      expect(['commercial', 'mixed', 'residential', 'civic']).toContain(capacity.use)
    }
  })

  it('fronts every parcel on exactly the streets that touch it', () => {
    for (const parcel of block.parcels) {
      const expected = STREET_NAMES.filter((street) => {
        if (street === 'north') return parcel.row === PARCEL_ROWS[0]
        if (street === 'south') return parcel.row === at(PARCEL_ROWS, PARCEL_ROWS.length - 1)
        if (street === 'west') return parcel.column === PARCEL_COLUMNS[0]
        return parcel.column === at(PARCEL_COLUMNS, PARCEL_COLUMNS.length - 1)
      })
      expect([...parcel.facing]).toEqual(expected)
      expect(parcel.corner === null).toBe(expected.length < 2)
    }
    expect(block.stats.streetFacingParcelCount).toBe(12)
  })

  it('gives every street-facing parcel storefront bays facing the street', () => {
    const outward = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] } as const
    let counted = 0

    for (const parcel of block.parcels) {
      for (const bay of parcel.bays) {
        counted += 1
        expect(parcel.facing).toContain(bay.street)
        expect(bay.normal.x).toBeCloseTo(outward[bay.street][0], 6)
        expect(bay.normal.z).toBeCloseTo(outward[bay.street][1], 6)
        expect(bay.height).toBe(GROUND_FLOOR_HEIGHT)
        expect(bay.area).toBeCloseTo(bay.width * bay.height, 3)
        expect(bay.name).toBe(`parcel:${parcel.id}:storefront:${bay.index}`)
        // Bay centre sits on the facade line, inside the footprint edge span.
        if (bay.street === 'north' || bay.street === 'south') {
          expect(bay.centre.x).toBeGreaterThanOrEqual(parcel.footprint.min.x)
          expect(bay.centre.x).toBeLessThanOrEqual(parcel.footprint.max.x)
        } else {
          expect(bay.centre.z).toBeGreaterThanOrEqual(parcel.footprint.min.z)
          expect(bay.centre.z).toBeLessThanOrEqual(parcel.footprint.max.z)
        }
        expect(classifyGround(bay.centre.x, bay.centre.z)).toBe('parcel')
      }

      // Bays subdivide each street-facing edge, and only those edges.
      if (parcel.facing.length === 0) {
        expect(parcel.bays).toHaveLength(0)
        continue
      }
      for (const street of parcel.facing) {
        const bays = parcel.bays.filter((bay) => bay.street === street)
        const edgeLength =
          street === 'north' || street === 'south' ? parcel.footprint.width : parcel.footprint.depth
        const expectedCount = Math.min(12, Math.max(1, Math.round(edgeLength / STOREFRONT_BAY_WIDTH)))
        expect(bays, `${parcel.id} ${street}`).toHaveLength(expectedCount)
        const total = bays.reduce((sum, bay) => sum + bay.width, 0)
        expect(total).toBeCloseTo(edgeLength, 2)
      }
    }

    expect(counted).toBe(block.stats.storefrontBayCount)
    expect(counted).toBeGreaterThan(0)
  })
})

describe('anchor catalogue', () => {
  it('is flat, uniquely named and covers every documented kind', () => {
    const names = block.anchors.map((anchor) => anchor.name)
    expect(new Set(names).size).toBe(names.length)
    for (const anchor of block.anchors) {
      expect(anchor.name, anchor.name).toMatch(ANCHOR_NAME_PATTERN)
      expect(anchor.position.x).toBeDefined()
      expect(Number.isFinite(anchor.position.x + anchor.position.y + anchor.position.z)).toBe(true)
      expect(Math.hypot(anchor.normal.x, anchor.normal.y, anchor.normal.z)).toBeCloseTo(1, 3)
      expect(ANCHOR_KINDS).toContain(anchor.kind)
    }
    for (const kind of ANCHOR_KINDS) {
      expect(anchorsOfKind(block, kind).length).toBe(block.stats.anchorsByKind[kind])
      expect(anchorsOfKind(block, kind).length).toBeGreaterThan(0)
    }
    expect(block.stats.anchorsByKind['storefront-bay']).toBe(block.stats.storefrontBayCount)
    expect(block.stats.anchorsByKind['light-post']).toBe(4 * STREET_NAMES.length)
    expect(block.stats.anchorsByKind['hydrant']).toBe(STREET_NAMES.length)
    expect(block.stats.anchorsByKind['utility-endpoint']).toBe(4 * STREET_NAMES.length)
    expect(block.stats.anchorsByKind['signal-head']).toBe(2 * CORNER_NAMES.length)
    expect(block.stats.anchorsByKind['prop-point']).toBe(2 * block.parcels.length)
    expect(block.stats.anchorsByKind['inspection-focus']).toBe(
      block.parcels.length + CORNER_NAMES.length,
    )
  })

  it('names anchors in the documented scheme and keeps the catalogue sorted', () => {
    const names = block.anchors.map((anchor) => anchor.name)
    expect([...names].sort()).toEqual(names)
    expect(anchorByName(block, 'street:north:light:3').kind).toBe('light-post')
    expect(anchorByName(block, 'parcel:D1:storefront:1').owner).toEqual({ kind: 'parcel', id: 'D1' })
    expect(() => anchorByName(block, 'street:north:light:99')).toThrow(/Unknown anchor/)
  })

  it('mounts street furniture on the sidewalk deck with sensible heights', () => {
    for (const anchor of [
      ...anchorsOfKind(block, 'light-post'),
      ...anchorsOfKind(block, 'hydrant'),
      ...anchorsOfKind(block, 'signal-head'),
      ...anchorsOfKind(block, 'utility-endpoint'),
    ]) {
      const ground = classifyGround(anchor.position.x, anchor.position.z)
      expect(ground, `${anchor.name} sits on ${ground}`).toBe('sidewalk')
      expect(anchor.position.y).toBeGreaterThanOrEqual(BLOCK_DECK_HEIGHT)
    }
    for (const anchor of anchorsOfKind(block, 'signal-head')) {
      expect(anchor.position.y).toBeCloseTo(BLOCK_DECK_HEIGHT + 5.2, 3)
      expect(anchor.facing).not.toBeNull()
    }
    for (const anchor of anchorsOfKind(block, 'utility-endpoint')) {
      expect(anchor.position.y).toBeGreaterThan(5)
    }
  })

  it('ties storefront bay anchors to the parcel bays they describe', () => {
    for (const parcel of block.parcels) {
      for (const bay of parcel.bays) {
        const anchor: Anchor = anchorByName(block, bay.name)
        expect(anchor.kind).toBe('storefront-bay')
        expect(anchor.position).toEqual({
          x: bay.centre.x,
          y: CURB_HEIGHT,
          z: bay.centre.z,
        })
        expect(anchor.normal).toEqual(bay.normal)
        expect(anchor.facing).toBe(bay.street)
        expect(anchor.size?.width).toBe(bay.width)
      }
      const signIndices = anchorsOfKind(block, 'sign-mount')
        .filter((anchor) => anchor.owner.id === parcel.id)
        .map((anchor) => Number(anchor.name.split(':').at(-1)))
      expect(signIndices).toHaveLength(parcel.bays.length + parcel.facing.length)
      expect(new Set(signIndices).size).toBe(signIndices.length)
    }
  })

  it('runs overhead utility lines between catalogue endpoints', () => {
    expect(block.utilityLines).toHaveLength(3 * STREET_NAMES.length)
    const names = new Set(block.anchors.map((anchor) => anchor.name))
    for (const line of block.utilityLines) {
      expect(names.has(line.from)).toBe(true)
      expect(names.has(line.to)).toBe(true)
      expect(line.from).not.toBe(line.to)
      expect(line.sag).toBeGreaterThan(0)
      expect(line.height).toBeGreaterThan(0)
    }
  })

  it('places parking bay anchors on the parking strips', () => {
    const bays = anchorsOfKind(block, 'parking-bay')
    expect(bays).toHaveLength(17 * STREET_NAMES.length)
    for (const bay of bays) {
      expect(classifyGround(bay.position.x, bay.position.z)).toBe('roadway')
      expect(bay.position.y).toBe(0)
      expect(bay.tags).toContain('parking-strip')
    }
  })
})

describe('block shell meshes', () => {
  it('ships every named mesh group with the expected mesh counts', () => {
    const expected: Record<string, number> = {
      parcels: block.parcels.length,
      roads: 4 + 4 + 4,
      'lane-strips': 4 * (4 + 3),
      'parking-strips': 4 * (2 + 2),
      sidewalks: 8,
      curbs: 4,
      crosswalks: 8,
      drainage: 4 * (2 + 4),
    }
    for (const group of MESH_GROUPS) {
      const meshes = block.meshes.filter((mesh) => mesh.group === group)
      expect(meshes, `group ${group}`).toHaveLength(expected[group] ?? 0)
      expect(meshes.length).toBeGreaterThan(0)
    }
    expect(block.stats.meshCount).toBe(block.meshes.length)
    expect(block.stats.triangleCount).toBe(
      block.meshes.reduce((total, mesh) => total + mesh.triangles, 0),
    )
  })

  it('keeps every mesh finite, indexed and non-empty', () => {
    const names = block.meshes.map((mesh) => mesh.name)
    expect(new Set(names).size).toBe(names.length)
    for (const mesh of block.meshes) {
      expect(mesh.positions.length % 3).toBe(0)
      expect(mesh.indices.length).toBe(mesh.triangles * 3)
      expect(mesh.triangles).toBeGreaterThan(0)
      const vertexCount = mesh.positions.length / 3
      for (const index of mesh.indices) {
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(vertexCount)
      }
      for (const value of mesh.positions) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(mesh.bounds.min.y).toBeLessThanOrEqual(mesh.bounds.max.y)
    }
  })

  it('keeps the block shell inside the budget of every quality tier', () => {
    for (const { tier, triangles } of [
      { tier: 'high' as const, triangles: block.stats.triangleCount },
      { tier: 'medium' as const, triangles: generateBlock(SEED, { tier: 'medium' }).stats.triangleCount },
      { tier: 'low' as const, triangles: generateBlock(SEED, { tier: 'low' }).stats.triangleCount },
    ]) {
      expect(triangles).toBeLessThanOrEqual(LAYOUT_TRIANGLE_BUDGETS[tier])
      expect(triangles).toBeGreaterThan(100)
    }
    expect(LAYOUT_TRIANGLE_BUDGETS.high).toBeGreaterThan(LAYOUT_TRIANGLE_BUDGETS.medium)
    expect(LAYOUT_TRIANGLE_BUDGETS.medium).toBeGreaterThan(LAYOUT_TRIANGLE_BUDGETS.low)
  })

  it('scales decoration, never mesh identity, with the detail option', () => {
    const low = generateBlock(SEED, { tier: 'low' })
    expect(low.meshes.map((mesh) => mesh.name)).toEqual(block.meshes.map((mesh) => mesh.name))
    expect(low.stats.triangleCount).toBeLessThan(block.stats.triangleCount)
  })

  it('winds ground surfaces up and kerbs toward the carriageway', () => {
    for (const mesh of block.meshes) {
      if (mesh.group === 'curbs') {
        continue
      }
      const [, y] = firstTriangleNormal(mesh)
      expect(y, `${mesh.name} faces down`).toBeGreaterThan(0.99)
    }

    const outward: Record<string, [number, number]> = {
      'curb:north': [0, -1],
      'curb:east': [1, 0],
      'curb:south': [0, 1],
      'curb:west': [-1, 0],
    }
    for (const [name, [ox, oz]] of Object.entries(outward)) {
      const [nx, , nz] = firstTriangleNormal(meshNamed(block, name))
      expect(nx * ox + nz * oz, `${name} faces the wrong way`).toBeGreaterThan(0.9)
      expect(Math.abs(meshNamed(block, name).bounds.max.y - CURB_HEIGHT)).toBeLessThan(1e-6)
    }
  })

  it('lays the sidewalk ring, deck and kerbs at the documented heights', () => {
    for (const mesh of block.meshes.filter((candidate) => candidate.group === 'sidewalks')) {
      expect(mesh.bounds.min.y).toBeCloseTo(CURB_HEIGHT, 6)
    }
    for (const mesh of block.meshes.filter((candidate) => candidate.group === 'parcels')) {
      expect(mesh.bounds.min.y).toBeCloseTo(BLOCK_DECK_HEIGHT, 6)
      expect(mesh.bounds.max.y).toBeCloseTo(BLOCK_DECK_HEIGHT, 6)
    }
    for (const mesh of block.meshes.filter(
      (candidate) => candidate.group === 'roads' || candidate.group === 'crosswalks',
    )) {
      expect(mesh.bounds.min.y).toBeLessThanOrEqual(0.02)
    }
  })

  it('tiles the parcel deck over the parcel zone with no gaps', () => {
    const deck = block.meshes.filter((mesh) => mesh.group === 'parcels')
    let area = 0
    for (const parcel of block.parcels) {
      const mesh = meshNamed(block, `surface:parcel:${parcel.id}`)
      expect(mesh.bounds.min.x).toBeCloseTo(parcel.cell.min.x, 3)
      expect(mesh.bounds.max.z).toBeCloseTo(parcel.cell.max.z, 3)
      area += parcel.cell.area
    }
    expect(deck).toHaveLength(block.parcels.length)
    expect(area).toBeCloseTo((BUILD_LINE * 2) ** 2, 6)
  })

  it('paints crosswalk marks on the carriageway inside their crossing bands', () => {
    expect(block.meshes.filter((mesh) => mesh.group === 'crosswalks')).toHaveLength(8)
    for (const mesh of block.meshes.filter((candidate) => candidate.group === 'crosswalks')) {
      const points = vertices(mesh)
      expect(points.length).toBe(16 * 4)
      for (const [x, , z] of points) {
        expect(classifyGround(x, z), `${mesh.name} at ${x},${z}`).toBe('roadway')
      }
      // The band is 4 m wide and sits along one axis of the crossing.
      const xs = points.map(([x]) => x)
      const zs = points.map(([, , z]) => z)
      const widthX = Math.max(...xs) - Math.min(...xs)
      const widthZ = Math.max(...zs) - Math.min(...zs)
      expect(Math.min(widthX, widthZ)).toBeCloseTo(4, 2)
    }
  })

  it('keeps lane and parking strips clear of the crossings', () => {
    for (const mesh of block.meshes.filter(
      (candidate) => candidate.group === 'lane-strips' || candidate.group === 'parking-strips',
    )) {
      for (const [x, , z] of vertices(mesh)) {
        expect(classifyGround(x, z)).toBe('roadway')
      }
    }
  })
})
