import { describe, expect, it } from 'vitest';
import { getEra, getEraYears } from '../../eras/index.js';
import { CITY_BLOCK_LAYOUT } from '../../layout/index.js';
import { Storefronts } from '../index.js';

/** The five canonical era years under test. */
const YEARS = [1945, 1965, 1985, 2005, 2025];

describe('Storefronts per-era rendering', () => {
  it('mounts the component lifecycle for every era', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    for (const year of YEARS) {
      const state = scene.update(year);
      expect(state.year).toBe(year);
      // A dressing + a sign for every layout storefront span.
      expect(state.storefronts.length).toBe(CITY_BLOCK_LAYOUT.storefronts.length);
      expect(state.signage.length).toBe(CITY_BLOCK_LAYOUT.storefronts.length);
      // As many ads as the era prescribes.
      expect(state.advertisements.length).toBe(getEra(year).advertisements.count);
    }
    scene.dispose();
  });

  it('renders distinct storefront genre per era', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    const styles = new Set<string>();
    for (const year of YEARS) {
      const state = scene.update(year);
      styles.add(state.eraStyleId);
      expect(state.eraStyleId).toBe(getEra(year).storefronts.styleId);
    }
    expect(styles.size).toBe(5);
    scene.dispose();
  });

  it('occupies every layout storefront span with dressing', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    const state = scene.update(1985);
    const spanIds = new Set(CITY_BLOCK_LAYOUT.storefronts.map((s) => s.id));
    for (const dressing of state.storefronts) {
      expect(spanIds).toContain(dressing.storefrontId);
      // Every span carries a canopy/awning, window display and lighting detail.
      expect(typeof dressing.canopy).toBe('boolean');
      expect(dressing.windowDressing).toBeGreaterThanOrEqual(0);
      expect(dressing.lighting).toBeGreaterThanOrEqual(0);
      expect(dressing.mannequins).toBeGreaterThanOrEqual(0);
    }
    scene.dispose();
  });

  it('derives distinct signage/ad content per era', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    const signTexts = new Set<string>();
    const adCopies = new Set<string>();
    const adMedia = new Set<string>();
    for (const year of YEARS) {
      const state = scene.update(year);
      for (const sign of state.signage) {
        signTexts.add(sign.text);
      }
      for (const ad of state.advertisements) {
        adCopies.add(ad.content);
        adMedia.add(ad.medium);
      }
    }
    // More than one distinct sign text and ad medium across the timeline.
    expect(signTexts.size).toBeGreaterThan(1);
    expect(adMedia.size).toBeGreaterThan(1);
    expect(adCopies.size).toBeGreaterThan(1);
    scene.dispose();
  });

  it('interpolates signage/ad values during a transition', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    const from = scene.update(1985);
    const mid = scene.update(1985, 0.5);
    const to = scene.update(2005);
    // Ad count interpolates between the two eras (9 -> 12).
    expect(from.advertisements.length).toBe(9);
    expect(to.advertisements.length).toBe(12);
    // At the midpoint lerp(9,12,0.5)=10.5 rounds to 11.
    expect(mid.advertisements.length).toBe(11);
    // Signage lighting interpolates upward across the transition.
    expect(mid.signage[0]!.lighting).toBeGreaterThan(from.signage[0]!.lighting);
    expect(to.signage[0]!.lighting).toBeGreaterThan(mid.signage[0]!.lighting);
    scene.dispose();
  });

  it('consumes the era registry and layout read-only', () => {
    const scene = Storefronts.instantiate();
    scene.attach();
    const before = JSON.stringify(CITY_BLOCK_LAYOUT);
    const eraBefore = JSON.stringify(getEra(1985));
    scene.update(1985);
    scene.update(2005, 0.5);
    scene.dispose();
    expect(JSON.stringify(CITY_BLOCK_LAYOUT)).toBe(before);
    expect(JSON.stringify(getEra(1985))).toBe(eraBefore);
  });

  it('throws on misuse of the lifecycle', () => {
    const scene = Storefronts.instantiate();
    expect(() => scene.state).toThrow();
    scene.attach();
    scene.update(1945);
    scene.dispose();
    expect(() => scene.update(1965)).toThrow();
  });

  it('covers all five registered era years', () => {
    expect(getEraYears()).toEqual(YEARS);
  });
});