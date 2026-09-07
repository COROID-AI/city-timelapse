import { describe, expect, it } from 'vitest';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEra2005Buildings, ERA_2005_BUILDING_TYPES } from '../../../src/eras/2005/buildings';
import { createEra2005Storefronts } from '../../../src/eras/2005/storefronts';
import { createEra2005Ads } from '../../../src/eras/2005/ads';
import { createEra2005Vehicles } from '../../../src/eras/2005/vehicles';
import { createEra2005StreetFurniture } from '../../../src/eras/2005/streetFurniture';
import { createEra2005Pedestrians } from '../../../src/eras/2005/pedestrians';
import { palette2005 } from '../../../src/eras/2005/palette';
import { era2005Audio } from '../../../src/eras/2005/audio';
import { ERA_2005_TEXTURES } from '../../../src/eras/2005/textures';

describe('Era 2005 content', () => {
  const layout = createCityBlockLayout();

  it('builds era-specific buildings against the layout anchors', () => {
    const buildings = createEra2005Buildings(layout);
expect(buildings).toHaveLength(layout.lots.length);
    const residential = buildings.find((b) => b.lotIndex === 4);
expect(residential?.type).toBe('midrise_residential');
    expect(buildings.some((b) => b.type === 'construction_hoarding')).toBe(true);
    for (const type of ERA_2005_BUILDING_TYPES) {
      expect(buildings.some((b) => b.type === type)).toBe(true);
    }
    expect(buildings.some((b) => b.rooftop.some((r) => r.kind === 'satellite_dish'))).toBe(true);    expect(buildings.some((b) => b.balconies)).toBe(true);
  });

  it('provides storefronts including coffee chainand mobile phone', () => {
    const sf = createEra2005Storefronts(layout);
expect(sf.storefronts.some((s) => s.kind === 'coffee_chain')).toBe(true);
expect(sf.storefronts.some((s) => s.kind === 'mobile_phone')).toBe(true);
expect(sf.storefronts.some((s) => s.kind === 'atm')).toBe(true);
expect(sf.storefronts.some((s) => s.kind === 'dry_cleaner')).toBe(true);
expect(sf.storefronts.some((s) => s.kind === 'discount_variety')).toBe(true);
expect(sf.storefronts.some((s) => s.kind === 'gym')).toBe(true);
    expect(sf.internetCafePoster).toBe(true);
  });

  it('provides vinyl banner ads, bus-shelter posters,and hoarding postering', () => {
    const ads = createEra2005Ads(layout);
    const surfaces = ads.ads.map((a) => a.surface);
expect(surfaces).toContain('vinyl_banner');
expect(surfaces).toContain('bus_shelter_posters');
expect(surfaces).toContain('construction_hoarding');
expect(surfaces).toContain('storefront_window_decal');
expect(surfaces).toContain('internet_cafe_poster');
  });

  it('provides silver-gray vehicles including city bus with bike rack', () => {
    const vehicles = createEra2005Vehicles(layout);
    const kinds = vehicles.vehicles.map((v) => v.kind);
expect(kinds).toContain('city_bus');
expect(kinds).toContain('bike_courier');
expect(kinds).toContain('sedan');
expect(kinds).toContain('suv');
expect(kinds).toContain('hatchback');
expect(vehicles.trafficDensity).toBe('heavy');
  });

  it('provides street furniture including LED street lights, bus shelter', () => {
    const furniture = createEra2005StreetFurniture(layout);    const kinds = furniture.furniture.map((f) => f.kind);
expect(kinds).toContain('led_street_light');
expect(kinds).toContain('bus_shelter');
expect(kinds).toContain('bike_rack');
expect(kinds).toContain('newspaper_box');
expect(kinds).toContain('public_trash_bin');
expect(kinds).toContain('fire_hydrant');
expect(kinds).toContain('street_tree_planter');
  });

  it('provides busy pedestrian density with iPod-eraand flip-phone archetypes', () => {
    const pedestrians = createEra2005Pedestrians(layout);expect(pedestrians.density).toBe('busy');
    const archetypes = pedestrians.pedestrians.map((p) => p.archetype);
expect(archetypes).toContain('ipod_earbuds');
expect(archetypes).toContain('flip_phone');
expect(archetypes).toContain('parent_stroller');
expect(archetypes).toContain('messenger_bag');
  });

  it('exposes the cool-white neutral digital palette', () => {
expect(palette2005.grade).toBe('neutral-digital');
expect(palette2005.whiteBalance).toBe('slightly-cool');
expect(palette2005.year).toBe(2005);
expect(palette2005.airQuality).toBe('clearer-than-1985');
expect(palette2005.nightGlow.b).toBeGreaterThan(palette2005.nightGlow.r);
  });

  it('registers the 2005 ambience and SFX stems', () => {
expect(era2005Audio.year).toBe(2005);
expect(era2005Audio.sfxStems).toContain('mid2000s_pop_radio_loop');
expect(era2005Audio.sfxStems).toContain('cell_phone_ring_chorus');
expect(era2005Audio.sfxStems).toContain('traffic_hum_brakes');
expect(era2005Audio.sfxStems).toContain('bus_kneel_hiss');
expect(era2005Audio.sfxStems).toContain('distant_construction');
  });

  it('describes glass-and-stone cladding textures', () => {
    const names = ERA_2005_TEXTURES.map((t) => t.name);
expect(names).toContain('glass');
expect(names).toContain('stone');
expect(names).toContain('aluminum');
expect(names).toContain('stucco');
expect(names).toContain('brick');
  });
});
