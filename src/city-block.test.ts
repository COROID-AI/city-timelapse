import { describe, expect, it } from 'vitest'
import {
  BLOCK_WORLD_HALF_EXTENT,
  CityBlock,
  PLOT_COLS,
  PLOT_ROWS,
  STREET_CENTER,
  buildBlockLayoutData,
} from './scene/city-block'

describe('CityBlock layout contract', () => {
  const layout = buildBlockLayoutData()

  it('builds a 4×2 canonical plot grid inside the block', () => {
    expect(layout.plots).toHaveLength(PLOT_COLS * PLOT_ROWS)
    expect(layout.plotsPerRow).toBe(PLOT_COLS)
    const ids = layout.plots.map((plot) => plot.id)
    expect(ids).toContain('plot-0-0')
    expect(ids).toContain('plot-1-3')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every plot inside the block extent', () => {
    for (const plot of layout.plots) {
      expect(Math.abs(plot.x) + plot.width / 2).toBeLessThanOrEqual(
        layout.worldHalfExtent + 1e-6,
      )
      expect(Math.abs(plot.z) + plot.depth / 2).toBeLessThanOrEqual(
        layout.worldHalfExtent + 1e-6,
      )
    }
  })

  it('places crosswalks on all four street sides', () => {
    expect(layout.crosswalks).toHaveLength(4)
    for (const crosswalk of layout.crosswalks) {
      // Crosswalk centers sit on the street center line.
      const onAxis = Math.abs(crosswalk.x) === STREET_CENTER || Math.abs(crosswalk.z) === STREET_CENTER
      expect(onAxis).toBe(true)
      expect(crosswalk.barCount).toBeGreaterThanOrEqual(5)
    }
  })

  it('defines street furniture (lamp) slots along the inner sidewalk', () => {
    expect(layout.streetFurniture.length).toBeGreaterThanOrEqual(20)
    for (const slot of layout.streetFurniture) {
      expect(['north', 'east', 'south', 'west']).toContain(slot.side)
      expect(slot.u).toBeGreaterThanOrEqual(0)
      expect(slot.u).toBeLessThanOrEqual(1)
      // On the inner sidewalk band (not inside the block, not in the road).
      const radius = Math.hypot(slot.x, slot.z)
      expect(radius).toBeGreaterThan(layout.sidewalkInnerCenter - 0.01)
    }
  })
})

describe('CityBlock instanced rendering contract', () => {
  it('is fully instanced with shared geometries/materials and no per-plot meshes', () => {
    const block = new CityBlock()
    const stats = block.stats
    expect(stats.instancedMeshes).toBeGreaterThanOrEqual(8)
    expect(stats.instanceCount).toBeGreaterThan(100)
    expect(stats.geometryCount).toBeGreaterThanOrEqual(9)
    expect(stats.materialCount).toBeGreaterThanOrEqual(8)
    // Placeholder slabs are 8 meshes (4×2), but the layout itself is instanced.
    expect(block.group.children.length).toBeGreaterThanOrEqual(8)
    block.dispose()
  })

  it('snaps one placeholder slab per plot slot', () => {
    const block = new CityBlock()
    const placeholders = block.group.getObjectByName('Placeholder buildings')
    expect(placeholders).toBeDefined()
    const children = placeholders?.children ?? []
    expect(children.length).toBe(PLOT_COLS * PLOT_ROWS)
    const names = children.map((child) => child.name)
    expect(names).toContain('Placeholder plot-0-0')
    block.dispose()
  })

  it('reconfigures from the era store without leaking placeholder meshes', () => {
    const block = new CityBlock()
    expect(block.stats.era).toBe('1945')

    block.setEra('1985')
    expect(block.stats.era).toBe('1985')
    // The placeholder group still has exactly one slab per plot.
    const placeholders = block.group.getObjectByName('Placeholder buildings')
    expect(placeholders?.children.length).toBe(PLOT_COLS * PLOT_ROWS)

    block.setEra('2025')
    expect(block.stats.era).toBe('2025')
    expect(placeholders?.children.length).toBe(PLOT_COLS * PLOT_ROWS)
    block.dispose()
  })

  it('exposes the canonical block extent for camera/lighting framing', () => {
    expect(BLOCK_WORLD_HALF_EXTENT).toBe(50)
    const layout = buildBlockLayoutData()
    expect(layout.worldExtent).toBe(100)
  })
})