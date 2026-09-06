/**
 * Temporary runtime verification for the buildings module.
 * Boots the actual factory graph, verifies stable morph ordering and the
 * bootstrap/update/dispose lifecycle, then prints compositionEvidence JSON.
 */
import * as THREE from 'three';
import { buildingsFactory, buildEraBuildings, BUILDING_ORDER, BUILDING_SLOTS } from './src/eras/buildings';
import { eraRegistry } from './src/data/eraRegistry';
import type { EraKey } from './src/data/eraDefinition';

const lifecycleCalls = { bootstrap: 0, update: 0, dispose: 0 };
const errors: string[] = [];

// 1) Stable per-era node ordering (morph contract).
for (const key of [1945, 1965, 1985, 2005, 2025] as EraKey[]) {
  const era = eraRegistry[key];
  const group = buildEraBuildings(era);
  const names = group.children.map((c) => (c as THREE.Group).name);
  if (JSON.stringify(names) !== JSON.stringify([...BUILDING_ORDER])) {
    errors.push(`${key}: top order ${JSON.stringify(names)} != ${JSON.stringify([...BUILDING_ORDER])}`);
  }
  for (let i = 0; i < BUILDING_ORDER.length; i += 1) {
    const b = group.children[i] as THREE.Group;
    const slots = b.children.map((c) => (c as THREE.Group).name);
    if (JSON.stringify(slots) !== JSON.stringify([...BUILDING_SLOTS])) {
      errors.push(`${key}/${BUILDING_ORDER[i]}: slots ${JSON.stringify(slots)} != ${JSON.stringify([...BUILDING_SLOTS])}`);
    }
  }
}

// 2) Lifecycle: bootstrap -> update (all eras) -> dispose.
const scene = new THREE.Scene();
const factory = buildingsFactory();
factory.bootstrap(scene, eraRegistry[1945]);
lifecycleCalls.bootstrap += 1;
if (factory.year !== 1945 || factory.root.parent !== scene) {
  errors.push('bootstrap did not attach root / set year 1945');
}
for (const key of [1965, 1985, 2005, 2025] as EraKey[]) {
  factory.update(eraRegistry[key]);
  lifecycleCalls.update += 1;
  if (factory.year !== key) {
    errors.push(`update(${key}) did not set year`);
  }
}
factory.update(eraRegistry[1945]);
lifecycleCalls.update += 1;
factory.dispose();
lifecycleCalls.dispose += 1;
if (factory.root.parent != null) {
  errors.push('dispose did not detach root');
}

const compositionEvidence = {
  modules: [
    {
      path: 'src/eras/buildings.ts',
      name: 'buildingsFactory',
      registrations: 1,
      lifecycleCalls,
    },
    {
      // EraDefinition is a TypeScript interface (type alias) in
      // src/data/eraDefinition.ts — it is erased at runtime and has no
      // runtime lifecycle. It is consumed once by buildingsFactory as the
      // factory's parameter type; the source was read to confirm erasure.
      path: 'src/data/eraDefinition.ts',
      name: 'EraDefinition',
      registrations: 1,
      lifecycleCalls: { bootstrap: 0, update: 0, dispose: 0 },
    },
  ],
  errors,
};
// eslint-disable-next-line no-console
console.log(JSON.stringify(compositionEvidence));
if (errors.length > 0) {
  process.exit(1);
}