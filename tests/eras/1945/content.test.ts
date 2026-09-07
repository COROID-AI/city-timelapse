import { describe, expect, it } from 'vitest';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { eraRegistry } from '../../../src/state/eraRegistry';
import { validateStreetFeature } from '../../../src/types/streetFeature';
import { era1945Content } from '../../../src/eras/1945/index';
import { era1945Palette, apply1945Grade } from '../../../src/eras/1945/palette';
import { era1945Buildings } from '../../../src/eras/1945/buildings';
import { era1945Storefronts } from '../../../src/eras/1945/storefronts';
import { era1945Ads } from '../../../src/eras/1945/ads';
import { era1945Vehicles } from '../../../src/eras/1945/vehicles';
import { era1945Pedestrians } from '../../../src/eras/1945/pedestrians';
import { era1945StreetFurniture, era1945TramTracks } from '../../../src/eras/1945/streetFurniture';
import { era1945SfxStems } from '../../../src/eras/1945/audio';
import { era1945Textures, findTexture } from '../../../src/eras/1945/textures';

describe('Era 1945 content module', () => {
  it('implements the EraContent contract for 1945', () => {
    expect(era1945Content.year).toBe(1945);
    expect(era1945Content.meta.year).toBe(1945);
    expect(era1945Content.meta.label).toBe('1945');
  });

  it('is registered in the era registry as a canonical era', () => {
    const meta = eraRegistry.get(1945);
    expect(meta).toBeDefined();
    expect(meta.tags).toContain('post-war');
  });

  it('covers post-war architecture for all 10 lots', () => {
    const layout = createCityBlockLayout();
    expect(era1945Buildings).toHaveLength(10);
    // Buildings land on their lot anchors.
    for (const b of era1945Buildings) {
      expect(b.lotIndex).toBeGreaterThanOrEqual(0);
      expect(b.lotIndex).toBeLessThan(10);
      expect(layout.lots[b.lotIndex]).toBeDefined();
    }
  });

  it('includes war-era repair gaps and bombed lots', () => {
    const hasGap = era1945Buildings.some((b) => b.gaps.length > 0);
    const hasPatch = era1945Buildings.some((b) => b.patches.length > 0);
    const hasStain = era1945Buildings.some((b) => b.smokeStained);
    expect(hasGap).toBe(true);
    expect(hasPatch).toBe(true);
    expect(hasStain).toBe(true);
  });

  it('includes sash windows and fire escapes', () => {
    const hasWindow = era1945Buildings.some((b) => b.windows.length > 0);
    const hasEscape = era1945Buildings.some((b) => b.fireEscapes.length > 0);
    expect(hasWindow).toBe(true);
    expect(hasEscape).toBe(true);
  });

  it('covers the corner grocer, pharmacy, barber and haberdashery', () => {
    const types = era1945Storefronts.map((s) => s.type).sort();
    expect(types).toEqual(['barber', 'grocer', 'haberdashery', 'pharmacy']);
    for (const s of era1945Storefronts) {
      expect(s.fascia.name.length).toBeGreaterThan(0);
      expect(s.awning.depth).toBeGreaterThan(0);
      expect(s.windowDisplay.width).toBeGreaterThan(0);
      expect(['open', 'closed']).toContain(s.plaque);
    }
  });

  it('covers wall murals, cola signage, newspaper stands and posters', () => {
    expect(era1945Ads.murals.length).toBeGreaterThan(0);
    expect(era1945Ads.colaSigns.length).toBeGreaterThan(0);
    expect(era1945Ads.newspaperStands.length).toBeGreaterThan(0);
    expect(era1945Ads.posters.length).toBeGreaterThan(0);
    // Period headlines present.
    const headlines = era1945Ads.newspaperStands.map((n) => n.headline);
    expect(headlines.join(' ').toLowerCase()).toContain('war');
  });

  it('covers 1940s sedans, a bus and delivery trucks', () => {
    expect(era1945Vehicles.some((v) => v.kind === 'sedan')).toBe(true);
    expect(era1945Vehicles.some((v) => v.kind === 'bus')).toBe(true);
    expect(era1945Vehicles.some((v) => v.kind === 'truck')).toBe(true);
    // Slow, sparse traffic.
    for (const v of era1945Vehicles) {
      expect(v.speed).toBeLessThan(7);
    }
  });

  it('covers lamp posts, fire alarms, bicycle racks and a mailbox', () => {
    const kinds = era1945StreetFurniture.map((f) => f.kind);
    expect(kinds).toContain('lamp_post');
    expect(kinds).toContain('fire_alarm');
    expect(kinds).toContain('bicycle_rack');
    expect(kinds).toContain('mailbox');
    // Lamp posts glow warm.
    expect(era1945StreetFurniture.some((f) => f.kind === 'lamp_post' && f.lit)).toBe(true);
  });

  it('includes tram tracks because the layout has a cross street', () => {
    const layout = createCityBlockLayout();
    expect(layout.crossStreet).toBeDefined();
    expect(era1945TramTracks.present).toBe(true);
    expect(era1945TramTracks.gauge).toBeGreaterThan(0);
  });

  it('covers men in fedoras/suits, women in dresses, soldiers and children with hoops', () => {
    const arches = era1945Pedestrians.map((p) => p.archetype);
    expect(arches).toContain('man_fedora');
    expect(arches).toContain('man_suit');
    expect(arches).toContain('woman_dress');
    expect(arches).toContain('soldier');
    expect(arches).toContain('child_hoop');
    // Low pedestrian count.
    expect(era1945Pedestrians.length).toBeLessThan(10);
  });

  it('exposes a sepia-warm, low-saturation palette', () => {
    expect(era1945Palette.sepiaWarm).toBe(true);
    expect(era1945Palette.saturation).toBeLessThan(0.6);
    // Sepia is warm (r >= b).
    expect(era1945Palette.sepia.r).toBeGreaterThan(era1945Palette.sepia.b);
    // Incandescent glow is warm 2700K (r > b).
    expect(era1945Palette.incandescent.r).toBeGreaterThan(era1945Palette.incandescent.b);
  });

  it('applies a sepia-warm, low-saturation grade to colours', () => {
    const graded = apply1945Grade({ r: 0.5, g: 0.5, b: 0.5 });
    // Desaturation toward warm sepia: red channel >= blue channel.
    expect(graded.r).toBeGreaterThanOrEqual(graded.b);
    expect(graded.r).toBeGreaterThan(0);
    expect(graded.b).toBeLessThanOrEqual(1);
  });

  it('registers the 1945 SFX stems', () => {
    const ids = era1945SfxStems.map((s) => s.id);
    expect(ids).toContain('propeller_plane_flyover');
    expect(ids).toContain('distant_tram_bell');
    expect(ids).toContain('engine_rumble');
    expect(ids).toContain('newspaper_boy_shout');
    expect(ids).toContain('radio_jingle_loop');
    // At least one looping ambience stem.
    expect(era1945SfxStems.some((s) => s.loop)).toBe(true);
  });

  it('provides coal-smoke-stained masonry textures', () => {
    expect(era1945Textures.length).toBeGreaterThan(0);
    const smoke = findTexture('smoke-stained-brick');
    expect(smoke).toBeDefined();
    expect(smoke!.cells.length).toBe(smoke!.width * smoke!.height);
    // Top cells are darker (sootier) than bottom cells.
    if (smoke) {
      const top = smoke.cells[(smoke.height - 1) * smoke.width];
      const bottom = smoke.cells[0];
      expect(top.r).toBeLessThan(bottom.r);
    }
  });

  it('exposes validated street features for the shared contract', () => {
    for (const f of era1945Content.streetFeatures) {
      expect(validateStreetFeature(f)).toBeNull();
    }
    expect(era1945Content.streetFeatures.length).toBe(era1945StreetFurniture.length);
  });
});