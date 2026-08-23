import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { ERA_IDS } from '../src/eras';
import type { EraId } from '../src/eras';
import { ERA_MANIFEST, getEraGroup } from '../src/eras/index';

// Imported directly so manifest entries can be verified by identity — proving
// each EraId maps to its OWN sibling module's build function.
import { buildEra1945 } from '../src/eras/1945';
import { buildEra1965 } from '../src/eras/1965';
import { buildEra1985 } from '../src/eras/1985';
import { buildEra2005 } from '../src/eras/2005';
import { buildEra2025 } from '../src/eras/2025';

const ALL_ERAS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

describe('ERA_MANIFEST registration', () => {
  it('covers all five EraIds with no gaps and no extra keys', () => {
    expect([...Object.keys(ERA_MANIFEST)]).toEqual([...ALL_ERAS]);
    expect(Object.keys(ERA_MANIFEST)).toHaveLength(ALL_ERAS.length);
    expect([...ERA_IDS]).toEqual([...ALL_ERAS]);

    for (const id of ALL_ERAS) {
      const build = ERA_MANIFEST[id];
      expect(build, `no manifest entry for EraId '${id}'`).toBeDefined();
      expect(typeof build, `entry for '${id}' is not callable`).toBe('function');
    }
  });

  it('has no duplicate registrations', () => {
    const builders = ALL_ERAS.map((id) => ERA_MANIFEST[id]);
    expect(new Set(builders).size).toBe(ALL_ERAS.length);
  });

  it('getEraGroup resolves each EraId to its own module build function', () => {
    expect(getEraGroup('1945')).toBe(buildEra1945);
    expect(getEraGroup('1965')).toBe(buildEra1965);
    expect(getEraGroup('1985')).toBe(buildEra1985);
    expect(getEraGroup('2005')).toBe(buildEra2005);
    expect(getEraGroup('2025')).toBe(buildEra2025);

    for (const id of ALL_ERAS) {
      expect(getEraGroup(id)).toBe(ERA_MANIFEST[id]);
    }
  });

  it('every resolved builder is callable and yields a populated THREE.Group', () => {
    for (const id of ALL_ERAS) {
      const group = getEraGroup(id)();
      expect(
        group instanceof THREE.Group,
        `EraId '${id}' did not build a THREE.Group`,
      ).toBe(true);
      expect(group.children.length, `era '${id}' built an empty group`).toBeGreaterThan(0);
    }
  });
});
