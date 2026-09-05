/**
 * src/content/storefronts/storefronts.test.ts — storefront acceptance tests.
 *
 * Verifies the plan acceptance criteria at the declarative + procedural
 * layer (browser screenshots remain the visual proof):
 *  - each era has a distinct non-empty storefront set with period signage,
 *    awnings, window copy and entrance styles,
 *  - spec ids are unique and era-consistent,
 *  - the geometry builder emits non-empty meshes and registers anchor
 *    followers on the shared anchor slots (morph-parity contract).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { ERA_IDS, STOREFRONT_SPECS } from '../../eras';
import { buildStorefrontGeometry } from './geometry';
import { buildStorefrontPopulation } from './build';

describe('era storefronts', () => {
  it('every era defines a distinct non-empty storefront set', () => {
    for (const id of ERA_IDS) {
      const specs = STOREFRONT_SPECS[id];
      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec.id).toMatch(new RegExp(`^s-${id}-\\d+$`));
        expect(spec.name.length).toBeGreaterThan(0);
        expect(spec.tagline.length).toBeGreaterThan(0);
        expect(spec.awning).toMatch(
          /^(canvas-stripes|scalloped|metal-rib|glass-canopy|matte-canopy)$/,
        );
        expect(spec.entrance).toMatch(
          /^(wood-recessed|chrome-glass|neon-frame|glass-slider|automatic-matte)$/,
        );
        expect(spec.facadeColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(spec.trimColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(spec.windowHeadline.length).toBeGreaterThan(0);
        expect(spec.windowSub.length).toBeGreaterThan(0);
      }
    }
  });

  it('each era uses its own awning and entrance families (distinct styles)', () => {
    const awningSets = ERA_IDS.map((id) => STOREFRONT_SPECS[id][0].awning);
    const entranceSets = ERA_IDS.map((id) => STOREFRONT_SPECS[id][0].entrance);
    expect(new Set(awningSets).size).toBe(5);
    expect(new Set(entranceSets).size).toBe(5);
  });

  it('storefront ids are unique across all eras', () => {
    const ids = ERA_IDS.flatMap((id) => STOREFRONT_SPECS[id].map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('geometry builder emits non-empty meshes and anchor followers', () => {
    for (const id of ERA_IDS) {
      const spec = STOREFRONT_SPECS[id][0];
      const build = buildStorefrontGeometry(spec, 0);
      expect(build.parts.length).toBeGreaterThan(0);
      const followerSlots = build.parts
        .filter((p) => p.slot)
        .map((p) => p.slot);
      expect(followerSlots).toContain('window');
      expect(followerSlots).toContain('doorway');
      build.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    }
  });

  it('buildStorefrontPopulation registers followers for the shared slots', () => {
    for (const id of ERA_IDS) {
      const pop = buildStorefrontPopulation(id, { buildMaterials: false });
      const slots = new Set(pop.registration.followers.map((f) => f.slot));
      expect(slots.has('window')).toBe(true);
      expect(slots.has('doorway')).toBe(true);
      pop.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    }
  });
});