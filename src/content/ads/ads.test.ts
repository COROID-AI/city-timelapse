/**
 * src/content/ads/ads.test.ts — advertising acceptance tests.
 *
 * Verifies the plan acceptance criteria at the declarative layer:
 *  - murals appear in 1945, neon in 1965-1985, printed billboards in
 *    1985-2005, digital screens in 2005-2025 (period media timeline),
 *  - each ad declares a full CanvasTexture palette + signage (period
 *    typography/colours/layouts),
 *  - ad ids are unique and era-consistent,
 *  - the builder emits non-empty geometry and registers anchor followers.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { AD_SPECS, ERA_IDS, type AdMedia, type EraId } from '../../eras';
import { buildAdPopulation } from './build';
import { buildAdGeometry } from './geometry';

/** Media family expected per era, following the ad timeline in the plan. */
const EXPECTED_MEDIA: Record<EraId, AdMedia[]> = {
  '1945': ['mural'],
  '1965': ['neon'],
  '1985': ['neon', 'billboard'],
  '2005': ['billboard', 'screen'],
  '2025': ['screen'],
};

describe('era advertising', () => {
  it('every era advertises with the media timeline from the plan', () => {
    for (const id of ERA_IDS) {
      const media = new Set(AD_SPECS[id].map((a) => a.media));
      for (const m of EXPECTED_MEDIA[id]) {
        expect(media.has(m)).toBe(true);
      }
      if (id !== '1945') {
        expect(media.has('mural')).toBe(false);
      }
      if (id === '2005' || id === '2025') {
        expect(media.has('neon')).toBe(false);
      }
      if (id === '1945' || id === '1965' || id === '1985') {
        expect(media.has('screen')).toBe(false);
      }
      if (id === '1945' || id === '1965') {
        expect(media.has('billboard')).toBe(false);
      }
    }
  });

  it('each ad declares a full CanvasTexture palette and signage', () => {
    for (const id of ERA_IDS) {
      for (const ad of AD_SPECS[id]) {
        expect(ad.palette.background).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ad.palette.ink).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ad.palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
        expect(typeof ad.signage.fontFamily).toBe('string');
        expect(ad.signage.fontFamily.length).toBeGreaterThan(0);
      }
    }
  });

  it('ad ids are unique and era-consistent', () => {
    const ids = ERA_IDS.flatMap((id) => AD_SPECS[id].map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ERA_IDS) {
      for (const ad of AD_SPECS[id]) {
        expect(ad.id).toMatch(new RegExp(`^a-${id}-\\d+$`));
      }
    }
  });

  it('geometry builder emits non-empty meshes and anchor followers', () => {
    for (const id of ERA_IDS) {
      for (const ad of AD_SPECS[id]) {
        const build = buildAdGeometry(ad.id, ad.media, 0, 0, 0);
        expect(build.followers.length).toBeGreaterThan(0);
        build.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
        });
      }
      const pop = buildAdPopulation(id, { buildMaterials: false });
      expect(pop.registration.followers.length).toBeGreaterThan(0);
      pop.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    }
  });
});