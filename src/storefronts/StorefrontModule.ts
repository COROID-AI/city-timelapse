import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
} from 'three';
import type { ApplyEraFn, EraKey } from '../eras/eraConfig.js';
import { lerp, lerpHex } from '../eras/eraConfig.js';
import {
  DEFAULT_STOREFRONT_SLOTS,
  type StorefrontSlot,
} from './slotContract.js';
import { pickStorefrontForSlot } from './eraStorefronts.js';
import { paintStorefrontSign, type PaintedSign } from './signTextures.js';

/**
 * Ground-floor storefront module.
 *
 * Fills the reserved ground-floor storefront slots (produced by BuildingGenerator
 * via the shared `StorefrontSlot` contract) with era-appropriate shops and
 * exterior signs. Each storefront renders a shopfront frame (mullions, lintel,
 * sill), glass, a door, an awning (where the era calls for one), an interior
 * glow light, and a canvas-generated sign whose typography and glow match the
 * era (painted → neon → backlit → LED → holographic).
 *
 * The module registers a single `applyEra` domain with TransitionManager. On
 * era change, every storefront cross-fades its frame/glass/door/awning colors
 * and interior lighting via lerp, and swaps its sign texture at the transition
 * midpoint with an opacity dip so the swap is invisible. Neon / LED /
 * holographic signs use emissive materials that clear the bloom threshold, so
 * the existing post-processing pipeline makes them glow — no new heavy assets.
 *
 * Each storefront's shop identity and sign style are derived from
 * `DEFAULT_ERA_CONFIG[era].storefronts` via the era storefront catalog, so era
 * identity is never hardcoded here.
 */

// ---------------------------------------------------------------------------
// Sign-texture cache (shared across all storefronts)
// ---------------------------------------------------------------------------

/** Module-level cache so identical (slotIndex, era) pairs share one texture. */
const signTextureCache = new Map<string, PaintedSign>();

/** Lazily generate (or fetch cached) sign texture for a slot in a given era. */
function getSignTexture(slotIndex: number, era: EraKey): PaintedSign {
  const key = `${slotIndex}:${era}`;
  let sign = signTextureCache.get(key);
  if (!sign) {
    const def = pickStorefrontForSlot(era, slotIndex);
    sign = paintStorefrontSign(def.name, def.signStyle);
    signTextureCache.set(key, sign);
  }
  return sign;
}

// ---------------------------------------------------------------------------
// Per-storefront state
// ---------------------------------------------------------------------------

/** All mutable materials, meshes, and lights owned by one storefront. */
interface StorefrontInstance {
  /** Slot index — determines which era shop this storefront shows. */
  slotIndex: number;
  /** Frame trim material (lintel, sill, mullions). */
  frameMat: MeshStandardMaterial;
  /** Door material. */
  doorMat: MeshStandardMaterial;
  /** Glass material (also carries interior-glow emissive). */
  glassMat: MeshStandardMaterial;
  /** Awning mesh (toggled visible / faded per era). */
  awningMesh: Mesh;
  /** Awning material. */
  awningMat: MeshStandardMaterial;
  /** Sign plane material (texture swapped per era). */
  signMat: MeshStandardMaterial;
  /** Interior glow point light. */
  interiorLight: PointLight;
  /** Which era's sign texture is currently bound to the sign material. */
  shownSignEra: EraKey | null;
  /** Cached emissive intensity per era so the sign clears bloom when needed. */
  emissiveByEra: Map<EraKey, number>;
}

// ---------------------------------------------------------------------------
// Storefront geometry builder
// ---------------------------------------------------------------------------

/**
 * Build a single storefront inside a positioned/rotated group. All meshes use
 * local coordinates where +Z faces the street and y = 0 is the vertical center
 * of the opening.
 */
function buildStorefront(slot: StorefrontSlot, slotIndex: number): {
  group: Group;
  instance: StorefrontInstance;
} {
  const group = new Group();
  group.name = `storefront-${slot.id}`;
  const [x, y, z] = slot.position;
  group.position.set(x, y, z);
  group.rotation.y = slot.rotationY;

  const W = slot.width;
  const H = slot.height;
  const frameThick = 0.35;

  // ---- Frame materials ----------------------------------------------------
  const frameMat = new MeshStandardMaterial({
    color: 0x6b5d4a,
    roughness: 0.85,
    metalness: 0.1,
  });
  const doorMat = new MeshStandardMaterial({
    color: 0x7a5c3a,
    roughness: 0.75,
    metalness: 0.1,
  });
  const glassMat = new MeshStandardMaterial({
    color: 0x9fb0bf,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.05,
    emissive: 0xf5d68a,
    emissiveIntensity: 0.3,
    side: DoubleSide,
  });
  const awningMat = new MeshStandardMaterial({
    color: 0xa8482f,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
    side: DoubleSide,
  });

  // ---- Glass pane ---------------------------------------------------------
  const glassGeo = new PlaneGeometry(W * 0.9, H * 0.86);
  const glassMesh = new Mesh(glassGeo, glassMat);
  glassMesh.name = `${slot.id}-glass`;
  group.add(glassMesh);

  // ---- Frame trim (lintel, sill, two mullions) ----------------------------
  const lintelGeo = new BoxGeometry(W, frameThick, 0.5);
  const lintel = new Mesh(lintelGeo, frameMat);
  lintel.position.set(0, H / 2 - frameThick / 2, 0);
  group.add(lintel);

  const sillGeo = new BoxGeometry(W, frameThick, 0.5);
  const sill = new Mesh(sillGeo, frameMat);
  sill.position.set(0, -H / 2 + frameThick / 2, 0);
  group.add(sill);

  const mullionW = 0.3;
  const leftMullion = new Mesh(new BoxGeometry(mullionW, H * 0.86, 0.4), frameMat);
  leftMullion.position.set(-W * 0.45 + mullionW / 2, 0, 0);
  group.add(leftMullion);

  const rightMullion = new Mesh(new BoxGeometry(mullionW, H * 0.86, 0.4), frameMat);
  rightMullion.position.set(W * 0.45 - mullionW / 2, 0, 0);
  group.add(rightMullion);

  // Central vertical mullion dividing the glass into two panes.
  const centerMullion = new Mesh(new BoxGeometry(0.18, H * 0.82, 0.3), frameMat);
  centerMullion.position.set(0, 0, 0.02);
  group.add(centerMullion);

  // ---- Door ---------------------------------------------------------------
  const doorW = W * 0.28;
  const doorH = H * 0.66;
  const door = new Mesh(new BoxGeometry(doorW, doorH, 0.18), doorMat);
  door.position.set(0, -H * 0.1, 0.15);
  group.add(door);

  // ---- Awning (toggled per era) -------------------------------------------
  const awningGeo = new BoxGeometry(W * 1.12, 0.35, 1.4);
  const awningMesh = new Mesh(awningGeo, awningMat);
  awningMesh.name = `${slot.id}-awning`;
  awningMesh.position.set(0, H / 2 + 0.35, 0.55);
  awningMesh.rotation.x = -0.18; // tilt forward toward the street
  group.add(awningMesh);

  // ---- Sign ---------------------------------------------------------------
  const signGeo = new PlaneGeometry(W * 0.88, 1.3);
  const signMat = new MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    side: DoubleSide,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.4,
    metalness: 0.0,
  });
  const signMesh = new Mesh(signGeo, signMat);
  signMesh.name = `${slot.id}-sign`;
  signMesh.position.set(0, H / 2 + 1.35, 0.15);
  group.add(signMesh);

  // ---- Interior glow light ------------------------------------------------
  const interiorLight = new PointLight(0xf5d68a, 6, 10, 1.5);
  interiorLight.position.set(0, 0, -1.2);
  group.add(interiorLight);

  // Enable shadows for the awning and door.
  awningMesh.castShadow = true;
  door.castShadow = true;
  lintel.castShadow = true;

  // ---- Precompute emissive intensities for all eras -----------------------
  const emissiveByEra = new Map<EraKey, number>();
  for (const era of ['1945', '1965', '1985', '2005', '2025', '2055'] as EraKey[]) {
    const sign = getSignTexture(slotIndex, era);
    emissiveByEra.set(era, sign.emissiveIntensity);
  }

  const instance: StorefrontInstance = {
    slotIndex,
    frameMat,
    doorMat,
    glassMat,
    awningMesh,
    awningMat,
    signMat,
    interiorLight,
    shownSignEra: null,
    emissiveByEra,
  };

  return { group, instance };
}

// ---------------------------------------------------------------------------
// Per-storefront era application (cross-fade)
// ---------------------------------------------------------------------------

/**
 * Apply an era (or cross-fade between two eras) to a single storefront. Called
 * every frame by the module-level `applyEra` during a transition, and once with
 * `t = 1` on initial registration.
 */
function applyEraToStorefront(
  sf: StorefrontInstance,
  toKey: EraKey,
  t: number,
  fromKey: EraKey,
): void {
  const fromDef = pickStorefrontForSlot(fromKey, sf.slotIndex);
  const toDef = pickStorefrontForSlot(toKey, sf.slotIndex);
  const fromF = fromDef.frame;
  const toF = toDef.frame;

  // ---- Frame, door, glass colors (continuous lerp) ------------------------
  sf.frameMat.color.set(lerpHex(fromF.frame, toF.frame, t));
  sf.doorMat.color.set(lerpHex(fromF.door, toF.door, t));
  sf.glassMat.color.set(lerpHex(fromF.glass, toF.glass, t));

  // Interior glow shows through the glass as a warm emissive tint.
  sf.glassMat.emissive.set(lerpHex(fromF.interiorGlow, toF.interiorGlow, t));
  sf.glassMat.emissiveIntensity = lerp(fromF.interiorIntensity, toF.interiorIntensity, t) * 0.35;

  // ---- Interior point light (continuous lerp) -----------------------------
  sf.interiorLight.color.set(lerpHex(fromF.interiorGlow, toF.interiorGlow, t));
  sf.interiorLight.intensity = lerp(fromF.interiorIntensity, toF.interiorIntensity, t) * 7;

  // ---- Awning (fade in/out depending on whether each era has one) --------
  const fromHas = fromF.awning !== null;
  const toHas = toF.awning !== null;
  if (fromHas || toHas) {
    const fromAwning = fromF.awning ?? toF.awning!;
    const toAwning = toF.awning ?? fromF.awning!;
    sf.awningMat.color.set(lerpHex(fromAwning, toAwning, t));
    sf.awningMat.opacity = lerp(fromHas ? 1 : 0, toHas ? 1 : 0, t);
    sf.awningMesh.visible = true;
  } else {
    sf.awningMesh.visible = false;
  }

  // ---- Sign texture swap + opacity dip at midpoint ------------------------
  // Show the source-era sign for the first half, then the destination-era sign
  // for the second half, with an opacity V-dip so the swap is invisible.
  const signEra: EraKey = t < 0.5 ? fromKey : toKey;
  if (sf.shownSignEra !== signEra) {
    const sign = getSignTexture(sf.slotIndex, signEra);
    sf.signMat.map = sign.texture;
    sf.signMat.emissiveMap = sign.texture;
    sf.signMat.emissiveIntensity = sf.emissiveByEra.get(signEra) ?? 0;
    sf.signMat.needsUpdate = true;
    sf.shownSignEra = signEra;
  }
  sf.signMat.opacity = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
}

// ---------------------------------------------------------------------------
// Public module factory
// ---------------------------------------------------------------------------

/** Public interface for the storefront module. */
export interface StorefrontModule {
  /** Root group containing every storefront — add this to the scene. */
  group: Group;
  /**
   * Era-application callback. Register this with
   * `TransitionManager.registerDomain('storefronts', module.applyEra)`.
   */
  applyEra: ApplyEraFn;
  /** Release GPU resources owned by the module. */
  dispose: () => void;
}

/**
 * Create the storefront module, filling every reserved ground-floor slot with
 * era-appropriate shops and signs.
 *
 * @param slots  reserved ground-floor openings from BuildingGenerator. Defaults
 *               to `DEFAULT_STOREFRONT_SLOTS` when omitted.
 */
export function createStorefrontModule(
  slots: StorefrontSlot[] = DEFAULT_STOREFRONT_SLOTS,
): StorefrontModule {
  const group = new Group();
  group.name = 'storefronts';

  const instances: StorefrontInstance[] = [];
  const ownedMaterials: MeshStandardMaterial[] = [];

  slots.forEach((slot, slotIndex) => {
    const { group: slotGroup, instance } = buildStorefront(slot, slotIndex);
    group.add(slotGroup);
    instances.push(instance);

    // Track disposables.
    ownedMaterials.push(
      instance.frameMat,
      instance.doorMat,
      instance.glassMat,
      instance.awningMat,
      instance.signMat,
    );
  });

  // ---- applyEra: iterate every storefront every frame ---------------------
  const applyEra: ApplyEraFn = (toKey, t, fromKey) => {
    for (const sf of instances) {
      applyEraToStorefront(sf, toKey, t, fromKey);
    }
  };

  // ---- dispose: free GPU memory -------------------------------------------
  function dispose(): void {
   // Traverse the group and dispose every geometry we own.
   group.traverse((obj) => {
     if (obj instanceof Mesh) {
       obj.geometry?.dispose();
     }
   });
    for (const mat of ownedMaterials) {
      mat.map?.dispose();
      mat.emissiveMap?.dispose();
      mat.dispose();
    }
    // Clear the shared texture cache too.
    for (const sign of signTextureCache.values()) {
      sign.texture.dispose();
    }
    signTextureCache.clear();
  }

  return { group, applyEra, dispose };
}
