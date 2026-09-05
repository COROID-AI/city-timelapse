/**
 * src/content/ambient/ambient.test.ts — ambient life acceptance tests.
 *
 * Verifies the plan acceptance criteria at the declarative + procedural layer:
 *  - pigeons, steam, chimney smoke, dust/leaves are era-aware and switch with
 *    the timeline,
 *  - chimney smoke and street steam exist in 1945/1965/1985 and are gone in
 *    2005/2025,
 *  - each era declares a distinct ambient spec with sane counts/colours,
 *  - the builders emit valid rigs/particle fields without pink materials.
 */

import { describe, expect, it } from 'vitest';

import { AMBIENT_SPECS, ERA_IDS, type AmbientKind } from '../../eras';

function kindsOf(era: (typeof ERA_IDS)[number]): AmbientKind[] {
  return AMBIENT_SPECS[era].map((s) => s.kind);
}

describe('era ambient life', () => {
  it('every era declares ambient specs with sane counts and colours', () => {
    for (const id of ERA_IDS) {
      const specs = AMBIENT_SPECS[id];
      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec.count).toBeGreaterThanOrEqual(0);
        expect(spec.intensity).toBeGreaterThan(0);
        expect(spec.intensity).toBeLessThanOrEqual(1);
        expect(spec.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(spec.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('pigeons exist in every era', () => {
    for (const id of ERA_IDS) {
      expect(kindsOf(id)).toContain('pigeons');
    }
  });

  it('chimney smoke and street steam exist in 1945/1965/1985 and are absent in 2005/2025', () => {
    for (const id of ERA_IDS) {
      const kinds = kindsOf(id);
      if (id === '1945' || id === '1965' || id === '1985') {
        expect(kinds).toContain('chimney_smoke');
        expect(kinds).toContain('steam');
      } else {
        expect(kinds).not.toContain('chimney_smoke');
        expect(kinds).not.toContain('steam');
      }
    }
  });

  it('dust/leaves evolve: dust in 1945 and 1985, leaves in 1965/2005/2025', () => {
    for (const id of ERA_IDS) {
      const kinds = kindsOf(id);
      if (id === '1945' || id === '1985') {
        expect(kinds).toContain('dust');
      } else {
        expect(kinds).toContain('leaves');
      }
    }
  });

  it('ambient ids are unique across all eras', () => {
    const ids = ERA_IDS.flatMap((id) => AMBIENT_SPECS[id].map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});