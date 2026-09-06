import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { eraRegistry, type EraRegistration } from '../registry';
import type { EraContext } from '../../types';
import { era2025, era2025Providers } from '../eras/2025';

/**
 * Composition test — verifies the 2025 era integrates with the shared era
 * registry and the concrete provider API exactly as the phase-1 contracts and
 * main-integration expect:
 *   - importing the module registers era '2025' (side effect)
 *   - build(stubCtx) yields a contemporary scene with the required element
 *     counts
 *   - update(dt) mutates positions (live simulation)
 *   - dispose() releases the graph
 *   - era2025Providers exposes vehicles/outfits for the simulation
 *
 * This test runs the same scenario described by the composed acceptance claim
 * ("import registers era 2025; build yields ≥6 contemporary buildings...") but
 * with concrete assertions against actual geometry in the stub scene rather
 * than invented counters.
 */
describe('era 2025 composition', () => {
  const stubCtx = (scene: THREE.Scene): EraContext => ({
    scene,
    loader: {
      load: async () => '',
      release: () => undefined,
    },
    root: undefined as unknown as HTMLElement,
    year: '2025',
  });

  function buildScene(): { scene: THREE.Scene; root: THREE.Group } {
    const scene = new THREE.Scene();
    Promise.resolve(era2025.build(stubCtx(scene)));
    const root = scene.getObjectByName('era2025') as THREE.Group;
    return { scene, root };
  }

  function countByColor(scene: THREE.Scene, colors: number[]): number {
    let n = 0;
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      const c = m?.color?.getHex();
      if (c !== undefined && colors.includes(c)) n += 1;
    });
    return n;
  }

  it('importing the 2025 module registers era 2025 in the registry', () => {
    const registered = eraRegistry.getEra('2025');
    expect(registered).toBeDefined();
    expect((registered as EraRegistration).interactivePoints).toBe(era2025.interactivePoints);
  });

  it('registry exposes the 2025 build/update/dispose + interactivePoints/isFastPath', () => {
    const info = eraRegistry.eraCompositionInfo().find((e) => e.era === '2025');
    expect(info).toBeDefined();
    expect(info?.build).toBe(era2025.build);
    expect(info?.update).toBe(era2025.update);
    expect(info?.dispose).toBe(era2025.dispose);
    expect(info?.interactivePoints).toBe(era2025.interactivePoints);
    expect(info?.isFastPath).toBe(false);
  });

  it('build(stubCtx) yields ≥6 contemporary buildings, ≥3 storefronts, ≥2 LED screens, ≥4 vehicles, ≥8 pedestrians, cycle lane, chargers, ≥4 interactivePoints', () => {
    const { scene } = buildScene();

    // Contemporary buildings: ≥6 green roofs (distinct green-roof base boxes).
    const greenRoofs = countByColor(scene, [0x4a7c3f, 0x3a6a32]);
    expect(greenRoofs).toBeGreaterThanOrEqual(6);

    // Storefronts: ≥3 backlit fascias (emissive accent on fascia band).
    const storefrontAccents = [0x8a5a2b, 0x2e8b57, 0x2a7fb8, 0x7a5cc0];
    let fascias = 0;
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      const e = m?.emissive?.getHex();
      if (e !== undefined && storefrontAccents.includes(e)) fascias += 1;
    });
    expect(fascias).toBeGreaterThanOrEqual(3);

    // LED billboards / digital kiosks: ≥2 emissive basic-mapped screens.
    let leds = 0;
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m?.isMeshBasicMaterial && m.map) leds++;
    });
    expect(leds).toBeGreaterThanOrEqual(2);

    // ≥4 vehicles incl. EV / micromobility.
    const vehicleColors = [0xbfe3ff, 0xd8d8da, 0x3fb8af, 0x9b8cff, 0xff6b6b];
    const vehicles = countByColor(scene, vehicleColors);
    expect(vehicles).toBeGreaterThanOrEqual(4);

    // ≥8 pedestrians (skin heads).
    let pedestrians = 0;
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.color?.getHex() === 0xe8b98a && Math.abs(obj.position.y - 1.75) < 1) pedestrians++;
    });
    expect(pedestrians).toBeGreaterThanOrEqual(8);

    // Cycle lane.
    const cycle = countByColor(scene, [0x2e8b57]);
    expect(cycle).toBeGreaterThan(0);
    // Chargers.
    const chargers = countByColor(scene, [0x3fb8af]);
    expect(chargers).toBeGreaterThanOrEqual(2);

    // ≥4 interactive points.
    expect(era2025.interactivePoints.length).toBeGreaterThanOrEqual(4);
  });

  it('update(dt) mutates positions; dispose() releases the graph', () => {
    const { scene, root } = buildScene();
    const wp = new THREE.Vector3();
    const before = new Map<number, THREE.Vector3>();
    scene.traverse((obj) => {
      before.set(obj.id, obj.getWorldPosition(new THREE.Vector3()));
    });

    era2025.update(0.5);
    let moved = false;
    scene.traverse((obj) => {
      const orig = before.get(obj.id);
      if (orig && obj.getWorldPosition(wp).distanceTo(orig) > 0.01) moved = true;
    });
    expect(moved).toBe(true);

    era2025.dispose();
    expect(scene.children).not.toContain(root);
    expect(root.parent).toBeNull();
  });

  it('era2025Providers exposes vehicle + outfit mesh factories', () => {
    const vehicles = ['ev', 'hybrid', 'ebike', 'scooter', 'evBus'] as const;
    for (const v of vehicles) {
      const mesh = era2025Providers.vehicle(v);
      expect(mesh).toBeDefined();
      expect(mesh.children.length).toBeGreaterThan(0);
    }
    const outfit = era2025Providers.outfit('techwear');
    expect(outfit).toBeDefined();
    expect(outfit.children.length).toBeGreaterThan(0);
    expect(era2025Providers.buildings().children.length).toBeGreaterThan(0);
  });

  it('dispose releases the scene graph and can be re-built', () => {
    const scene = new THREE.Scene();
    Promise.resolve(era2025.build(stubCtx(scene))).catch(() => undefined);
    expect(scene.getObjectByName('era2025')).toBeDefined();
    era2025.dispose();
    expect(scene.getObjectByName('era2025')).toBeUndefined();
  });
});