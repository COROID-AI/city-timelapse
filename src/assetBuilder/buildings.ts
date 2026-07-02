/**
 * Procedural building generator.
 *
 * Consumes an {@link EraSpec} and produces a Three.js {@link THREE.Group}
 * representing a single era-appropriate building: facade (textured), roof
 * detailing (parapet / mechanical / green / solar), ground-floor retail with
 * signage + awning, and era-correct air-conditioner units.
 *
 * Facade and emissive textures come from the cached registry in `textures.ts`,
 * so the underlying image data is shared and deterministic per era.
 */
import * as THREE from 'three';
import type { EraSpec } from '../eraRegistry';
import { makeRng, type Rng, buildFacadeMaterial, getSignageTexture } from './textures';

/** Approximate world size of one facade texture tile (one window bay × one floor). */
const FACADE_BAY = 3.4;

/** Signature describing a building lot for deterministic generation. */
export interface BuildingLot {
  width: number;
  depth: number;
  /** Stable seed so the same lot always produces the same building. */
  seed: number;
}

function makeBoxMaterial(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** Add a roof detail block on top of the building. */
function addRoofDetail(
  group: THREE.Group,
  spec: EraSpec,
  width: number,
  depth: number,
  height: number,
  rng: Rng,
): void {
  const building = spec.buildings;
  const roof = building.roofType;
  const roofY = height + 0.15;

  if (roof === 'flat-tar' || roof === 'flat-parapet') {
    // Parapet wall
    if (roof === 'flat-parapet' || rng() < 0.5) {
      const parapetH = 0.5;
      const mat = makeBoxMaterial(shadeHex(building.trimColor, -10), 0.9);
      const front = new THREE.Mesh(new THREE.BoxGeometry(width, parapetH, 0.25), mat);
      front.position.set(0, roofY + parapetH / 2, depth / 2);
      const back = front.clone();
      back.position.z = -depth / 2;
      group.add(front, back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, parapetH, depth), mat);
      left.position.set(-width / 2, roofY + parapetH / 2, 0);
      const right = left.clone();
      right.position.x = width / 2;
      group.add(left, right);
    }
  }

  if (roof === 'flat-mechanical' || building.airConditionerLikelihood > 0.5) {
    // Mechanical penthouse / AC units
    const unitCount = randIntClamped(rng, 1, 3);
    for (let i = 0; i < unitCount; i++) {
      const uW = 1.2 + rng() * 1.5;
      const uD = 1.0 + rng() * 1.2;
      const uH = 0.6 + rng() * 0.8;
      const unit = new THREE.Mesh(
        new THREE.BoxGeometry(uW, uH, uD),
        makeBoxMaterial('#6a6a6a', 0.7, 0.4),
      );
      unit.position.set(
        (rng() - 0.5) * (width - uW - 1),
        roofY + uH / 2,
        (rng() - 0.5) * (depth - uD - 1),
      );
      group.add(unit);
    }
  }

  if (roof === 'green-roof') {
    const green = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.9, 0.2, depth * 0.9),
      makeBoxMaterial('#3a6a3a', 0.9),
    );
    green.position.set(0, roofY + 0.1, 0);
    group.add(green);
  }

  if (roof === 'solar-roof') {
    const panelMat = makeBoxMaterial('#1a2a4a', 0.3, 0.6);
    const rows = Math.max(1, Math.floor(width / 2));
    const cols = Math.max(1, Math.floor(depth / 2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.15) continue;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.0), panelMat);
        panel.position.set(
          -width / 2 + 1 + r * 2,
          roofY + 0.2,
          -depth / 2 + 1 + c * 2,
        );
        panel.rotation.x = -0.2;
        group.add(panel);
      }
    }
  }
}

/** Add ground-floor retail: awning + signage board. */
function addGroundFloorRetail(
  group: THREE.Group,
  spec: EraSpec,
  width: number,
  depth: number,
  rng: Rng,
): void {
  const building = spec.buildings;
  if (rng() > building.groundFloorRetailLikelihood) return;

  // Awning
  if (rng() < building.awningLikelihood) {
    const awnW = Math.min(width * 0.5, 3);
    const awnColor = pickFromRng(rng, spec.signage.palette);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(awnW, 0.1, 1.2),
      makeBoxMaterial(awnColor, 0.8),
    );
    awning.position.set(0, 3.0, depth / 2 + 0.6);
    awning.rotation.x = -0.25;
    group.add(awning);
  }

  // Signage board
  const signTex = getSignageTexture(spec, Math.floor(rng() * spec.signage.adContent.length));
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: '#ffffff',
    emissiveMap: signTex,
    emissiveIntensity: spec.signage.neonLikelihood > 0.4 ? 0.8 : 0.3,
    roughness: 0.5,
  });
  const signW = Math.min(width * 0.7, spec.signage.maxWidth);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, 0.8), signMat);
  sign.position.set(0, 4.2, depth / 2 + 0.02);
  group.add(sign);
}

/**
 * Build a complete era-appropriate building for a given lot.
 *
 * @param spec  The era spec driving all visual choices.
 * @param lot   Lot dimensions and a stable seed.
 */
export function buildBuilding(spec: EraSpec, lot: BuildingLot): THREE.Group {
  const group = new THREE.Group();
  const rng = makeRng(`${spec.eraId}:building:${lot.seed}`);
  const building = spec.buildings;

  const floors = randIntClamped(rng, building.minFloors, building.maxFloors);
  const height = floors * building.floorHeight;
  const { width, depth } = lot;

  // Facade materials — side faces use depth-based repeat, front/back use width.
  const paletteIndex = Math.floor(rng() * building.facadePalette.length);
  const sideMat = buildFacadeMaterial(spec, paletteIndex, depth / FACADE_BAY, floors);
  const fbMat = buildFacadeMaterial(spec, paletteIndex, width / FACADE_BAY, floors);
  const roofMat = makeBoxMaterial(shadeHex(building.facadePalette[paletteIndex], -25), 0.9);
  const bottomMat = makeBoxMaterial('#2a2a2a', 0.9);

  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(bodyGeo, [sideMat, sideMat, roofMat, bottomMat, fbMat, fbMat]);
  body.position.y = height / 2;
  body.name = 'building';
  group.add(body);

  // Cornice band (era-appropriate)
  if (rng() < building.corniceLikelihood) {
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.3, 0.4, depth + 0.3),
      makeBoxMaterial(building.trimColor, 0.7),
    );
    cornice.position.y = height + 0.2;
    group.add(cornice);
  }

  addRoofDetail(group, spec, width, depth, height, rng);
  addGroundFloorRetail(group, spec, width, depth, rng);

  group.userData = { eraId: spec.eraId, floors, height, lot };
  return group;
}

// ---------------------------------------------------------------------------
// Small local helpers (kept here to avoid coupling textures↔buildings further)
// ---------------------------------------------------------------------------

function shadeHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round((percent / 100) * 255);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function randIntClamped(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickFromRng<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}
