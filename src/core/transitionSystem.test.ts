import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ERA_IDS } from '../eras/types';
import type { EraId } from '../eras/types';
import { AudioBus } from './AudioBus';
import { EraRegistry } from './EraRegistry';
import type { EraContentBuilder } from './EraRegistry';
import { TimelineController } from './TimelineController';
import { computePairWeights } from './TransitionSystem';
import { TransitionSystem } from './TransitionSystem';

const FRAME_SECONDS = 1 / 60;
const RISE_DISTANCE = 6;
const MIN_SCALE = 0.001;

interface HarnessOptions {
  readonly initialEra?: EraId;
  readonly transitionSeconds?: number;
  readonly retargetSmoothingSeconds?: number;
}

interface Harness {
  readonly controller: TimelineController;
  readonly registry: EraRegistry;
  readonly audioBus: AudioBus;
  readonly system: TransitionSystem;
  readonly container: THREE.Scene;
  tick(): void;
  tickUntilSettled(maxFrames?: number): void;
  dispose(): void;
}

function makeEraBuilder(id: EraId): EraContentBuilder {
  return () => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: '#c8c8c8',
      emissive: '#ffffff',
      emissiveIntensity: 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 4), material);
    mesh.name = `${id}-probe`;
    group.add(mesh);
    return { id, group, audio: { ambience: 0.6, sfx: 0.3 } };
  };
}

function setup(options: HarnessOptions = {}): Harness {
  const {
    initialEra = '1945',
    transitionSeconds = 1,
    retargetSmoothingSeconds = 0.12,
  } = options;

  let clockMs = 0;
  const controller = new TimelineController({ initialEra, transitionSeconds });
  const registry = new EraRegistry();
  for (const id of [...ERA_IDS]) {
    registry.register(id, makeEraBuilder(id));
  }
  const audioBus = new AudioBus();
  const container = new THREE.Scene();
  const system = new TransitionSystem({
    timeline: controller,
    registry,
    audioBus,
    container,
    clockMs: () => clockMs,
    retargetSmoothingSeconds,
  });

  const harness: Harness = {
    controller,
    registry,
    audioBus,
    system,
    container,
    tick(): void {
      clockMs += FRAME_SECONDS * 1000;
      controller.update(FRAME_SECONDS);
      audioBus.update(FRAME_SECONDS);
    },
    tickUntilSettled(maxFrames = 400): void {
      for (let i = 0; i < maxFrames && !controller.settled; i += 1) {
        harness.tick();
      }
      if (!controller.settled) {
        throw new Error('test harness: timeline failed to settle');
      }
    },
    dispose(): void {
      system.dispose();
      registry.dispose();
      audioBus.dispose();
    },
  };
  return harness;
}

function probeMaterial(content: { group: THREE.Group }): THREE.MeshStandardMaterial {
  const mesh = content.group.children[0] as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

describe('TransitionSystem', () => {
  it('binds the initial era settled at weight 1 with untouched presentation state', () => {
    const h = setup();

    expect(h.system.weights.get('1945')).toBe(1);
    for (const id of ERA_IDS) {
      if (id !== '1945') {
        expect(h.system.weights.get(id)).toBe(0);
      }
    }

    const content = h.registry.peek('1945')!;
    const material = probeMaterial(content);
    expect(content.group.visible).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.emissiveIntensity).toBeCloseTo(1, 5);
    expect(content.group.scale.x).toBeCloseTo(1, 5);
    expect(content.group.position.y).toBeCloseTo(0, 5);
    expect(h.system.boundIds()).toEqual(['1945']);
  });

  it('interpolates opacity/scale/position over the configured duration', () => {
    const h = setup({ initialEra: '1945', transitionSeconds: 1 });

    h.controller.setEra('2025');

    const samples: Array<{ w2025: number; w1945: number }> = [];
    let midwayChecked = false;
    while (!h.controller.settled) {
      h.tick();
      const w2025 = h.system.weights.get('2025')!;
      const w1945 = h.system.weights.get('1945')!;
      samples.push({ w2025, w1945 });

      if (!midwayChecked && h.controller.transitionState.t > 0.35) {
        midwayChecked = true;
        // Presentation state is recomputed from the published weight.
        const incoming = h.registry.peek('2025')!;
        expect(w2025).toBeGreaterThan(0.05);
        expect(w2025).toBeLessThan(0.95);
        expect(probeMaterial(incoming).opacity).toBe(w2025);
        expect(incoming.group.position.y).toBeCloseTo(-RISE_DISTANCE * (1 - w2025), 5);
        expect(incoming.group.scale.x).toBeCloseTo(Math.max(w2025, MIN_SCALE), 5);
        expect(incoming.group.visible).toBe(true);
      }
    }

    expect(midwayChecked).toBe(true);
    expect(samples.length).toBeGreaterThan(20);

    // Monotonic crossfade, convex pair sum.
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i].w2025).toBeGreaterThanOrEqual(samples[i - 1].w2025);
      expect(samples[i].w1945).toBeLessThanOrEqual(samples[i - 1].w1945);
    }
    for (const s of samples) {
      expect(Math.abs(s.w2025 + s.w1945 - 1)).toBeLessThan(1e-3);
    }

    // Deterministic endpoints restore authored material state exactly.
    expect(h.system.weights.get('2025')).toBe(1);
    const incoming = h.registry.peek('2025')!;
    const material = probeMaterial(incoming);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(incoming.group.visible).toBe(true);
    expect(incoming.group.scale.x).toBeCloseTo(1, 5);
    expect(incoming.group.position.y).toBeCloseTo(0, 5);

    const outgoing = h.registry.peek('1945')!;
    expect(probeMaterial(outgoing).opacity).toBe(0);
    expect(outgoing.group.visible).toBe(false);
    expect(outgoing.group.scale.x).toBeCloseTo(MIN_SCALE, 5);
    expect(outgoing.group.position.y).toBeCloseTo(-RISE_DISTANCE, 5);
  });

  it('retargets cleanly when a slider drag lands mid-transition', () => {
    const h = setup({ initialEra: '1945', transitionSeconds: 1 });

    const previous = new Map<EraId, number>();
    for (const id of ERA_IDS) {
      previous.set(id, h.system.weights.get(id) ?? 0);
    }
    let maxStep = 0;
    const step = (): void => {
      for (const id of ERA_IDS) {
        const w = h.system.weights.get(id) ?? 0;
        expect(Number.isFinite(w)).toBe(true);
        maxStep = Math.max(maxStep, Math.abs(w - (previous.get(id) ?? 0)));
        previous.set(id, w);
      }
      h.tick();
    };

    h.controller.setEra('1985');
    for (let i = 0; i < 25; i += 1) step(); // ~40% into 1985
    expect(h.system.isBound('1985')).toBe(true);

    // Mid-flight slider drag: 1985 -> 1965 while weights are still blended.
    h.controller.setEra('1965');
    for (let i = 0; i < 150 && !h.controller.settled; i += 1) step();
    step(); // capture the settle-snap frame delta too

    expect(maxStep).toBeLessThanOrEqual(0.25); // no teleporting weights on any frame
    expect(h.controller.current).toBe('1965');
    expect(h.system.weights.get('1965')).toBe(1);
    for (const id of ERA_IDS) {
      if (id !== '1965') {
        expect(h.system.weights.get(id)).toBe(0);
        if (h.system.isBound(id)) {
          expect(probeMaterial(h.registry.peek(id)!).opacity).toBe(0);
          expect(h.registry.peek(id)!.group.visible).toBe(false);
        }
      }
    }
  });

  it('transitions bidirectionally back to an earlier era', () => {
    const h = setup();

    h.controller.setEra('1985');
    h.tickUntilSettled();
    expect(h.system.weights.get('1985')).toBe(1);

    h.controller.setEra('1945');
    h.tickUntilSettled();
    expect(h.system.weights.get('1945')).toBe(1);
    expect(h.system.weights.get('1985')).toBe(0);

    const reverted = h.registry.peek('1985')!;
    expect(reverted.group.visible).toBe(false);
    expect(probeMaterial(reverted).opacity).toBe(0);
  });

  it('rebuilds against a runtime-swapped builder without corrupting the live transition', () => {
    const h = setup({ initialEra: '1945', transitionSeconds: 1 });

    let oldDisposals = 0;
    h.registry.register('2005', () => ({
      id: '2005',
      group: new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()),
      ),
      audio: { ambience: 0.2, sfx: 0.1 },
      dispose: () => {
        oldDisposals += 1;
      },
    }));

    h.controller.setEra('2005');
    for (let i = 0; i < 10; i += 1) h.tick();
    const first = h.registry.peek('2005')!;
    expect(first.group.parent).toBe(h.container);

    let newDisposals = 0;
    h.registry.register('2005', () => {
      const group = new THREE.Group();
      group.name = 'swapped-2005';
      group.add(
        new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial()),
      );
      return {
        id: '2005',
        group,
        audio: { ambience: 0.9, sfx: 0.8 },
        dispose: () => {
          newDisposals += 1;
        },
      };
    });

    // The swap rebuilds immediately because 2005 participates in the live blend.
    const swapped = h.registry.peek('2005')!;
    expect(swapped).not.toBe(first);
    expect(oldDisposals).toBe(1);
    expect(first.group.parent).toBeNull();
    expect(swapped.group.parent).toBe(h.container);
    expect(h.audioBus.getDescriptor('2005')).toMatchObject({ ambience: 0.9 });

    h.tickUntilSettled();
    expect(h.system.weights.get('2005')).toBe(1);
    expect(probeMaterial(swapped).opacity).toBe(1);
    expect(newDisposals).toBe(0);
    expect(
      h.container.children.some((child) => child === swapped.group),
    ).toBe(true);
    expect(h.container.children.includes(first.group)).toBe(false);
  });

  it('tracks the controller t-value exactly when smoothing is disabled', () => {
    const h = setup({ retargetSmoothingSeconds: 0 });
    h.controller.setEra('2025');

    for (let i = 0; i < 40 && !h.controller.settled; i += 1) {
      h.tick();
      const expected = computePairWeights(h.controller.transitionState);
      for (const [id, w] of expected) {
        expect(h.system.weights.get(id)).toBeCloseTo(w, 6);
      }
    }
  });

  it('fades per-era audio channels in lockstep with the visual weights', () => {
    const h = setup();
    h.audioBus.update(1);
    expect(h.audioBus.getLevel('1945', 'ambience')).toBeCloseTo(0.6, 5);

    h.controller.setEra('2025');
    for (let i = 0; i < 20; i += 1) h.tick();

    const weight = h.system.weights.get('2025')!;
    expect(weight).toBeGreaterThan(0);
    const level = h.audioBus.getLevel('2025', 'ambience');
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(1);

    h.tickUntilSettled();
    h.audioBus.update(1);
    expect(h.audioBus.getLevel('2025', 'ambience')).toBeCloseTo(0.6, 4);
    expect(h.audioBus.getLevel('1945', 'ambience')).toBeCloseTo(0, 4);
  });

  it('rejects unknown era ids in setEra and detaches cleanly on dispose', () => {
    const h = setup();
    expect(() => h.system.setEra('1995' as EraId)).toThrow(TypeError);

    h.dispose();
    expect(h.system.boundIds()).toEqual([]);
    expect(h.container.children.length).toBe(0);
    expect(h.audioBus.registeredEras).toEqual([]);
    expect(() => h.dispose()).not.toThrow(); // idempotent
  });
});
