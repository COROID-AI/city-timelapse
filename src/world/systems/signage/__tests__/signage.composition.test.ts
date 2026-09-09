/**
 * Composition test for the SignageSystem.
 *
 * Instantiates a full city-block layout + SignageSystem, attaches it to a
 * THREE scene, drives `update(channel)` through a complete 1945 → 2025
 * transition, and asserts:
 *
 * - sign sets crossfade on the layout's frontage planes (visibility and
 *   material opacity follow the channel),
 * - emissive (neon/media) boards are bloom-tagged,
 * - `dispose()` detaches from the scene and releases resources cleanly.
 */

import { Scene } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { SIGNAGE_ERAS } from '../signageEraData';
import { createSignageSystem, type SignageContext } from '../signageSystem';
import type { TimelineChannel } from '../../../../era/types';

let stubSpy: ReturnType<typeof vi.spyOn> | undefined;

const STUB_2D = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'center',
  textBaseline: 'middle',
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  fillText: () => {},
  strokeText: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
} as unknown as CanvasRenderingContext2D;

beforeAll(() => {
  stubSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function getContext(this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') return STUB_2D;
      return null;
    });
});

afterAll(() => {
  stubSpy?.mockRestore();
});

/** Build the standard composition scenario (fresh per test). */
function setup() {
  const layout = createCityBlockLayout('compose-signage');
  const system = createSignageSystem(layout);
  const scene = new Scene();
  const context: SignageContext = { scene };
  return { layout, system, scene, context };
}

describe('signage system composition', () => {
  it('attaches the group to the scene and shows the default era', () => {
    const { system, scene, context } = setup();
    system.attach(context);
    expect(scene.children).toContain(system.group);
    expect(system.isAttached()).toBe(true);

    for (const set of system.eraSets) {
      expect(set.group.visible).toBe(set.era === '1945');
    }
  });

  it('crossfades sign sets across the full 1945 → 2025 timeline', () => {
    const { system, context } = setup();
    system.attach(context);

    // Full transition: 1945 -> 1965 -> 1985 -> 2005 -> 2025.
    for (let step = 1; step < SIGNAGE_ERAS.length; step += 1) {
      const from = SIGNAGE_ERAS[step - 1];
      const to = SIGNAGE_ERAS[step];

      // mid-transition: both sets visible, opacity in (0,1).
      const midChannel: TimelineChannel = { fromEra: from, toEra: to, t: 0.5 };
      system.update(midChannel, 0.016);
      const midFrom = system.eraSets.find((s) => s.era === from)!;
      const midTo = system.eraSets.find((s) => s.era === to)!;
      expect(midFrom.group.visible).toBe(true);
      expect(midTo.group.visible).toBe(true);
      expect(groupOpacity(midFrom.group)).toBeGreaterThan(0);
      expect(groupOpacity(midFrom.group)).toBeLessThan(1);

      // settle at t=1: only the target era visible and fully opaque.
      const endChannel: TimelineChannel = { fromEra: from, toEra: to, t: 1 };
      system.update(endChannel, 0.016);
      for (const set of system.eraSets) {
        expect(set.group.visible).toBe(set.era === to);
      }
    }
  });

  it('anchors every spawned sign to a frontage plane of the layout', () => {
    const { system } = setup();
    for (const set of system.eraSets) {
      for (const sign of set.signs) {
        // Every sign group exposes its anchor position under userData.
        const face = findFaceMesh(sign.group);
        expect(face).toBeDefined();
        const anchor = face?.userData.frontagePlane as { x: number; z: number };
        expect(anchor).toBeDefined();
        // The sign group sits at the anchor plane position (raised band aside),
        // within the plane width (which is ~3-8 m, plus the blade offset).
        expect(Math.abs(sign.group.position.x - anchor.x)).toBeLessThan(2);
        expect(Math.abs(sign.group.position.z - anchor.z)).toBeLessThan(2);
      }
    }
  });

  it('emissive neon boards carry the bloom flag and crossfade still works', () => {
    const { system, context } = setup();
    system.attach(context);

    const neonSet = system.eraSets.find((s) => s.era === '1965')!;
    const anyEmissive = countBloomMats(neonSet.group);
    expect(anyEmissive).toBeGreaterThan(0);

    system.update({ fromEra: '1965', toEra: '1985', t: 0.5 }, 0.016);
    // Both sets remain visible during the crossfade.
    expect(neonSet.group.visible).toBe(true);
  });

  it('dispose detaches from the scene and is idempotent', () => {
    const { system, scene, context } = setup();
    system.attach(context);
    expect(scene.children).toContain(system.group);

    system.dispose();
    expect(scene.children).not.toContain(system.group);
    expect(system.isAttached()).toBe(false);

    system.dispose(); // second call is safe
    expect(system.isAttached()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Average material opacity over a group (0 when none). */
function groupOpacity(group: import('three').Group): number {
  let sum = 0;
  let count = 0;
  group.traverse((obj) => {
    const mesh = obj as { material?: unknown };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as { opacity?: number };
      if (typeof mat.opacity === 'number') {
        sum += mat.opacity;
        count += 1;
      }
    }
  });
  return count === 0 ? 0 : sum / count;
}

/** Find the first mesh with userData.frontagePlane (the face mesh). */
function findFaceMesh(group: import('three').Group): import('three').Object3D | undefined {
  let found: import('three').Object3D | undefined;
  group.traverse((obj) => {
    if (!found && obj.userData && (obj.userData as Record<string, unknown>).frontagePlane) {
      found = obj;
    }
  });
  return found;
}

/** Count of emissive (bloom-tagged) materials in a group. */
function countBloomMats(group: import('three').Group): number {
  let n = 0;
  group.traverse((obj) => {
    const mesh = obj as { material?: unknown };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as { userData?: Record<string, unknown> };
      if (mat.userData && (mat.userData as { bloom?: boolean }).bloom === true) n += 1;
    }
  });
  return n;
}