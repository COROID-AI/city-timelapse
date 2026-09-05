import { describe, expect, it } from 'vitest'
import { buildBlockLayoutData, PLOT_COLS, PLOT_ROWS } from './city-block'
import {
  BILLBOARD_HEIGHT,
  BILLBOARD_WIDTH,
  SIGN_BAND_HEIGHT,
  STOREFRONT_BAND_HEIGHT,
  StorefrontAdverts,
  WALL_AD_HEIGHT,
  buildStorefrontAdLayout,
} from './storefronts'
import { ERA_IDS } from '../eras'
import { getEraData } from '../era-data'

describe('StorefrontAdLayout contract', () => {
  const layout = buildBlockLayoutData()
  const adLayout = buildStorefrontAdLayout(layout)

  it('snaps one street-facing facade per plot', () => {
    expect(adLayout.facades).toHaveLength(PLOT_COLS * PLOT_ROWS)
    const ids = adLayout.facades.map((f) => f.plotId)
    expect(ids).toContain('plot-0-0')
    expect(ids).toContain('plot-1-3')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('places facades on the street-facing edge of every plot', () => {
    for (const facade of adLayout.facades) {
      const plot = layout.plots.find((p) => p.id === facade.plotId)
      expect(plot).toBeDefined()
      // Facade center X matches the plot center X.
      expect(facade.x).toBeCloseTo(plot!.x, 6)
      // Facade edge sits on the north or south boundary.
      const north = plot!.row === 0
      const expectedEdge = north ? plot!.z - plot!.depth / 2 : plot!.z + plot!.depth / 2
      expect(Math.abs(facade.z - expectedEdge)).toBeLessThan(0.1)
      // Facade width scales with the corner-facing factor.
      expect(facade.width).toBeCloseTo(plot!.width * plot!.facingScale, 6)
      expect(facade.row).toBe(plot!.row)
      expect(facade.col).toBe(plot!.col)
    }
  })

  it('mounts rooftop billboards exactly on the four corner plots', () => {
    expect(adLayout.billboards).toHaveLength(4)
    const cornerIds = ['plot-0-0', 'plot-0-3', 'plot-1-0', 'plot-1-3']
    const ids = adLayout.billboards.map((b) => b.plotId).sort()
    expect(ids).toEqual([...cornerIds].sort())
    for (const billboard of adLayout.billboards) {
      const plot = layout.plots.find((p) => p.id === billboard.plotId)
      expect(plot).toBeDefined()
      // Billboard center X matches the plot center X; Z stays inside the slab.
      expect(billboard.x).toBeCloseTo(plot!.x, 6)
      expect(Math.abs(billboard.z)).toBeLessThanOrEqual(layout.worldHalfExtent)
      expect(billboard.width).toBe(BILLBOARD_WIDTH)
      expect(billboard.height).toBe(BILLBOARD_HEIGHT)
    }
  })
})

describe('StorefrontAdverts scene module', () => {
  it('builds one storefront per plot and era-correct billboards for 1945', () => {
    const storefronts = new StorefrontAdverts()
    const stats = storefronts.stats
    expect(stats.preparedEra).toBe('1945')
    expect(stats.storefronts).toHaveLength(PLOT_COLS * PLOT_ROWS)
    // 1945: painted signs + canvas awnings, painted billboards.
    for (const entry of stats.storefronts) {
      expect(entry.signStyle).toBe('painted')
      expect(entry.awningStyle).toBe('canvas')
      expect(entry.headline.length).toBeGreaterThan(0)
    }
    expect(stats.billboards).toHaveLength(4)
    for (const billboard of stats.billboards) {
      expect(billboard.style).toBe('painted')
      expect(billboard.headline).toBe('WAR BONDS')
    }
    // Static era — no digital surfaces.
    expect(stats.digitalCount).toBe(0)
    // Nothing floats: every registered surface has a plotId.
    storefronts.dispose()
  })

  it('changes the ground-floor treatment per era on every plot', () => {
    const storefronts = new StorefrontAdverts()
    const expectedSigns: Record<string, string> = {
      '1945': 'painted',
      '1965': 'neon_tube',
      '1985': 'neon_box',
      '2005': 'led',
      '2025': 'led_screen',
    }
    for (const era of ERA_IDS) {
      storefronts.setEra(era)
      const stats = storefronts.stats
      expect(stats.preparedEra).toBe(era)
      expect(stats.storefronts).toHaveLength(PLOT_COLS * PLOT_ROWS)
      if (expectedSigns[era]) {
        for (const entry of stats.storefronts) {
          expect(entry.signStyle).toBe(expectedSigns[era])
        }
      }
    }
    storefronts.dispose()
  })

  it('uses era-correct billboard technology for every era', () => {
    const storefronts = new StorefrontAdverts()
    const expectedTech: Record<string, string> = {
      '1945': 'painted',
      '1965': 'neon',
      '1985': 'neon',
      '2005': 'led',
      '2025': 'led',
      '2055': 'hologram',
    }
    for (const era of ERA_IDS) {
      storefronts.setEra(era)
      const stats = storefronts.stats
      expect(stats.billboards).toHaveLength(4)
      for (const billboard of stats.billboards) {
        expect(billboard.style).toBe(expectedTech[era])
        // Headline rides the EraData advertising headline.
        expect(billboard.headline).toBe(getEraData(era).advertising.headline)
      }
    }
    storefronts.dispose()
  })

  it('keeps every storefront and billboard anchored to plot ids', () => {
    const storefronts = new StorefrontAdverts()
    for (const era of ['1945', '1999', '2005', '2055'].filter((e) =>
      ERA_IDS.includes(e as (typeof ERA_IDS)[number]),
    ) as (typeof ERA_IDS)[number][]) {
      storefronts.setEra(era)
      const plotIds = new Set(storefronts.layout.plots.map((p) => p.id))
      for (const entry of storefronts.stats.storefronts) {
        expect(plotIds.has(entry.plotId)).toBe(true)
      }
      for (const billboard of storefronts.stats.billboards) {
        expect(plotIds.has(billboard.plotId)).toBe(true)
      }
    }
    storefronts.dispose()
  })

  it('animates digital-era surfaces (2005 + 2025 billboards) with cycling content', () => {
    const storefronts = new StorefrontAdverts()

    // 1945 has no digital surfaces.
    storefronts.setEra('1945')
    expect(storefronts.stats.digitalCount).toBe(0)

    // 2005 billboards + LCD shop window surfaces exist and cycle/scroll.
    storefronts.setEra('2005')
    expect(storefronts.stats.digitalCount).toBeGreaterThan(4)
    const beforeStates = storefronts.stats.digitalStates
    storefronts.update(2.6)
    const afterStates = storefronts.stats.digitalStates
    // Cycle-mode surfaces switch content; scroll-mode surfaces accumulate roll.
    const cycled = afterStates.filter((s, i) => s.index !== beforeStates[i].index)
    const scrolled = afterStates.filter(
      (s, i) => s.mode === 'scroll' && s.rollOffset > beforeStates[i].rollOffset,
    )
    expect(cycled.length).toBeGreaterThan(0)
    expect(scrolled.length).toBeGreaterThan(0)

    // 2025 billboards also cycle.
    storefronts.setEra('2025')
    expect(storefronts.stats.digitalCount).toBeGreaterThan(4)
    const before25 = storefronts.stats.digitalStates
    storefronts.update(2.6)
    const after25 = storefronts.stats.digitalStates
    expect(after25.some((s, i) => s.index !== before25[i].index)).toBe(true)

    storefronts.dispose()
  })

  it('releases all GPU resources on dispose', () => {
    const storefronts = new StorefrontAdverts()
    storefronts.setEra('2025')
    storefronts.dispose()
    expect(storefronts.stats.storefronts).toHaveLength(0)
    expect(storefronts.stats.billboards).toHaveLength(0)
    expect(storefronts.stats.digitalCount).toBe(0)
  })
})

describe('storefront z-bounds stay on the facade (nothing floats)', () => {
  it('keeps facade surfaces within the plot front plane', () => {
    const layout = buildBlockLayoutData()
    const adLayout = buildStorefrontAdLayout(layout)
    for (const facade of adLayout.facades) {
      const plot = layout.plots.find((p) => p.id === facade.plotId)!
      const north = plot.row === 0
      const edge = north ? plot.z - plot.depth / 2 : plot.z + plot.depth / 2
      // The facade plane is just outside the slab edge (outset < 0.1).
      const offset = north ? edge - facade.z : facade.z - edge
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThan(0.1)
    }
  })

  it('places band heights inside the storefront vertical stack', () => {
    // Sign band sits directly above the ground-floor band, wall ad above that.
    expect(SIGN_BAND_HEIGHT).toBeGreaterThan(0)
    expect(STOREFRONT_BAND_HEIGHT).toBeGreaterThan(SIGN_BAND_HEIGHT)
    expect(WALL_AD_HEIGHT).toBeGreaterThan(SIGN_BAND_HEIGHT)
  })
})