/**
 * 2025 era — contemporary city block scene.
 *
 * Selecting 2025 transforms the block into an authentically detailed modern
 * street: glass office towers and renovated mixed-use buildings with green
 * roofs, solar panels and rooftop HVAC; contemporary storefronts (coffee
 * roaster, smoothie bar, EV showroom, shared workspace) with backlit fascias
 * and digital menu boards; LED billboards and digital kiosks; modern EVs,
 * hybrids, an EV bus, e-bikes and scooters; pedestrians in 2020s fashion;
 * cycle lanes, EV charging stations, smart streetlights, parklets, trees,
 * benches and rain gardens.
 *
 * The module registers era '2025' into the shared registry as a side effect of
 * being imported, and exports `era2025` (the EraContent) plus
 * `era2025Providers` (the reusable mesh providers handed to the simulation via
 * the main-integration task).
 *
 * All geometry and textures are procedural — the repo stays free of binary
 * assets (see `2025.parts.ts` for the builders).
 */
import * as THREE from 'three';

import type { EraContent } from '../../types';
import { eraRegistry } from '../registry';
import {
  PALETTE,
  buildBench,
  buildBuilding,
  buildCycleLane,
  buildDigitalKiosk,
  buildEvCharger,
  buildLedBillboard,
  buildParklet,
  buildPedestrian,
  buildPedestrianMesh,
  buildRainGarden,
  buildSmartStreetlight,
  buildStorefront,
  buildTree,
  buildVehicle,
  buildVehicleMesh,
  type OutfitVariant,
  type VehicleKind,
} from './2025.parts';

/* ------------------------------------------------------------------ */
/* Scene layout                                                        */
/* ------------------------------------------------------------------ */

/** Half the block footprint (BLOCK.width / 2). */
const HB = 60;

interface Movable {
  mesh: THREE.Object3D;
  /** Movement axis. */
  axis: 'x' | 'z';
  /** Direction sign along the axis. */
  dir: 1 | -1;
  min: number;
  max: number;
  speed: number;
}

interface Walker {
  mesh: THREE.Object3D;
  baseX: number;
  baseZ: number;
  phase: number;
  speed: number;
}

/** Runtime state owned by the era while it is active. */
interface EraState {
  root: THREE.Group;
  movables: Movable[];
  walkers: Walker[];
}

/** Lay out the complete contemporary city block into `group`. */
function layoutScene(group: THREE.Group): Pick<EraState, 'movables' | 'walkers'> {
  const movables: Movable[] = [];
  const walkers: Walker[] = [];

  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.95, metalness: 0.02 });
  const asphaltMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.98, metalness: 0.02 });

  /* -- Ground plane for the block + surrounding street (self-contained). -- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HB * 3, HB * 3), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  group.add(ground);

  // Asphalt street bands around the block (a ring-like look).
  const streetBands: Array<[number, number, number, number]> = [
    // [w, d, x, z]  (horizontal plane)
    [HB * 2 + 24, 24, 0, HB + 12], // north
    [HB * 2 + 24, 24, 0, -HB - 12], // south
    [24, HB * 2 + 24, HB + 12, 0], // east
    [24, HB * 2 + 24, -HB - 12, 0], // west
  ];
  for (const [w, d, x, z] of streetBands) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphaltMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.0, z);
    group.add(s);
  }

  // Crosswalks on the north/south streets.
  const crosswalkMat = new THREE.MeshStandardMaterial({ color: PALETTE.crosswalk, roughness: 0.8 });
  const widthNs = HB * 2 + 16;
  for (const z of [HB + 0.4, -HB - 0.4]) {
    for (let i = 0; i < 5; i++) {
      const x = -widthNs / 2 + 6 + i * (widthNs / 4);
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), crosswalkMat);
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(x, 0.02, z);
      group.add(cw);
    }
  }

  /* -- Cycle lanes along the north and south streets. -- */
  buildCycleLane(group, { width: 2.2, depth: HB * 2 + 10, x: 0, z: HB + 16.5, rotY: 0 });
  buildCycleLane(group, { width: 2.2, depth: HB * 2 + 10, x: 0, z: -HB + 6, rotY: Math.PI });

  /* -- Buildings + storefronts (North row: the hero street). -- */
  const northBuildings: Array<{ x: number; z: number; width: number; depth: number; height: number; style: 'glass' | 'mixed' }> = [
    { x: -38, z: HB - 10, width: 15, depth: 14, height: 26, style: 'glass' },
    { x: -10, z: HB - 6, width: 20, depth: 16, height: 18, style: 'mixed' },
    { x: 26, z: HB - 8, width: 18, depth: 15, height: 18, style: 'mixed' },
    { x: 50, z: HB - 12, width: 13, depth: 13, height: 30, style: 'glass' },
  ];
  for (const b of northBuildings) {
    buildBuilding(group, { x: b.x, z: b.z, width: b.width, depth: b.depth, height: b.height, style: b.style });
  }
  // Storefronts facing the +z street.
  buildStorefront(group, { x: -10, z: HB - 9, kind: 'coffee', rotY: 0, width: 7 });
  buildStorefront(group, { x: 26, z: HB - 9, kind: 'smoothie', rotY: 0, width: 7 });

  /* -- South row. -- */
  const southBuildings: Array<{ x: number; z: number; width: number; depth: number; height: number; style: 'glass' | 'mixed' }> = [
    { x: -46, z: -HB + 8, width: 16, depth: 14, height: 24, style: 'mixed' },
    { x: -6, z: -HB + 6, width: 18, depth: 15, height: 28, style: 'glass' },
    { x: 34, z: -HB + 10, width: 15, depth: 14, height: 18, style: 'mixed' },
    { x: 54, z: -HB + 8, width: 8, depth: 14, height: 20, style: 'glass' },
  ];
  for (const b of southBuildings) {
    buildBuilding(group, { x: b.x, z: b.z, width: b.width, depth: b.depth, height: b.height, style: b.style });
  }
  // Cowork storefront facing the -z street.
  buildStorefront(group, { x: -44, z: -HB + 2.6, kind: 'cowork', rotY: Math.PI, width: 7 });

  /* -- East thin row + EV showroom storefront. -- */
  buildBuilding(group, { x: HB - 8, z: -8, width: 14, depth: 14, height: 22, style: 'mixed' });
  buildStorefront(group, { x: HB - 2.0, z: -6, kind: 'evshowroom', rotY: -Math.PI / 2, width: 7 });

  /* -- LED billboards + digital kiosks. -- */
  buildLedBillboard(group, { x: HB - 8, z: HB - 6, rotY: -Math.PI / 2, y: 0 });
  buildLedBillboard(group, { x: -HB + 8, z: -HB + 6, rotY: Math.PI / 2, y: 0 });
  buildDigitalKiosk(group, { x: -24, z: HB + 4, rotY: 0 });
  buildDigitalKiosk(group, { x: 20, z: -HB - 4, rotY: Math.PI });

  /* -- Vehicles on the streets. -- */
  const vehicles: Array<{ kind: VehicleKind; x: number; z: number; rotY: number; move?: 'x' | 'z' }> = [
    { kind: 'ev', x: 6, z: HB + 20, rotY: 0, move: 'z' },
    { kind: 'hybrid', x: -26, z: HB + 24, rotY: 0 },
    { kind: 'evBus', x: 38, z: HB + 14, rotY: 0, move: 'x' },
    { kind: 'ev', x: 14, z: -HB - 22, rotY: Math.PI },
    { kind: 'hybrid', x: -30, z: -HB - 16, rotY: Math.PI },
    { kind: 'scooter', x: -6, z: HB + 26, rotY: 0.2 },
    { kind: 'ebike', x: 22, z: -HB - 20, rotY: Math.PI },
  ];
  for (const v of vehicles) {
    const g = buildVehicle(group, v.kind, { x: v.x, z: v.z, rotY: v.rotY });
    if (v.move === 'z') {
      movables.push({ mesh: g, axis: 'z', dir: 1, min: HB + 2, max: HB + 30, speed: 1.4 });
    } else if (v.move === 'x') {
      movables.push({ mesh: g, axis: 'x', dir: -1, min: -HB + 2, max: HB - 2, speed: 1.6 });
    }
  }

  /* -- Pedestrians on the sidewalks (2020s fashion). -- */
  const pedestrianData: Array<{ x: number; z: number; rotY: number; variant: OutfitVariant; walk?: boolean }> = [
    { x: -16, z: HB + 3, rotY: Math.PI, variant: 'techwear', walk: true },
    { x: -12, z: HB + 3.4, rotY: Math.PI, variant: 'athleisure', walk: true },
    { x: 4, z: HB + 3, rotY: 0, variant: 'puffer' },
    { x: 18, z: HB + 3.5, rotY: Math.PI, variant: 'business', walk: true },
    { x: 30, z: HB + 3, rotY: 0, variant: 'casual' },
    { x: -30, z: -HB - 3, rotY: 0, variant: 'techwear' },
    { x: -18, z: -HB - 3.4, rotY: 0, variant: 'puffer', walk: true },
    { x: 10, z: -HB - 3, rotY: 0, variant: 'athleisure' },
    { x: 34, z: -HB - 3.4, rotY: 0, variant: 'casual', walk: true },
    { x: -40, z: HB + 3, rotY: Math.PI, variant: 'business' },
  ];
  for (let i = 0; i < pedestrianData.length; i++) {
    const p = pedestrianData[i];
    const mesh = buildPedestrian(group, { x: p.x, z: p.z, rotY: p.rotY, variant: p.variant });
    if (p.walk) {
      walkers.push({ mesh, baseX: p.x, baseZ: p.z, phase: i * 1.7, speed: 0.6 + (i % 3) * 0.15 });
    }
  }

  /* -- EV chargers + parked EV near the curb. -- */
  buildEvCharger(group, { x: 12, z: HB + 9, rotY: 0 });
  buildEvCharger(group, { x: -18, z: -HB - 2, rotY: Math.PI });
  buildVehicle(group, 'ev', { x: 12, z: HB + 6, rotY: Math.PI });

  /* -- Smart streetlights. -- */
  for (const x of [-42, -8, 26, 52]) {
    buildSmartStreetlight(group, { x, z: HB + 2, rotY: 0 });
  }
  for (const x of [-36, 4, 40]) {
    buildSmartStreetlight(group, { x, z: -HB - 2, rotY: Math.PI });
  }

  /* -- Trees, benches, parklets, rain gardens along the sidewalks. -- */
  const treeSpots: Array<[number, number, number]> = [
    [-46, HB + 2, 1],
    [-30, HB + 2, 1.1],
    [10, HB + 2, 1.2],
    [44, HB + 2, 1],
    [-50, -HB - 2, 1],
    [-26, -HB - 2, 1.15],
    [24, -HB - 2, 1],
    [48, -HB - 2, 1.05],
  ];
  for (const [x, z, s] of treeSpots) {
    buildTree(group, { x, z, scale: s });
  }
  buildBench(group, { x: 36, z: HB + 2, rotY: 0.1 });
  buildBench(group, { x: -34, z: -HB - 2, rotY: Math.PI });
  buildParklet(group, { x: -20, z: -HB + 5.2, rotY: 0 });
  buildParklet(group, { x: 2, z: -HB + 5.0, rotY: 0.05 });
  buildRainGarden(group, { x: -38, z: HB + 8.2, rotY: 0, scale: 1.1 });
  buildRainGarden(group, { x: 40, z: HB + 8.0, rotY: Math.PI, scale: 1.0 });

  return { movables, walkers };
}

/* ------------------------------------------------------------------ */
/* Interactive points                                                  */
/* ------------------------------------------------------------------ */

/** World-space interactive points for the 2025 scene (id + label). */
function buildInteractivePoints(): EraContent['interactivePoints'] {
  return [
    {
      id: '2025-cafe',
      position: new THREE.Vector3(-10, 3, HB - 8),
      label: 'Roast Lab — neighborhood coffee roaster',
    },
    {
      id: '2025-ev-showroom',
      position: new THREE.Vector3(HB - 4, 4, -8),
      label: 'Volt EV showroom + chargers',
    },
    {
      id: '2025-green-roof',
      position: new THREE.Vector3(26, 20, HB - 8),
      label: 'Green roof + solar array (mixed-use tower)',
    },
    {
      id: '2025-cycle-lane',
      position: new THREE.Vector3(0, 1, HB + 16),
      label: 'Protected cycle lane + scooters',
    },
    {
      id: '2025-kiosk',
      position: new THREE.Vector3(-24, 2, HB + 4),
      label: 'Digital wayfinding kiosk',
    },
    {
      id: '2025-parklet',
      position: new THREE.Vector3(-20, 1.5, -HB + 5),
      label: 'Street parklet with green roof planters',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Era content                                                         */
/* ------------------------------------------------------------------ */

/**
 * Reusable mesh providers handed to the simulation for era-switch / dashboard
 * use: 2020s outfit variants plus EV / micromobility vehicle meshes.
 */
export const era2025Providers = {
  /** Build the reusable building mesh set (glass + mixed-use, with green roofs). */
  buildings(): THREE.Object3D {
    const g = new THREE.Group();
    buildBuilding(g, { x: 0, z: -14, width: 16, depth: 14, height: 26, style: 'glass' });
    buildBuilding(g, { x: 0, z: 8, width: 16, depth: 16, height: 18, style: 'mixed' });
    return g;
  },
  /** Vehicle mesh factory for 2025: EV / hybrid / e-bike / scooter / EV bus. */
  vehicle(kind: VehicleKind): THREE.Object3D {
    return buildVehicleMesh(kind);
  },
  /** Pedestrian outfit factory: 2020s variants (techwear, athleisure, puffer, ...). */
  outfit(variant: OutfitVariant): THREE.Object3D {
    return buildPedestrianMesh(variant);
  },
};

/**
 * Build the 2025 era content. Uses closures for runtime state so build/update/
 * dispose stay self-contained and simple; interactivePoints are hoisted.
 */
function makeEraContent(): EraContent {
  let state: EraState | undefined;

  return {
    isFastPath: false,

    build(context) {
      const group = new THREE.Group();
      group.name = 'era2025';
      const { movables, walkers } = layoutScene(group);
      state = { root: group, movables, walkers };
      context.scene.add(group);
    },

    update(delta) {
      if (!state) return;
      const { movables, walkers } = state;

      // Animate vehicles along their street lanes (wrapping at lane ends).
      for (const m of movables) {
        const pos = m.axis === 'z' ? m.mesh.position.z : m.mesh.position.x;
        const next = pos + m.dir * m.speed * delta;
        const min = m.min;
        const max = m.max;
        if (next >= max) {
          if (m.axis === 'z') m.mesh.position.z = min;
          else m.mesh.position.x = min;
        } else if (next <= min) {
          if (m.axis === 'z') m.mesh.position.z = max - 1;
          else m.mesh.position.x = max - 1;
        } else if (m.axis === 'z') {
          m.mesh.position.z = next;
        } else {
          m.mesh.position.x = next;
        }
      }

      // Pedestrian footfall sway + subtle bobbing.
      for (const w of walkers) {
        w.phase += delta * w.speed;
        w.mesh.position.x = w.baseX + Math.sin(w.phase) * 0.35;
        w.mesh.position.z = w.baseZ + Math.sin(w.phase * 1.3) * 0.35;
        w.mesh.position.y = Math.abs(Math.cos(w.phase * 2)) * 0.04;
      }
    },

    dispose() {
      if (!state) return;
      const root = state.root;
      // Recursively dispose geometries + materials to release GPU resources.
      const disposeObject = (obj: THREE.Object3D): void => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) {
          m.forEach((mm) => {
            const std = mm as THREE.MeshStandardMaterial;
            if (std.map) std.map.dispose();
            mm.dispose();
          });
        } else if (m) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) std.map.dispose();
          m.dispose();
        }
        for (const child of obj.children) {
          disposeObject(child);
        }
      };
      disposeObject(root);
      root.parent?.remove(root);
      state = undefined;
    },

    interactivePoints: buildInteractivePoints(),
  };
}

export const era2025: EraContent = makeEraContent();

// Side-effect: register the era on import so main-integration only needs to
// import this module to make '2025' available.
eraRegistry.registerEra('2025', era2025);