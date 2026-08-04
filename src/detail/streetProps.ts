import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '../city/rng';
import type { CityGridLayout } from '../city/types';

export interface StreetPropOptions {
  /** City seed (props reuse the same deterministic RNG family). */
  seed: number;
  /** Street-grid layout from city-generation. */
  grid: CityGridLayout;
  /** Candidate slot spacing along a sidewalk (meters). Default 4. */
  spacing?: number;
}

export interface StreetPropsResult {
  group: THREE.Group;
  /** Number of placed props per type (lamps, trees, benches, signs). */
  counts: { lamp: number; tree: number; bench: number; sign: number };
}

type SingleColorProp = 'lamp' | 'bench' | 'sign';

/** Palette for per-instance prop colors. */
const LAMP_COLORS: readonly number[] = [0x2f3542, 0x3d4250, 0x262a33];
const TREE_TRUNK_COLORS: readonly number[] = [0x5d4037, 0x6d4c41, 0x795548];
const TREE_FOLIAGE_COLORS: readonly number[] = [0x388e3c, 0x43a047, 0x2e7d32, 0x558b2f, 0x66bb6a];
const BENCH_COLORS: readonly number[] = [0x4e342e, 0x5d4037, 0x37474f];
const SIGN_PANEL_COLORS: readonly number[] = [0x1e5a8a, 0x2f6f4f, 0x7a1f1f];

/**
 * Build merged one-draw-call geometries so each prop kind is a single
 * InstancedMesh. All parts share position/normal/uv attributes, which
 * mergeGeometries requires.
 */
function buildLampGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.05, 0.075, 3.0, 8).translate(0, 1.5, 0);
  const arm = new THREE.BoxGeometry(0.05, 0.05, 0.85).translate(0, 2.85, 0.4);
  const head = new THREE.SphereGeometry(0.13, 8, 6).translate(0, 2.9, 0.85);
  const merged = mergeGeometries([pole, arm, head]);
  return merged ?? new THREE.BoxGeometry(0.1, 3, 0.1).translate(0, 1.5, 0);
}

function buildTreeTrunkGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6).translate(0, 0.8, 0);
}

function buildTreeFoliageGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.95, 8, 6).translate(0, 2.5, 0);
}

function buildBenchGeometry(): THREE.BufferGeometry {
  const seat = new THREE.BoxGeometry(1.6, 0.09, 0.5).translate(0, 0.52, 0);
  const back = new THREE.BoxGeometry(1.6, 0.55, 0.09).translate(0, 0.95, -0.22);
  const legA = new THREE.BoxGeometry(0.09, 0.5, 0.09).translate(-0.65, 0.27, 0.2);
  const legB = new THREE.BoxGeometry(0.09, 0.5, 0.09).translate(0.65, 0.27, 0.2);
  const legC = new THREE.BoxGeometry(0.09, 0.5, 0.09).translate(-0.65, 0.27, -0.18);
  const legD = new THREE.BoxGeometry(0.09, 0.5, 0.09).translate(0.65, 0.27, -0.18);
  const merged = mergeGeometries([seat, back, legA, legB, legC, legD]);
  return merged ?? new THREE.BoxGeometry(1.6, 0.5, 0.5).translate(0, 0.5, 0);
}

function buildSignGeometry(): THREE.BufferGeometry {
  const post = new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6).translate(0, 0.85, 0);
  const panel = new THREE.BoxGeometry(0.72, 0.52, 0.07).translate(0, 1.62, 0);
  const merged = mergeGeometries([post, panel]);
  return merged ?? new THREE.BoxGeometry(0.7, 0.5, 0.07).translate(0, 1.6, 0);
}

const SINGLE_COLOR_GEOMETRIES: Record<SingleColorProp, () => THREE.BufferGeometry> = {
  lamp: buildLampGeometry,
  bench: buildBenchGeometry,
  sign: buildSignGeometry,
};

/**
 * Place street props (lamp posts, benches, trees, traffic signs) along every
 * sidewalk strip. Each prop kind is one InstancedMesh (trees split into
 * trunk + foliage meshes), so the whole city's street furniture costs five
 * draw calls.
 *
 * - Props sit in the band 1 m from the road edge of each sidewalk, well
 *   inside the sidewalk and never inside a building (buildings stay inside
 *   their building area by construction).
 * - Placement is deterministic for a given seed and skips the intersection
 *   apron where crosswalks are painted, so props never sit on road markings.
 * - Props are decorative only: they are not added to the walk-controls
 *   collision data, so movement/collision boundaries are untouched.
 */
export function createStreetProps(options: StreetPropOptions): StreetPropsResult {
  const { grid, seed } = options;
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const spacing = Math.max(2, options.spacing ?? 4);
  const endMargin = 2;
  const intersectionMargin = grid.streetWidth / 2 + 1.5;
  // Prop band: 1 m in from the road edge (sidewalk spans streetWidth/2 .. +sidewalkWidth).
  const propOffset = (grid.streetWidth + grid.sidewalkWidth) / 2 - 1.0;

  const singleMatrices: Record<SingleColorProp, THREE.Matrix4[]> = {
    lamp: [],
    bench: [],
    sign: [],
  };
  const treeTrunkMatrices: THREE.Matrix4[] = [];
  const treeFoliageMatrices: THREE.Matrix4[] = [];
  const singleColors: Record<SingleColorProp, THREE.Color[]> = {
    lamp: [],
    bench: [],
    sign: [],
  };
  const trunkColors: THREE.Color[] = [];
  const foliageColors: THREE.Color[] = [];

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const halfLength = grid.stripLength / 2;

  for (const line of grid.roadLines) {
    for (const axis of [0, 1] as const) {
      for (const side of [-1, 1]) {
        // Perpendicular distance from the city axis to the prop band of this
        // sidewalk strip (follows the road line, unlike the naive ±offset).
        const perp = line + propOffset * side;
        for (let s = -halfLength + endMargin; s <= halfLength - endMargin; s += spacing) {
          const along = s + (rng() * 2 - 1) * (spacing * 0.35);

          // Skip the intersection apron (crossing road) so props never sit on
          // the crosswalk or block the corner.
          let blocked = false;
          for (const crossing of grid.roadLines) {
            if (Math.abs(along - crossing) < intersectionMargin) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;

          // Weighted prop mix along a typical street: lamps and trees common,
          // benches and signs rarer, some empty pavement between.
          const roll = rng();
          let type: 'tree' | SingleColorProp | null = null;
          if (roll < 0.24) type = 'tree';
          else if (roll < 0.46) type = 'lamp';
          else if (roll < 0.55) type = 'bench';
          else if (roll < 0.63) type = 'sign';
          if (type === null) continue;

          dummy.position.set(axis === 0 ? along : perp, 0, axis === 0 ? perp : along);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(type === 'tree' ? 0.8 + rng() * 0.8 : 1);
          dummy.updateMatrix();

          if (type === 'tree') {
            treeFoliageMatrices.push(dummy.matrix.clone());
            // Slightly wider base for the trunk so it reads as one tree.
            dummy.scale.multiplyScalar(1.25);
            dummy.updateMatrix();
            treeTrunkMatrices.push(dummy.matrix.clone());
            foliageColors.push(color.setHex(pickColor(rng, TREE_FOLIAGE_COLORS)).clone());
            trunkColors.push(color.setHex(pickColor(rng, TREE_TRUNK_COLORS)).clone());
          } else {
            singleMatrices[type].push(dummy.matrix.clone());
            const palette =
              type === 'lamp' ? LAMP_COLORS : type === 'bench' ? BENCH_COLORS : SIGN_PANEL_COLORS;
            singleColors[type].push(color.setHex(pickColor(rng, palette)).clone());
          }
        }
      }
    }
  }

  const group = new THREE.Group();
  const counts = { lamp: 0, tree: 0, bench: 0, sign: 0 };

  for (const type of ['lamp', 'bench', 'sign'] as const) {
    const list = singleMatrices[type];
    if (list.length === 0) continue;
    const mesh = new THREE.InstancedMesh(SINGLE_COLOR_GEOMETRIES[type](), new THREE.MeshStandardMaterial({ color: 0xffffff }), list.length);
    for (let i = 0; i < list.length; i++) {
      mesh.setMatrixAt(i, list[i]);
      mesh.setColorAt(i, singleColors[type][i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    counts[type] = list.length;
  }

  if (treeFoliageMatrices.length > 0) {
    const foliageMesh = new THREE.InstancedMesh(
      buildTreeFoliageGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      treeFoliageMatrices.length,
    );
    const trunkMesh = new THREE.InstancedMesh(
      buildTreeTrunkGeometry(),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      treeTrunkMatrices.length,
    );
    for (let i = 0; i < treeFoliageMatrices.length; i++) {
      foliageMesh.setMatrixAt(i, treeFoliageMatrices[i]);
      foliageMesh.setColorAt(i, foliageColors[i]);
      trunkMesh.setMatrixAt(i, treeTrunkMatrices[i]);
      trunkMesh.setColorAt(i, trunkColors[i]);
    }
    foliageMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
    if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
    group.add(trunkMesh);
    group.add(foliageMesh);
    counts.tree = treeFoliageMatrices.length;
  }

  return { group, counts };
}

function pickColor(rng: () => number, palette: readonly number[]): number {
  return palette[Math.floor(rng() * palette.length)];
}
