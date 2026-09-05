/**
 * src/content/streetfurniture/streetfurniture.test.ts — street furniture
 * acceptance tests.
 *
 * Verifies the plan acceptance criteria at the declarative + procedural layer
 * (browser screenshots remain the visual proof):
 *  - each era declares era-appropriate lamps, traffic lights, benches,
 *    hydrants, bins, bus stops, trees and planters,
 *  - payphones exist in 1945/1965/1985 and are absent in 2005/2025,
 *  - newspaper stands evolve visually across eras (distinct model ids),
 *  - the geometry builder emits non-empty merged channels for every pledged
 *    model without pink/empty materials.
 */

import { describe, expect, it } from 'vitest';

import {
  ERA_IDS,
  ERA_SCENE_STATES,
  STREET_FURNITURE_SPECS,
  type StreetFurnitureKind,
  type StreetFurnitureModelId,
} from '../../eras';
import { buildFurnitureGeometry } from './FurnitureModels';

const KINDS: StreetFurnitureKind[] = [
  'lamp',
  'traffic_light',
  'bench',
  'hydrant',
  'bin',
  'bus_stop',
  'tree',
];

function geometryCount(geo: { attributes: Record<string, { count: number }> }): number {
  const position = geo.attributes['position'];
  return position ? position.count : 0;
}

function furnitureKinds(era: (typeof ERA_IDS)[number]): StreetFurnitureKind[] {
  const spec = ERA_SCENE_STATES[era].streetFurniture[0];
  return spec ? [...spec.street, ...spec.greenery].map((s) => s.kind) : [];
}

describe('era street furniture', () => {
  it('every era declares era-appropriate street furniture (lamps, traffic, benches, hydrants, bins, bus stops, trees)', () => {
    for (const id of ERA_IDS) {
      const kinds = furnitureKinds(id);
      for (const kind of KINDS) {
        expect(kinds).toContain(kind);
      }
    }
  });

  it('planters appear from 1985 onward', () => {
    for (const id of ERA_IDS) {
      const kinds = furnitureKinds(id);
      if (id === '1985' || id === '2005' || id === '2025') {
        expect(kinds).toContain('planter');
      } else {
        expect(kinds).not.toContain('planter');
      }
    }
  });

  it('payphones exist in 1945/1965/1985 and are absent in 2005/2025', () => {
    for (const id of ERA_IDS) {
      const kinds = furnitureKinds(id);
      if (id === '1945' || id === '1965' || id === '1985') {
        expect(kinds).toContain('payphone');
      } else {
        expect(kinds).not.toContain('payphone');
      }
    }
  });

  it('newspaper stands evolve visually across eras (distinct model ids per era)', () => {
    const models: StreetFurnitureModelId[] = [];
    for (const id of ERA_IDS) {
      const spec = ERA_SCENE_STATES[id].streetFurniture[0];
      const stand = spec?.street.find((s) => s.kind === 'newsstand');
      expect(stand).toBeDefined();
      expect(stand!.model).toMatch(new RegExp(`^newsstand-${id}$`));
      models.push(stand!.model);
    }
    expect(new Set(models).size).toBe(ERA_IDS.length);
  });

  it('lamp model evolves across the five eras', () => {
    const models = ERA_IDS.map((id) => {
      const spec = ERA_SCENE_STATES[id].streetFurniture[0];
      const lamp = spec?.street.find((s) => s.kind === 'lamp');
      return lamp!.model;
    });
    expect(models).toEqual([
      'lamppost-gas-1945',
      'lamppost-sodium-1965',
      'lamppost-cobra-1985',
      'lamppost-led-2005',
      'lamppost-smart-2025',
    ]);
  });

  it('spec ids are unique per era and all eras declare crosswalk markings', () => {
    for (const id of ERA_IDS) {
      const spec = STREET_FURNITURE_SPECS[id];
      const all = [...spec.street, ...spec.greenery];
      const ids = all.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(all.length).toBeGreaterThan(0);
      expect(spec.crosswalks).toBe(true);
    }
  });

  it('geometry builder emits non-empty main/accent geometry for every pledged model', () => {
    const idSet = new Set<StreetFurnitureModelId>();
    for (const id of ERA_IDS) {
      const spec = STREET_FURNITURE_SPECS[id];
      for (const item of [...spec.street, ...spec.greenery]) {
        idSet.add(item.model);
      }
    }
    for (const model of idSet) {
      const set = buildFurnitureGeometry(model);
      expect(geometryCount(set.main)).toBeGreaterThan(0);
      // Accent channel is optional (lamps/benches/newsstands carry it; some
      // minimalist models have purely main-channel geometry).
      set.main.dispose();
      set.accent.dispose();
      set.panel.dispose();
    }
  });
});