/**
 * Storefront era-variant, signage generator, and composition tests.
 *
 * Covers:
 * - canonical bay-slot constants (6-unit pitch, 5-unit clear width, base at
 *   0.15, sign band 3.2..4.2);
 * - the five-year era variant catalogue against the acceptance criteria;
 * - procedural signage texture generators (kinds, dimensions, memoization);
 * - composition of real shopfronts with the real `EraTransformable` registry
 *   and the real `ProceduralGfxLibrary`: staged facade-before-signage morphs,
 *   weight continuity (no popping), texture identity stability, pickable
 *   descriptors, instanced display/poster batches, emissive drive, and the
 *   documented neon/LED audio hook events.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createEraMorphSystem,
} from '../../era/contracts';
import type { EraYear } from '../../era/timeline';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import {
  StorefrontsModule,
  createStorefrontsModule,
  disposeSignageTextureCache,
  frameColorFor,
  signageCacheSize,
  createBaySignageArt,
  createFasciaSignTexture,
  createTransomLetteringTexture,
  createBillboardTexture,
  createTickerTexture,
  createMenuBoardTexture,
  createBladeSignTexture,
  createWindowDisplayTexture,
} from './index';
import {
  BAY_BASE_Y,
  BAY_CLEAR_WIDTH,
  BAY_SLOT_PITCH,
  ERA_STOREFRONT_VARIANTS,
  SIGN_BAND_CENTER_Y,
  SIGN_BAND_MAX_Y,
  SIGN_BAND_MIN_Y,
  STOREFRONT_AUDIO_HOOKS,
  STOREFRONT_AUDIO_HOOK_LIST,
  STOREFRONT_VARIANT_YEARS,
  brandForBay,
  createBaySlots,
  headlineForSlot,
  taglineForBay,
} from './variants';
import type { StorefrontAudioEvent, StorefrontsOptions } from './index';

/* -------------------------------------------------------------------------- */
/* Test harness                                                                */
/* -------------------------------------------------------------------------- */

const live: ReturnType<typeof createStorefrontsModule>[] = [];

function build(options: StorefrontsOptions = {}): ReturnType<typeof createStorefrontsModule> {
  const module = createStorefrontsModule({ bays: 3, ...options });
  live.push(module);
  return module;
}

afterEach(() => {
  for (const module of live.splice(0)) module.dispose();
});

afterAll(() => {
  disposeSignageTextureCache();
});

function collectMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      const std = material as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) out.push(std);
    }
  });
  return out;
}

function collectMapUuids(root: THREE.Object3D): string[] {
  return collectMaterials(root)
    .map((material) => material.map)
    .filter((map): map is THREE.Texture => map !== null)
    .map((map) => map.uuid)
    .sort();
}

function collectNames(root: THREE.Object3D, prefix: string): string[] {
  const names = new Set<string>();
  root.traverse((object) => {
    if (object.name && object.name.startsWith(prefix)) names.add(object.name);
  });
  return [...names].sort();
}

/** Count every object whose name starts with `prefix` (no dedupe). */
function countNamed(root: THREE.Object3D, prefix: string): number {
  let count = 0;
  root.traverse((object) => {
    if (object.name && object.name.startsWith(prefix)) count += 1;
  });
  return count;
}

function findInstanced(
  root: THREE.Object3D,
  kind: string,
): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.InstancedMesh;
    if (mesh.isInstancedMesh && mesh.userData.instanceKind === kind) out.push(mesh);
  });
  return out;
}

function runTo(target: number, system: ReturnType<typeof createEraMorphSystem>): void {
  system.driver.transitionTo(target, 1);
  let guard = 0;
  while (system.core.isTransitioning && guard < 5000) {
    system.driver.advance(0.05);
    guard += 1;
  }
  expect(system.core.isTransitioning).toBe(false);
}

/* -------------------------------------------------------------------------- */
/* Canonical bay-slot geometry                                                 */
/* -------------------------------------------------------------------------- */

describe('canonical storefront bay-slot constants', () => {
  it('pins the contract geometry: 6-unit pitch, 5-unit width, base, sign band', () => {
    expect(BAY_SLOT_PITCH).toBe(6);
    expect(BAY_CLEAR_WIDTH).toBe(5);
    expect(BAY_BASE_Y).toBe(0.15);
    expect(SIGN_BAND_MIN_Y).toBe(3.2);
    expect(SIGN_BAND_MAX_Y).toBe(4.2);
    expect(SIGN_BAND_CENTER_Y).toBeCloseTo(3.7, 6);
    // Clear bays never overlap: the 1-unit gap is the pier between bays.
    expect(BAY_SLOT_PITCH - BAY_CLEAR_WIDTH).toBeGreaterThan(0);
  });

  it('computes slots every 6 units with stable ids', () => {
    const slots = createBaySlots(4);
    expect(slots.map((slot) => slot.x)).toEqual([0, 6, 12, 18]);
    expect(slots.map((slot) => slot.id)).toEqual(['bay-0', 'bay-1', 'bay-2', 'bay-3']);
    expect(slots.every((slot) => slot.z === 0 && slot.rotationY === 0)).toBe(true);
    const offset = createBaySlots(2, { originX: -7, originZ: 3, rotationY: Math.PI });
    expect(offset[0]).toMatchObject({ x: -7, z: 3, rotationY: Math.PI });
    expect(offset[1].x).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- */
/* Era variant catalogue                                                       */
/* -------------------------------------------------------------------------- */

describe('era storefront variant catalogue', () => {
  const expected: Record<
    EraYear,
    {
      fasciaSign: string;
      transomSign: string;
      awning: string;
      windowDisplay: string;
      billboard: string;
      kiosk: string;
      newsstand: string;
      pushcart: boolean;
      menuBoard: boolean;
      ticker: boolean;
      projectionGlass: boolean;
      bladeSign: string | null;
    }
  > = {
    1945: {
      fasciaSign: 'enamel-plate',
      transomSign: 'gold-leaf-glass',
      awning: 'scalloped-fabric',
      windowDisplay: 'butcher-paper',
      billboard: 'painted-rooftop',
      kiosk: 'lit-poster-column',
      newsstand: 'wooden-paper-rack',
      pushcart: true,
      menuBoard: false,
      ticker: false,
      projectionGlass: false,
      bladeSign: 'enamel-plate',
    },
    1965: {
      fasciaSign: 'pastel-channel-letters',
      transomSign: 'pastel-channel-letters',
      awning: 'pastel-scalloped',
      windowDisplay: 'animated-pastel',
      billboard: 'pastel-wall-painted',
      kiosk: 'poster-pillar',
      newsstand: 'metal-magazine-rack',
      pushcart: true,
      menuBoard: false,
      ticker: false,
      projectionGlass: false,
      bladeSign: null,
    },
    1985: {
      fasciaSign: 'neon-tube',
      transomSign: 'neon-tube',
      awning: 'slim-metal',
      windowDisplay: 'arcade-glow',
      billboard: 'bold-neon-rooftop',
      kiosk: 'backlit-poster-kiosk',
      newsstand: 'backlit-newsstand',
      pushcart: false,
      menuBoard: false,
      ticker: false,
      projectionGlass: false,
      bladeSign: 'backlit-box',
    },
    2005: {
      fasciaSign: 'push-through-plastic',
      transomSign: 'push-through-plastic',
      awning: 'wedge-fabric',
      windowDisplay: 'chain-merch',
      billboard: 'backlit-billboard',
      kiosk: 'lcd-ad-panel',
      newsstand: 'chain-kiosk',
      pushcart: false,
      menuBoard: true,
      ticker: true,
      projectionGlass: false,
      bladeSign: 'backlit-box',
    },
    2025: {
      fasciaSign: 'led-matrix',
      transomSign: 'led-matrix',
      awning: 'none',
      windowDisplay: 'projection-mapped',
      billboard: 'led-digital',
      kiosk: 'led-wrap-kiosk',
      newsstand: 'smart-glass-kiosk',
      pushcart: false,
      menuBoard: true,
      ticker: true,
      projectionGlass: true,
      bladeSign: null,
    },
  };

  it('declares era-correct treatments for all five years', () => {
    expect([...STOREFRONT_VARIANT_YEARS]).toEqual([1945, 1965, 1985, 2005, 2025]);
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      expect(variant.year).toBe(year);
      expect(variant).toMatchObject(expected[year]);
    }
  });

  it('ramps emissive intensity from incandescent 1945 to LED 2025', () => {
    expect(ERA_STOREFRONT_VARIANTS[1945].emissive.character).toBe('incandescent');
    expect(ERA_STOREFRONT_VARIANTS[1965].emissive.character).toBe('fluorescent');
    expect(ERA_STOREFRONT_VARIANTS[1985].emissive.character).toBe('neon');
    expect(ERA_STOREFRONT_VARIANTS[2005].emissive.character).toBe('backlit');
    expect(ERA_STOREFRONT_VARIANTS[2025].emissive.character).toBe('led');
    expect(ERA_STOREFRONT_VARIANTS[1945].emissive.baseIntensity).toBeLessThan(
      ERA_STOREFRONT_VARIANTS[1985].emissive.baseIntensity,
    );
    expect(ERA_STOREFRONT_VARIANTS[1985].emissive.baseIntensity).toBeGreaterThanOrEqual(
      ERA_STOREFRONT_VARIANTS[2005].emissive.baseIntensity,
    );
  });

  it('documents only the published audio hooks per era', () => {
    expect([...STOREFRONT_AUDIO_HOOK_LIST]).toEqual([
      STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
      STOREFRONT_AUDIO_HOOKS.FLUORESCENT_HUM,
      STOREFRONT_AUDIO_HOOKS.NEON_HUM,
      STOREFRONT_AUDIO_HOOKS.NEON_FLICKER,
      STOREFRONT_AUDIO_HOOKS.BACKLIT_BUZZ,
      STOREFRONT_AUDIO_HOOKS.LED_SCROLL,
      STOREFRONT_AUDIO_HOOKS.LED_TICK,
    ]);
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const hooks = ERA_STOREFRONT_VARIANTS[year].audioHooks;
      expect(hooks.length).toBeGreaterThan(0);
      for (const hook of hooks) {
        expect(STOREFRONT_AUDIO_HOOK_LIST).toContain(hook);
      }
    }
    // Neon ambience is documented for 1985; LED ambience for 2025.
    expect(ERA_STOREFRONT_VARIANTS[1985].audioHooks).toContain(
      STOREFRONT_AUDIO_HOOKS.NEON_FLICKER,
    );
    expect(ERA_STOREFRONT_VARIANTS[1985].audioHooks).toContain(STOREFRONT_AUDIO_HOOKS.NEON_HUM);
    expect(ERA_STOREFRONT_VARIANTS[2025].audioHooks).toContain(STOREFRONT_AUDIO_HOOKS.LED_SCROLL);
    expect(ERA_STOREFRONT_VARIANTS[2025].audioHooks).toContain(STOREFRONT_AUDIO_HOOKS.LED_TICK);
  });

  it('provides invented, non-empty brand vocabulary per era', () => {
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      expect(variant.brands.length).toBeGreaterThanOrEqual(5);
      expect(new Set(variant.brands).size).toBe(variant.brands.length);
      for (const brand of variant.brands) {
        expect(brand.length).toBeGreaterThan(0);
        expect(brand).toBe(brand.toUpperCase());
      }
      expect(variant.taglines.length).toBeGreaterThan(0);
      expect(variant.headlines.length).toBeGreaterThan(0);
      expect(variant.windowProducts.length).toBeGreaterThan(0);
      // Deterministic per-bay picks stay inside the era vocabulary.
      expect(variant.brands).toContain(brandForBay(variant, 1));
      expect(variant.taglines).toContain(taglineForBay(variant, 1));
      expect(variant.headlines).toContain(headlineForSlot(variant, 1));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Procedural signage generators                                               */
/* -------------------------------------------------------------------------- */

describe('procedural signage texture generators', () => {
  it('generates the era-correct fascia sign kind for every year', () => {
    const expectedKind: Record<EraYear, string> = {
      1945: 'fascia.enamel-plate',
      1965: 'fascia.pastel-channel-letters',
      1985: 'fascia.neon-tube',
      2005: 'fascia.push-through-plastic',
      2025: 'fascia.led-matrix',
    };
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const art = createFasciaSignTexture({ variant: ERA_STOREFRONT_VARIANTS[year], bayIndex: 0 });
      expect(art.kind).toBe(expectedKind[year]);
      expect(art.width).toBe(512);
      expect(art.height).toBe(128);
      expect(art.texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(art.texture.image).toBeTruthy();
    }
  });

  it('generates gold-leaf transom art in 1945 and era kinds later', () => {
    const gold = createTransomLetteringTexture({
      variant: ERA_STOREFRONT_VARIANTS[1945],
      bayIndex: 0,
    });
    expect(gold.kind).toBe('transom.gold-leaf-glass');
    expect(gold.height).toBe(96);
    const neon = createTransomLetteringTexture({
      variant: ERA_STOREFRONT_VARIANTS[1985],
      bayIndex: 0,
    });
    expect(neon.kind).toBe('transom.neon-tube');
    expect(neon.emissiveIntensity).toBeGreaterThan(1);
  });

  it('memoizes textures per (era, copy, seed) and disposes as a batch', () => {
    const variant = ERA_STOREFRONT_VARIANTS[1945];
    const a = createFasciaSignTexture({ variant, bayIndex: 2 });
    const b = createFasciaSignTexture({ variant, bayIndex: 2 });
    const c = createFasciaSignTexture({ variant, bayIndex: 1 });
    expect(a).toBe(b); // same art → same GPU texture (no duplication)
    expect(a).not.toBe(c); // different bay copy → distinct art
    const size = signageCacheSize();
    expect(size).toBeGreaterThanOrEqual(3);
    disposeSignageTextureCache();
    expect(signageCacheSize()).toBe(0);
    // Regeneration after disposal produces a fresh texture object.
    const d = createFasciaSignTexture({ variant, bayIndex: 2 });
    expect(d).not.toBe(a);
  });

  it('builds billboards, blade signs, and window displays per era treatment', () => {
    const bb = createBillboardTexture({
      variant: ERA_STOREFRONT_VARIANTS[1985],
      bayIndex: 0,
    });
    expect(bb.kind).toBe('billboard.bold-neon-rooftop');
    expect(bb.width).toBe(1024);
    expect(bb.height).toBe(512);
    expect(bb.emissiveIntensity).toBeGreaterThan(0);

    const blade = createBladeSignTexture({
      variant: ERA_STOREFRONT_VARIANTS[1965],
      bayIndex: 0,
    });
    expect(blade).toBeNull(); // 1965 does not use a blade sign
    const blade85 = createBladeSignTexture({
      variant: ERA_STOREFRONT_VARIANTS[1985],
      bayIndex: 0,
    });
    expect(blade85?.kind).toBe('blade.backlit-box');

    for (const year of STOREFRONT_VARIANT_YEARS) {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      const windowArt = createWindowDisplayTexture({ variant, bayIndex: 0 });
      expect(windowArt.kind).toBe(`window.${variant.windowDisplay}`);
      expect(windowArt.width).toBe(512);
      expect(windowArt.height).toBe(256);
    }
  });

  it('emits ticker and menu board strips only for the eras that use them', () => {
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      const ticker = createTickerTexture({ variant, bayIndex: 0 });
      const menu = createMenuBoardTexture({ variant, bayIndex: 0 });
      expect(ticker !== null).toBe(variant.ticker);
      expect(menu !== null).toBe(variant.menuBoard);
      if (ticker) {
        expect(ticker.width).toBe(1024);
        expect(ticker.texture.wrapS).toBe(THREE.RepeatWrapping);
      }
    }
  });

  it('assembles complete per-bay art sets for every era', () => {
    for (const year of STOREFRONT_VARIANT_YEARS) {
      const art = createBaySignageArt({ variant: ERA_STOREFRONT_VARIANTS[year], bayIndex: 0 });
      expect(art.fascia).toBeTruthy();
      expect(art.transom).toBeTruthy();
      expect(art.billboard).toBeTruthy();
      expect(art.poster).toBeTruthy();
      expect(art.kiosk).toBeTruthy();
      expect(art.windowDisplay).toBeTruthy();
      expect(art.newsstand).toBeTruthy();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Composition: shopfronts + EraTransformable registry + gfx library           */
/* -------------------------------------------------------------------------- */

describe('composition with the era transform contract and gfx library', () => {
  it('registers every shopfront, billboard, and sign into the real registry', () => {
    const system = createEraMorphSystem();
    const module = build();
    const off = module.register(system.registry);
    expect(system.registry.size).toBe(module.transformables.length);
    // 3 bays × (facade + signage) + poster wall + 2 billboards + kiosk + newsstand.
    expect(system.registry.size).toBe(3 * 2 + 5);
    // Choreography order: all facade pieces sort before any signage piece.
    const stages = system.registry.members.map((member) => member.stage);
    const firstSignage = stages.indexOf('signage');
    expect(firstSignage).toBeGreaterThan(0);
    expect(stages.slice(0, firstSignage).every((stage) => stage === 'facade')).toBe(true);
    expect(stages.slice(firstSignage).every((stage) => stage === 'signage')).toBe(true);
    off();
    expect(system.registry.size).toBe(0);
  });

  it('builds from the real gfx library and carries era-correct scene content', () => {
    const module = build();
    const materials = collectMaterials(module.group);
    expect(materials.length).toBeGreaterThan(50);
    // Materials composed through ProceduralGfxLibrary.createEraMaterial.
    const fromLibrary = materials.filter((m) => m.userData.source === 'gfx-library-procedural');
    expect(fromLibrary.length).toBeGreaterThan(0);
    // Signage faces composed through the procedural canvas generators.
    const fromSignage = materials.filter((m) => m.userData.source === 'storefront-signage');
    expect(fromSignage.length).toBeGreaterThan(50);
    expect(ProceduralGfxLibrary.createEraMaterial).toBeTypeOf('function');

    const bay = module.group.children.find((child) => child.name === 'shopfront-bay-0');
    expect(bay).toBeTruthy();
    if (!bay) return;

    // All five fascia treatments exist in every bay (crossfaded by era).
    expect(collectNames(bay, 'fascia-')).toEqual([
      'fascia-enamel-plate',
      'fascia-led-matrix',
      'fascia-neon-tube',
      'fascia-pastel-channel-letters',
      'fascia-push-through-plastic',
    ]);
    // Awnings: four fabric/metal eras; 2025 has none.
    expect(collectNames(bay, 'awning-')).toEqual([
      'awning-pastel-scalloped',
      'awning-scalloped-fabric',
      'awning-slim-metal',
      'awning-wedge-fabric',
    ]);
    // Window displays exist for every era, stocked with era products.
    expect(collectNames(bay, 'window-display-')).toEqual([
      'window-display-1945',
      'window-display-1965',
      'window-display-1985',
      'window-display-2005',
      'window-display-2025',
    ]);
    // Tickers/menu boards only for 2005/2025; projection glass only 2025.
    expect(collectNames(bay, 'ticker-')).toEqual(['ticker-2005', 'ticker-2025']);
    expect(collectNames(bay, 'menu-board-')).toEqual(['menu-board-2005', 'menu-board-2025']);
    expect(collectNames(bay, 'projection-glass')).toEqual(['projection-glass']);
    expect(collectNames(bay, 'blade-')).toEqual(['blade-backlit-box', 'blade-enamel-plate']);
    expect(collectNames(bay, 'pushcart-')).toEqual([
      'pushcart-1945',
      'pushcart-1965',
      'pushcart-crates', // instanced produce crates inside each pushcart
    ]);

    // Billboard, kiosk, and newsstand advertising exists for all five eras.
    expect(collectNames(module.group, 'billboard-face-')).toHaveLength(5);
    expect(collectNames(module.group, 'kiosk-face-')).toHaveLength(5);
    expect(collectNames(module.group, 'newsstand-face-')).toHaveLength(5);
    expect(countNamed(module.group, 'billboard-frame')).toBe(2); // rooftop + wall

    // Real gfx-library geometry batches: instanced products and posters.
    const products = findInstanced(module.group, 'window-products');
    expect(products).toHaveLength(3 * 5); // bays × eras
    expect(products.every((mesh) => mesh.count === 16)).toBe(true);
    const posters = findInstanced(module.group, 'poster-quads');
    expect(posters).toHaveLength(5); // one draw call per era
    expect(posters.every((mesh) => mesh.count === 3)).toBe(true);
  });

  it('exposes pickable descriptors with unique ids and scene objects', () => {
    const module = build();
    expect(module.pickables).toHaveLength(3 + 5); // bays + poster/billboards/kiosk/newsstand
    const ids = module.pickables.map((pickable) => pickable.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('storefront:shopfront:bay-0');
    expect(ids).toContain('storefront:billboard-rooftop');
    expect(ids).toContain('storefront:kiosk');
    expect(ids).toContain('storefront:newsstand');
    const reachable = new Set<THREE.Object3D>();
    module.group.traverse((object) => reachable.add(object));
    for (const pickable of module.pickables) {
      expect(pickable.object).toBeInstanceOf(THREE.Object3D);
      expect(pickable.focusDistance).toBeGreaterThan(0);
      expect(reachable.has(pickable.object)).toBe(true);
    }
    // Structurally compatible with navigation's PickableDescriptor shape.
    for (const pickable of module.pickables) {
      const asDescriptor = {
        id: pickable.id,
        object: pickable.object,
        focusDistance: pickable.focusDistance,
        focusHeight: pickable.focusHeight,
      };
      expect(typeof asDescriptor.id).toBe('string');
      expect(asDescriptor.object.isObject3D).toBe(true);
    }
  });

  it('reports era-correct treatments for every bay across all five years', () => {
    const module = build();
    expect(module.bayInfo).toHaveLength(3);
    for (const bay of module.bayInfo) {
      expect([...STOREFRONT_VARIANT_YEARS]).toEqual(Object.keys(bay.treatments).map(Number));
      for (const year of STOREFRONT_VARIANT_YEARS) {
        const treatment = bay.treatments[year];
        expect(treatment.fasciaSign).toBe(ERA_STOREFRONT_VARIANTS[year].fasciaSign);
        expect(treatment.awning).toBe(ERA_STOREFRONT_VARIANTS[year].awning);
        expect(treatment.windowDisplay).toBe(ERA_STOREFRONT_VARIANTS[year].windowDisplay);
        expect(treatment.billboard).toBe(ERA_STOREFRONT_VARIANTS[year].billboard);
        expect(treatment.brand.length).toBeGreaterThan(0);
        expect(treatment.tagline.length).toBeGreaterThan(0);
      }
    }
  });

  it('morphs facade before signage in staged windows without weight collapse', () => {
    const system = createEraMorphSystem();
    const module = build();
    module.register(system.registry);

    // Single-segment transition; sample the mid-swap frame at fraction 0.2:
    // the facade stage window (offset 0) is complete while the signage stage
    // window (offset 1/6) has only just begun.
    system.registry.dispatch({ from: 1945, to: 1965, fraction: 0.2 }, 0.2);
    const snaps = module.pieceSnapshots();
    const facade = snaps.find((snap) => snap.id === 'shopfront-bay-0');
    const signage = snaps.find((snap) => snap.id === 'signage-bay-0');
    expect(facade).toBeTruthy();
    expect(signage).toBeTruthy();
    if (!facade || !signage) return;
    expect(facade.stage).toBe('facade');
    expect(signage.stage).toBe('signage');
    expect(facade.crossfade).toBeCloseTo(1, 5);
    expect(signage.crossfade).toBeLessThan(0.5);
    expect(signage.weights[1945] ?? 0).toBeGreaterThan(0.5);
    expect(signage.weights[1965] ?? 0).toBeLessThan(0.5);
    // Every piece keeps full weight mass through the staged swap (no popping).
    for (const snap of snaps) {
      const sum = Object.values(snap.weights).reduce((total, w) => total + (w ?? 0), 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('runs a full transition with continuous weights, stable textures, and era landings', () => {
    const system = createEraMorphSystem();
    const module = build();
    const swaps: StorefrontAudioEvent[] = [];
    module.onAudioEvent((event) => swaps.push(event));
    module.register(system.registry);

    const mapsBefore = collectMapUuids(module.group);
    const cacheBefore = signageCacheSize();
    expect(mapsBefore.length).toBeGreaterThan(0);

    let minOpacity = 1;
    let maxOpacity = 0;
    let maxWeightError = 0;
    system.driver.transitionTo(1985, 1);
    let guard = 0;
    while (system.core.isTransitioning && guard < 5000) {
      system.driver.advance(0.05);
      guard += 1;
      for (const snap of module.pieceSnapshots()) {
        const sum = Object.values(snap.weights).reduce((total, w) => total + (w ?? 0), 0);
        maxWeightError = Math.max(maxWeightError, Math.abs(sum - 1));
        for (const weight of Object.values(snap.weights)) {
          expect(weight ?? 0).toBeGreaterThanOrEqual(0);
          expect(weight ?? 0).toBeLessThanOrEqual(1);
        }
      }
      for (const material of collectMaterials(module.group)) {
        minOpacity = Math.min(minOpacity, material.opacity);
        maxOpacity = Math.max(maxOpacity, material.opacity);
      }
    }
    expect(guard).toBeGreaterThan(0);
    expect(maxWeightError).toBeLessThan(1e-5);
    expect(minOpacity).toBeGreaterThanOrEqual(0);
    expect(maxOpacity).toBeLessThanOrEqual(1);

    // No texture popping: identical map identities and no texture rebuilds.
    expect(collectMapUuids(module.group)).toEqual(mapsBefore);
    expect(signageCacheSize()).toBe(cacheBefore);

    // Landed on 1985 with full weight; dominant era reports 1985.
    expect(module.dominantEra()).toBe(1985);
    expect(module.eraWeights()[1985]).toBeCloseTo(1, 6);
    for (const snap of module.pieceSnapshots()) {
      expect(snap.weights[1985] ?? 0).toBeCloseTo(1, 6);
      expect(snap.from).toBe(1985); // interior stop: `from` is the stop era
    }

    // Shell tint follows the era frame colors (1985 → anodized metal).
    const expectedTint = frameColorFor(1985);
    const shellTints = collectMaterials(module.group).filter((m) => m.userData.shellTint === true);
    expect(shellTints.length).toBeGreaterThan(0);
    for (const material of shellTints) {
      expect(material.color.r).toBeCloseTo(expectedTint.r, 2);
      expect(material.color.g).toBeCloseTo(expectedTint.g, 2);
      expect(material.color.b).toBeCloseTo(expectedTint.b, 2);
    }

    // SIGN_SWAP audio hooks fired during the staged transition.
    const swapsByTransition = swaps.filter(
      (event) => event.type === STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
    );
    expect(swapsByTransition.length).toBeGreaterThanOrEqual(module.transformables.length);
    for (const event of swaps) {
      expect(STOREFRONT_AUDIO_HOOK_LIST).toContain(event.type);
      expect(typeof event.sourceId).toBe('string');
      expect(STOREFRONT_VARIANT_YEARS).toContain(event.era);
      expect(event.intensity).toBeGreaterThanOrEqual(0);
      expect(event.time).toBeGreaterThanOrEqual(0);
    }
  });

  it('drives neon emissive with flicker and emits documented neon hooks in 1985', () => {
    const system = createEraMorphSystem();
    const module = build();
    const events: StorefrontAudioEvent[] = [];
    module.onAudioEvent((event) => events.push(event));
    module.register(system.registry);

    // At 1945 (initial): inactive-era signage emissive is fully off.
    module.update(0.05);
    const signageMaterials = collectMaterials(module.group).filter(
      (m) => m.userData.source === 'storefront-signage' && typeof m.userData.era === 'number',
    );
    const era1945 = signageMaterials.filter((m) => m.userData.era === 1945);
    const era1985 = signageMaterials.filter((m) => m.userData.era === 1985);
    expect(era1945.length).toBeGreaterThan(0);
    expect(era1985.length).toBeGreaterThan(0);
    expect(era1945.some((m) => m.emissiveIntensity > 0)).toBe(true);
    expect(era1985.every((m) => m.emissiveIntensity === 0)).toBe(true);

    runTo(1985, system);
    const intensities = new Set<number>();
    for (let i = 0; i < 40; i += 1) {
      module.update(0.1); // 4 s of ambience → guaranteed neon blink window
      for (const material of era1985) intensities.add(material.emissiveIntensity);
    }
    // Emissive intensity is actively driven (flicker values vary, stay lit).
    expect(intensities.size).toBeGreaterThan(1);
    expect(Math.min(...intensities)).toBeGreaterThan(0);
    expect(Math.max(...intensities)).toBeGreaterThan(0.5);
    // Inactive-era signage stays dark after updates.
    for (const material of era1945) expect(material.emissiveIntensity).toBe(0);

    const hooks = new Set(events.map((event) => event.type));
    expect(hooks.has(STOREFRONT_AUDIO_HOOKS.NEON_HUM)).toBe(true);
    expect(hooks.has(STOREFRONT_AUDIO_HOOKS.NEON_FLICKER)).toBe(true);
    for (const event of events) {
      expect(STOREFRONT_AUDIO_HOOK_LIST).toContain(event.type);
    }
    // Neon hooks are attributed to the 1985 era.
    for (const event of events.filter((e) => e.type === STOREFRONT_AUDIO_HOOKS.NEON_HUM)) {
      expect(event.era).toBe(1985);
    }
  });

  it('scrolls window tickers and emits LED hooks in 2025', () => {
    const system = createEraMorphSystem();
    const module = build();
    const events: StorefrontAudioEvent[] = [];
    module.onAudioEvent((event) => events.push(event));
    module.register(system.registry);

    const tickers = collectMaterials(module.group).filter(
      (m) => m.userData.ticker === true && m.userData.era === 2025,
    );
    expect(tickers.length).toBeGreaterThan(0);
    expect(tickers.every((m) => m.map !== null && m.map.offset.x === 0)).toBe(true);

    // Tickers idle at 1945 (layer weight zero), then scroll once 2025 is live.
    module.update(0.5);
    expect(tickers.every((m) => m.map !== null && m.map.offset.x === 0)).toBe(true);

    runTo(2025, system);
    expect(module.dominantEra()).toBe(2025);
    expect(module.eraWeights()[2025]).toBeCloseTo(1, 6);
    module.update(0.5);
    expect(tickers.some((m) => m.map !== null && m.map.offset.x !== 0)).toBe(true);

    // 2025 signage is lit by LED emissive.
    const led = collectMaterials(module.group).filter(
      (m) => m.userData.source === 'storefront-signage' && m.userData.era === 2025,
    );
    expect(led.some((m) => m.emissiveIntensity > 0.5)).toBe(true);

    const hooks = new Set(events.map((event) => event.type));
    expect(hooks.has(STOREFRONT_AUDIO_HOOKS.LED_SCROLL)).toBe(true);
    expect(hooks.has(STOREFRONT_AUDIO_HOOKS.LED_TICK)).toBe(true);
    expect(hooks.has(STOREFRONT_AUDIO_HOOKS.SIGN_SWAP)).toBe(true);
    for (const event of events.filter((e) => e.type === STOREFRONT_AUDIO_HOOKS.LED_TICK)) {
      expect(event.era).toBe(2025);
    }
  });

  it('lands back on 1945 with era-perfect restoration after a round trip', () => {
    const system = createEraMorphSystem();
    const module = build();
    module.register(system.registry);
    runTo(2025, system);
    runTo(1945, system);
    expect(module.dominantEra()).toBe(1945);
    for (const snap of module.pieceSnapshots()) {
      expect(snap.weights[1945] ?? 0).toBeCloseTo(1, 6);
    }
    // 1945 hand-painted shell tint restored (dark-stained wood).
    const expectedTint = frameColorFor(1945);
    const shellTints = collectMaterials(module.group).filter((m) => m.userData.shellTint === true);
    for (const material of shellTints) {
      expect(material.color.r).toBeCloseTo(expectedTint.r, 2);
    }
    expect(expectedTint.r).not.toBeCloseTo(frameColorFor(2025).r, 2);
  });

  it('exposes the produced StorefrontsModule namespace export', () => {
    expect(StorefrontsModule.create).toBe(createStorefrontsModule);
    expect(StorefrontsModule.BAY_SLOT_PITCH).toBe(6);
    expect(StorefrontsModule.BAY_CLEAR_WIDTH).toBe(5);
    expect(StorefrontsModule.BAY_BASE_Y).toBe(0.15);
    expect(StorefrontsModule.SIGN_BAND_MIN_Y).toBe(3.2);
    expect(StorefrontsModule.SIGN_BAND_MAX_Y).toBe(4.2);
    expect([...StorefrontsModule.audioHooks]).toEqual([...STOREFRONT_AUDIO_HOOK_LIST]);
    const module = StorefrontsModule.create({ bays: 2 });
    live.push(module);
    expect(module.bays).toHaveLength(2);
    expect(module.transformables.length).toBe(2 * 2 + 5);
    expect(module.audioHooks.length).toBe(STOREFRONT_AUDIO_HOOK_LIST.length);
  });

  it('disposes cleanly', () => {
    const module = createStorefrontsModule({ bays: 2 });
    expect(module.group.children.length).toBeGreaterThan(0);
    module.dispose();
    expect(module.group.children).toHaveLength(0);
    expect(module.transformables).toHaveLength(0);
    expect(module.update(0.1)).toBe(0);
  });
});
