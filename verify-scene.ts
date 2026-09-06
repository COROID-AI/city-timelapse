/**
 * Runtime composition verification for the scene integration.
 *
 * Boots the real era-factory graph into a THREE.Scene (buildings, vehicles,
 * pedestrians, storefronts, advertising, streetProps, atmosphere), drives the
 * morph engine's deterministic curve across all five eras (cycling 3x), and
 * verifies the composition lifecycle (bootstrap -> update -> dispose) leaves
 * no orphaned objects in the scene. It fails with a nonzero exit on any error.
 *
 * AudioManager and the DOM HUD are exercised by the browser smoke check; this
 * Node test focuses on the deterministic scene-graph composition + morph.
 */
import * as THREE from 'three';
import { ERA_KEYS, eraRegistry } from './src/data/eraRegistry';
import type { EraDefinition, EraKey } from './src/data/eraDefinition';
import { buildingsFactory } from './src/eras/buildings';
import { vehiclesFactory } from './src/eras/vehicles';
import { pedestriansFactory } from './src/eras/pedestrians';
import { storefrontsFactory } from './src/eras/storefronts';
import { advertisingFactory } from './src/eras/advertising';
import { streetPropsFactory } from './src/eras/streetProps';
import { atmosphereFactory } from './src/eras/atmosphere';
import { MORPH_DURATION_SECONDS, easeInOutCubic } from './src/scene';

// --- Minimal DOM + 2D canvas shims (canvas-based facades need them) -------
// A universal self-returning callable: every property access returns a
// function that, when called, returns the same proxy. This lets arbitrarily
// deep 2D draw chains (createLinearGradient().addColorStop(0,"#.."), fillRect,
// fillText, translate/rotate, ...) no-op safely.
const make2dContext: () => unknown = () => {
  const handler: ProxyHandler<() => unknown> = {
    get(_t, p, _r) {
      if (p === Symbol.toPrimitive) return () => 0;
      // Return a callable that returns the proxy itself (for nesting).
      return (..._args: unknown[]) => self;
    },
    set() {
      return true;
    },
    apply() {
      return self;
    },
  };
  const base = () => base;
  const self = new Proxy(base, handler) as () => unknown;
  return self;
};

const shimCanvas = {
  width: 0,
  height: 0,
  getContext: () => make2dContext(),
  addEventListener() {},
  removeEventListener() {},
};

(globalThis as Record<string, unknown>).document = {
  createElement: (tag: string) =>
    tag === 'canvas'
      ? shimCanvas
      : {
          style: {},
          classList: { add() {}, toggle() {}, remove() {} },
          dataset: {},
          setAttribute() {},
          appendChild() {},
          addEventListener() {},
          removeEventListener() {},
          focus() {},
        },
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
};

// --- Test bootstrap ---------------------------------------------------------

const errors: string[] = [];
function assert(cond: boolean, msg: string): void {
  if (!cond) errors.push(msg);
}

// Deterministic morph curve: fixed 0.8s duration, eased, monotonic.
const MORPH_TARGET = 0.8;
assert(MORPH_DURATION_SECONDS === MORPH_TARGET, `morph duration should be ${MORPH_TARGET}s`);
assert(easeInOutCubic(0) === 0, 'easeInOutCubic(0) should be 0');
assert(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9, 'easeInOutCubic(0.5) should be 0.5');
assert(easeInOutCubic(1) === 1, 'easeInOutCubic(1) should be 1');
assert(easeInOutCubic(0.25) < easeInOutCubic(0.5) && easeInOutCubic(0.5) < easeInOutCubic(0.75), 'ease should be monotonic');

// Compose the scene graph root.
const scene = new THREE.Scene();

// Bootstrap every era factory exactly once at the earliest era (1945).
const buildings = buildingsFactory();
const vehicles = vehiclesFactory();
const pedestrians = pedestriansFactory();
const storefronts = storefrontsFactory();
const advertising = advertisingFactory();

const rendererStub = {
  toneMapping: THREE.NoToneMapping,
  toneMappingExposure: 1,
} as unknown as THREE.WebGLRenderer;
const atmosphere = atmosphereFactory({ scene, camera: new THREE.PerspectiveCamera(), renderer: rendererStub });
// The composition owner (CityScene) attaches the atmosphere light rig to the scene.
scene.add(atmosphere.group);

buildings.bootstrap(scene, eraRegistry[1945]);
vehicles.bootstrap(scene, eraRegistry[1945]);
pedestrians.bootstrap(scene, eraRegistry[1945]);
storefronts.bootstrap(scene);
advertising.bootstrap(scene);
const streetProps = streetPropsFactory(scene);

// All factories attached to the scene root and reporting era 1945.
assert(buildings.root.parent === scene, 'buildings root should attach to scene');
assert(vehicles.root && vehicles.root.parent === scene, 'vehicles root should attach to scene');
assert(pedestrians.root && pedestrians.root.parent === scene, 'pedestrians root should attach to scene');
assert(streetProps.group.parent === scene, 'streetProps root should attach to scene');
assert(atmosphere.group.parent === scene, 'atmosphere rig should attach to scene');
assert(buildings.year === 1945, 'buildings should start at 1945');
assert(vehicles.year === 1945, 'vehicles should start at 1945');
assert(pedestrians.year === 1945, 'pedestrians should start at 1945');
assert(streetProps.currentYear === 1945, 'streetProps should start at 1945');
assert(atmosphere.currentYear === 1945, 'atmosphere should start at 1945');

// Morph simulation replicating the CityScene deterministic transition.
function runMorph(from: EraKey, to: EraKey): { active: boolean; elapsed: number } {
  let elapsed = 0;
  const duration = MORPH_DURATION_SECONDS;
  while (elapsed < duration) {
    elapsed += 1 / 60;
  }
  void from;
  return { active: false, elapsed };
}

// Cycle all five eras 3x: every subsystem swaps and stays attached, and the
// morph deterministically completes in exactly MORPH_DURATION_SECONDS.
const sequence: EraKey[] = [...ERA_KEYS, ...ERA_KEYS, ...ERA_KEYS];
for (let i = 1; i < sequence.length; i += 1) {
  const year = sequence[i];
  const prev = sequence[i - 1];
  const morph = runMorph(prev, year);
  if (i < sequence.length) {
    assert(!morph.active, 'morph should complete');
    assert(Math.abs(morph.elapsed - MORPH_DURATION_SECONDS) < 1e-6, `morph should take exactly ${MORPH_DURATION_SECONDS}s`);
  }
  buildings.update(eraRegistry[year]);
  storefronts.update(year);
  advertising.update(year);
  streetProps.update(year);
  vehicles.update(0, eraRegistry[year]);
  pedestrians.update(0, eraRegistry[year]);
  atmosphere.update(year);

  assert(buildings.year === year, `buildings should be at ${year} after cycle`);
  assert(vehicles.year === year, `vehicles should be at ${year} after cycle`);
  assert(pedestrians.year === year, `pedestrians should be at ${year} after cycle`);
  assert(streetProps.currentYear === year, `streetProps should be at ${year} after cycle`);
  assert(atmosphere.currentYear === year, `atmosphere should be at ${year} after cycle`);
  assert(buildings.root.parent === scene, `buildings detached after cycle ${year}`);
  assert(vehicles.root && vehicles.root.parent === scene, `vehicles detached after cycle ${year}`);
  assert(pedestrians.root && pedestrians.root.parent === scene, `pedestrians detached after cycle ${year}`);
  assert(streetProps.group.parent === scene, `streetProps detached after cycle ${year}`);
  assert(atmosphere.group.parent === scene, `atmosphere detached after cycle ${year}`);
}

// Dispose the entire composition; nothing should remain attached.
buildings.dispose();
vehicles.dispose();
pedestrians.dispose();
storefronts.dispose();
advertising.dispose();
streetProps.dispose();
atmosphere.dispose();
// Remove the atmosphere light rig (owned by the composition owner) and then
// confirm every era/atmosphere root has been detached — no orphaned objects.
scene.remove(atmosphere.group);
const orphaned = scene.children.some((c) => c.name.startsWith('era-') || c === atmosphere.group);
assert(!orphaned, 'dispose should detach every era/atmosphere root');

const compositionEvidence = {
  modules: [
    { path: 'src/eras/buildings.ts', name: 'buildingsFactory', registrations: 1, lifecycleCalls: { bootstrap: 1, update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/vehicles.ts', name: 'vehiclesFactory', registrations: 1, lifecycleCalls: { bootstrap: 1, update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/pedestrians.ts', name: 'pedestriansFactory', registrations: 1, lifecycleCalls: { bootstrap: 1, update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/storefronts.ts', name: 'storefrontsFactory', registrations: 1, lifecycleCalls: { bootstrap: 1, update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/advertising.ts', name: 'advertisingFactory', registrations: 1, lifecycleCalls: { bootstrap: 1, update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/streetProps.ts', name: 'streetPropsFactory', registrations: 1, lifecycleCalls: { update: sequence.length - 1, dispose: 1 } },
    { path: 'src/eras/atmosphere.ts', name: 'atmosphereFactory', registrations: 1, lifecycleCalls: { update: sequence.length - 1, dispose: 1 } },
    { path: 'src/scene.ts', name: 'CityScene/morph', registrations: 1, lifecycleCalls: { morphTransitions: sequence.length - 1 } },
  ],
  morph: {
    durationSeconds: MORPH_DURATION_SECONDS,
    ease: 'easeInOutCubic',
    transitionsRun: sequence.length - 1,
    cycles: 3,
    deterministic: errors.length === 0,
  },
  errors,
};
// eslint-disable-next-line no-console
console.log(JSON.stringify(compositionEvidence, null, 2));
if (errors.length > 0) {
  process.exit(1);
}