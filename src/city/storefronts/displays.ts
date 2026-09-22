/**
 * Era-correct shopfront geometry builders.
 *
 * Turns the declarative variants in `variants.ts` and the procedural textures
 * from `signage.ts` into Three.js scene objects: shopfront shells, scalloped
 * fabric awnings, window displays stocked with era products, fascia/transom/
 * blade signage, scrolling tickers, menu boards, poster walls, rooftop and
 * wall billboards, pavement kiosks, newsstand racks, and 1945 pushcarts.
 *
 * Everything here is built through the shared `ProceduralGfxLibrary`
 * (era materials, canvas textures, and instancing helpers), so repeated
 * window-display props and poster quads stay on the GPU as InstancedMesh
 * batches — the module's 60fps budget.
 *
 * Crossfade contract: each builder returns a group tagged as one era layer.
 * `index.ts` collects every MeshStandardMaterial in the layer with its base
 * opacity/emissive values, then drives `setLayerWeight` each transition
 * frame. Materials are created once at build time and only opacity/emissive
 * change while morphing, so era swaps never rebuild textures (no popping).
 */

import * as THREE from 'three';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import type { EraYear } from '../../era/timeline';
import {
  BAY_BASE_Y,
  BAY_CLEAR_WIDTH,
  type EraStorefrontVariant,
} from './variants';
import type { BaySignageArt, SignageTexture } from './signage';

/* -------------------------------------------------------------------------- */
/* Era-layer bookkeeping                                                       */
/* -------------------------------------------------------------------------- */

/** A material plus the baseline values a weight crossfade restores. */
export interface LayerMaterial {
  material: THREE.MeshStandardMaterial;
  /** Opacity at full era weight (glass panels start translucent). */
  baseOpacity: number;
  /** Emissive intensity at full era weight (0 for unlit art). */
  baseEmissive: number;
  /** Original transparency mode to restore once the crossfade completes. */
  baseTransparent: boolean;
}

/** One era's slice of a morphing piece: a group and its driven materials. */
export interface EraLayer {
  era: EraYear;
  object: THREE.Object3D;
  materials: LayerMaterial[];
  /** Current era weight applied to this layer (0..1). */
  weight: number;
  /** Current mid-transition emissive flare multiplier (1 at rest). */
  flare: number;
}

/** Collect a built group into an era layer, snapshotting baseline values. */
export function makeEraLayer(era: EraYear, root: THREE.Object3D): EraLayer {
  const materials: LayerMaterial[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial) continue;
      if (materials.some((entry) => entry.material === std)) continue;
      std.userData.era = era;
      materials.push({
        material: std,
        baseOpacity: std.opacity,
        baseEmissive: std.emissiveIntensity,
        baseTransparent: std.transparent,
      });
    }
  });
  return { era, object: root, materials, weight: 0, flare: 1 };
}

/**
 * Apply one era weight to a layer: opacity and emissive intensity scale with
 * the weight (times an optional mid-swap flare), and the layer drops out of
 * the render graph entirely at zero weight. Materials become transparent only
 * while blending (weight below 1 or flare active) so steady states render as
 * clean opaque surfaces with their original transparency mode restored —
 * crossfades never rebuild textures, so era swaps cannot pop.
 */
export function setLayerWeight(layer: EraLayer, weight: number, flare: number = 1): void {
  const w = Math.max(0, Math.min(1, weight));
  layer.weight = w;
  layer.flare = flare;
  layer.object.visible = w > 0.004;
  if (!layer.object.visible) return;
  const blending = w < 0.999 || Math.abs(flare - 1) > 1e-6;
  for (const entry of layer.materials) {
    entry.material.opacity = entry.baseOpacity * w;
    entry.material.emissiveIntensity = entry.baseEmissive * w * flare;
    entry.material.transparent = blending ? true : entry.baseTransparent;
  }
}

/* -------------------------------------------------------------------------- */
/* Material helpers (real gfx-library composition)                             */
/* -------------------------------------------------------------------------- */

/** Sign-face material: map + emissive map from the procedural art texture. */
export function makeSignMaterial(art: SignageTexture): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: art.texture,
    emissive: new THREE.Color(art.emissiveColor),
    emissiveMap: art.texture,
    emissiveIntensity: art.emissiveIntensity,
    transparent: true,
    opacity: 1,
    roughness: 0.55,
    metalness: 0.04,
    side: THREE.FrontSide,
  });
  material.userData.source = 'storefront-signage';
  return material;
}

/** Era material straight from the procedural graphics library, tagged. */
function eraMaterial(
  category: 'fabric' | 'metal' | 'wood' | 'glass' | 'paintSignage',
  year: EraYear,
  overrides: { seed?: number; roughness?: number; opacity?: number } = {},
): THREE.MeshStandardMaterial {
  const material = ProceduralGfxLibrary.createEraMaterial(category, year, {
    seed: overrides.seed ?? year,
    ...(overrides.roughness !== undefined ? { roughness: overrides.roughness } : {}),
    ...(overrides.opacity !== undefined ? { transparent: true, opacity: overrides.opacity } : {}),
  });
  if (overrides.opacity !== undefined) {
    material.transparent = true;
    material.opacity = overrides.opacity;
  }
  material.userData.source = 'gfx-library-procedural';
  return material;
}

/** Frame tint color for one era (painted wood early, metal/anodized later). */
export function frameColorFor(year: EraYear): THREE.Color {
  const palette = ProceduralGfxLibrary.getEraPalette(year);
  const swatch = year <= 1965 ? palette.materials.wood : palette.materials.metal;
  return new THREE.Color(swatch.color);
}

/* -------------------------------------------------------------------------- */
/* Shopfront shell (era-stable structure, color-tinted per era)                */
/* -------------------------------------------------------------------------- */

/**
 * The permanent bay shell: sill, display opening, entry door, transom bar,
 * fascia band backing, and pier returns. Structure persists across eras so a
 * transition never double-draws identical geometry; only its tint lerps
 * between era frame colors, while era layers (awnings, glass displays,
 * signs) crossfade on top.
 */
export function buildShopfrontShell(): {
  group: THREE.Group;
  /** Materials whose color lerps between era frame colors during morphs. */
  tintMaterials: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();
  group.name = 'shopfront-shell';
  const w = BAY_CLEAR_WIDTH;
  const tintMaterials: THREE.MeshStandardMaterial[] = [];

  // Base plinth sitting on the sidewalk top: the bay base elevation is
  // BAY_BASE_Y (0.15), so the plinth spans 0.15..0.30 world units.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.15, 0.28),
    eraMaterial('paintSignage', 1985, { roughness: 0.9 }),
  );
  plinth.position.set(0, BAY_BASE_Y + 0.075, 0.02);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Jambs and head define the display opening; these carry the era tint.
  const frameMat = eraMaterial('wood', 1945, { roughness: 0.75 });
  frameMat.userData.shellTint = true;
  tintMaterials.push(frameMat);
  const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.45, 0.22), frameMat);
  leftJamb.position.set(-w / 2 + 0.08, 0.15 + 1.225, 0.06);
  const rightJamb = leftJamb.clone();
  rightJamb.position.x = w / 2 - 0.08;
  const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.22), frameMat);
  head.position.set(0, 0.15 + 2.45 + 0.09, 0.06);
  // Mullion splitting display glazing from the entry door.
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.45, 0.22), frameMat);
  mullion.position.set(0.75, 0.15 + 1.225, 0.06);
  for (const part of [leftJamb, rightJamb, head, mullion]) {
    part.castShadow = true;
    group.add(part);
  }

  // Entry door with inset glass and a push bar.
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.3, 0.08), frameMat);
  doorPanel.position.set(1.65, 0.15 + 1.15, 0.02);
  doorPanel.castShadow = true;
  const doorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.5),
    eraMaterial('glass', 1985, { opacity: 0.24 }),
  );
  doorGlass.position.set(1.65, 0.15 + 1.4, 0.065);
  const doorBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.05),
    eraMaterial('metal', 1985, { roughness: 0.35 }),
  );
  doorBar.position.set(1.9, 0.15 + 1.05, 0.09);
  group.add(doorPanel, doorGlass, doorBar);

  // Display glazing (era layer crossfades overlays; this pane is the base).
  const displayGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 1.0, 2.3),
    eraMaterial('glass', 1985, { opacity: 0.16 }),
  );
  displayGlass.position.set(-0.55, 0.15 + 1.25, 0.045);
  group.add(displayGlass);

  // Transom bar under the sign band; lettering mounts above the door glass.
  const transomBar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.2), frameMat);
  transomBar.position.set(0, 0.15 + 2.72, 0.05);
  group.add(transomBar);

  // Fascia band backing board (3.2..4.2): signs mount onto this board.
  const fasciaBoard = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, 1.0, 0.14),
    eraMaterial('paintSignage', 1945, { roughness: 0.8 }),
  );
  fasciaBoard.position.set(0, 3.7, 0.1);
  const fasciaBoardMat = fasciaBoard.material as THREE.MeshStandardMaterial;
  fasciaBoardMat.userData.shellTint = true;
  tintMaterials.push(fasciaBoardMat);
  fasciaBoard.castShadow = true;
  group.add(fasciaBoard);

  // Pier returns blend the bay into the 1-unit pier gap between bays.
  const pierMat = eraMaterial('paintSignage', 1945, { roughness: 0.85 });
  pierMat.userData.shellTint = true;
  tintMaterials.push(pierMat);
  const pierL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.16), pierMat);
  pierL.position.set(-w / 2 - 0.25, 1.7, 0.04);
  const pierR = pierL.clone();
  pierR.position.x = w / 2 + 0.25;
  group.add(pierL, pierR);

  return { group, tintMaterials };
}

/* -------------------------------------------------------------------------- */
/* Awnings                                                                     */
/* -------------------------------------------------------------------------- */

/** Scalloped valance strip: rectangle whose bottom edge is a row of bumps. */
function scallopedValance(width: number, depth: number, bumps: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const step = width / bumps;
  const radius = step / 2;
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, -depth);
  for (let i = 0; i < bumps; i += 1) {
    const cx = width / 2 - (i + 0.5) * step;
    shape.absarc(cx, -depth, radius, 0, Math.PI, true);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 12);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
}

/**
 * Build the era awning/canopy over the display window:
 * - 1945 scalloped striped fabric, 1965 pastel scalloped,
 * - 1985 slim metal canopy, 2005 straight wedge fabric, 2025 none.
 */
export function buildAwning(variant: EraStorefrontVariant): THREE.Group | null {
  if (variant.awning === 'none') return null;
  const group = new THREE.Group();
  group.name = `awning-${variant.awning}`;
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const width = BAY_CLEAR_WIDTH - 0.4;
  const fabric = eraMaterial('fabric', variant.year, { roughness: 0.85 });
  fabric.side = THREE.DoubleSide;
  fabric.color = new THREE.Color(palette.materials.fabric.color);

  if (variant.awning === 'slim-metal') {
    // 1985: thin anodized metal canopy, straight edge, no valance.
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 1.15), fabric);
    canopy.rotation.x = -0.22;
    canopy.position.set(0, 3.05, 0.6);
    canopy.castShadow = true;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.12, 0.06),
      eraMaterial('metal', 1985, { roughness: 0.4 }),
    );
    trim.position.set(0, 2.93, 1.16);
    group.add(canopy, trim);
    return group;
  }

  // Fabric awnings: angled canopy + hanging valance (scalloped or straight).
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 1.3), fabric);
  canopy.rotation.x = -0.3;
  canopy.position.set(0, 3.08, 0.68);
  canopy.castShadow = true;
  group.add(canopy);

  const valanceDepth = variant.awning === 'wedge-fabric' ? 0.14 : 0.26;
  const valance = scallopedValance(width, valanceDepth, variant.awning === 'wedge-fabric' ? 1 : 9);
  (valance.material as THREE.MeshStandardMaterial).dispose();
  const valanceMat = fabric.clone();
  valanceMat.userData.source = 'gfx-library-procedural';
  valance.material = valanceMat;
  valance.position.set(0, 3.0, 1.3);
  group.add(valance);

  if (variant.year <= 1965) {
    // Era-identifying contrast stripe sewn along the canopy nose.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.06, 0.16),
      eraMaterial('paintSignage', variant.year, { roughness: 0.7 }),
    );
    stripe.material = (stripe.material as THREE.MeshStandardMaterial);
    (stripe.material as THREE.MeshStandardMaterial).color = new THREE.Color(palette.accent);
    stripe.position.set(0, 2.96, 1.22);
    group.add(stripe);
  }
  return group;
}

/* -------------------------------------------------------------------------- */
/* Window displays                                                             */
/* -------------------------------------------------------------------------- */

/** Count of instanced product props per window display. */
const WINDOW_PRODUCT_COUNT = 16;

/**
 * Window display: era backdrop art, a merchandising plinth and shelf, and
 * era products as one InstancedMesh batch (60fps-friendly repetition).
 */
export function buildWindowDisplay(
  art: BaySignageArt,
  variant: EraStorefrontVariant,
  bayIndex: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `window-display-${variant.year}`;
  const w = BAY_CLEAR_WIDTH - 1.1;
  const rng = ProceduralGfxLibrary.createPRNG(variant.year * 97 + bayIndex * 13);

  // Backdrop: butcher paper through projection glass, keyed by era treatment.
  const backdropMat = makeSignMaterial(art.windowDisplay);
  backdropMat.roughness = 0.9;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.9), backdropMat);
  backdrop.position.set(-0.55, 1.3, -0.55);
  group.add(backdrop);

  // Interior side walls give the display depth behind the glazing.
  const wallMat = eraMaterial('paintSignage', variant.year, { roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.62), wallMat);
  floor.position.set(-0.55, 0.3, -0.28);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.6), wallMat);
  leftWall.position.set(-0.55 - w / 2, 1.3, -0.28);
  const rightWall = leftWall.clone();
  rightWall.position.x = -0.55 + w / 2;
  group.add(floor, leftWall, rightWall);

  // Plinth and riser shelf for merchandising.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.55, 0.42, 0.5),
    eraMaterial('wood', variant.year, { roughness: 0.8 }),
  );
  plinth.position.set(-1.0, 0.54, -0.26);
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.32, 0.3, 0.44),
    eraMaterial('wood', variant.year, { roughness: 0.8 }),
  );
  shelf.position.set(0.35, 0.48, -0.28);
  group.add(plinth, shelf);

  // Era products: one InstancedMesh of varied boxes/cans, tinted per era.
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const productMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.accent),
    roughness: 0.6,
    metalness: 0.05,
    transparent: true,
  });
  productMat.userData.source = 'gfx-library-procedural';
  const products = ProceduralGfxLibrary.createInstancedMesh({
    geometry: new THREE.BoxGeometry(0.16, 0.2, 0.14),
    material: productMat,
    count: WINDOW_PRODUCT_COUNT,
    name: `products-${variant.year}-${bayIndex}`,
    castShadow: false,
    receiveShadow: false,
  });
  const tintA = new THREE.Color(palette.accent);
  const tintB = new THREE.Color(palette.materials.paintSignage.color);
  const tintC = new THREE.Color('#c9a24a');
  for (let i = 0; i < WINDOW_PRODUCT_COUNT; i += 1) {
    const onPlinth = i % 2 === 0;
    const col = Math.floor(i / 2) % 8;
    const row = Math.floor(i / 16);
    const baseX = onPlinth ? -1.0 : 0.35;
    const spread = onPlinth ? w * 0.5 : w * 0.3;
    const x = baseX - spread / 2 + (col / 7) * spread + rng.range(-0.04, 0.04);
    const y = (onPlinth ? 0.75 : 0.63) + row * 0.24 + rng.range(0, 0.05);
    const z = -0.26 + rng.range(-0.12, 0.12);
    ProceduralGfxLibrary.setInstanceTransform(products, i, {
      position: [x, y, z],
      rotation: [0, rng.range(-0.5, 0.5), 0],
      scale: [rng.range(0.8, 1.4), rng.range(0.8, 1.7), rng.range(0.8, 1.3)],
    });
    const tint = rng.chance(0.5) ? tintA : rng.chance(0.6) ? tintB : tintC;
    ProceduralGfxLibrary.setInstanceColor(products, i, tint);
  }
  products.userData.instanceKind = 'window-products';
  group.add(products);

  return group;
}

/* -------------------------------------------------------------------------- */
/* Sign faces                                                                  */
/* -------------------------------------------------------------------------- */

/** Fascia-band sign mounted inside the 3.2..4.2 sign band. */
export function buildFasciaSign(art: SignageTexture, variant: EraStorefrontVariant): THREE.Mesh {
  const material = makeSignMaterial(art);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAY_CLEAR_WIDTH - 0.4, 0.82), material);
  mesh.name = `fascia-${variant.fasciaSign}`;
  mesh.position.set(0, 3.7, 0.19);
  return mesh;
}

/** Transom glass lettering over the entry (gold leaf in 1945). */
export function buildTransomSign(art: SignageTexture, variant: EraStorefrontVariant): THREE.Mesh {
  const material = makeSignMaterial(art);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAY_CLEAR_WIDTH - 0.6, 0.42), material);
  mesh.name = `transom-${variant.transomSign}`;
  mesh.position.set(0.35, 2.98, 0.13);
  return mesh;
}

/** Projecting vertical blade sign on the right pier; null when unused. */
export function buildBladeSign(art: SignageTexture, variant: EraStorefrontVariant): THREE.Group | null {
  if (!variant.bladeSign) return null;
  const group = new THREE.Group();
  group.name = `blade-${variant.bladeSign}`;
  const material = makeSignMaterial(art);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.85), material);
  face.rotation.y = Math.PI / 2;
  face.position.set(0.42, 3.0, 0);
  const faceBack = face.clone();
  faceBack.rotation.y = -Math.PI / 2;
  faceBack.position.x = -0.42;
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.06, 0.06),
    eraMaterial('metal', variant.year, { roughness: 0.45 }),
  );
  bracket.position.set(0, 3.95, 0);
  const stem = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.9, 0.06),
    eraMaterial('metal', variant.year, { roughness: 0.45 }),
  );
  stem.position.set(0, 3.0, 0);
  group.add(face, faceBack, bracket, stem);
  group.position.set(BAY_CLEAR_WIDTH / 2 + 0.3, 0, 0.35);
  return group;
}

/** Scrolling ticker strip at the display head; null when the era has none. */
export function buildTicker(art: SignageTexture, variant: EraStorefrontVariant): THREE.Mesh | null {
  if (!variant.ticker) return null;
  const material = makeSignMaterial(art);
  material.userData.ticker = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAY_CLEAR_WIDTH - 0.9, 0.24), material);
  mesh.name = `ticker-${variant.year}`;
  mesh.position.set(-0.5, 2.5, 0.075);
  return mesh;
}

/** Backlit menu board beside the entry; null when the era has none. */
export function buildMenuBoard(art: SignageTexture, variant: EraStorefrontVariant): THREE.Mesh | null {
  if (!variant.menuBoard) return null;
  const material = makeSignMaterial(art);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.3), material);
  mesh.name = `menu-board-${variant.year}`;
  mesh.position.set(1.65, 2.7, 0.16);
  return mesh;
}

/** Projection-mapped glass wash over the display glazing (2025 only). */
export function buildProjectionGlass(
  art: SignageTexture,
  variant: EraStorefrontVariant,
): THREE.Mesh | null {
  if (!variant.projectionGlass) return null;
  const material = makeSignMaterial(art);
  material.opacity = 0.85;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAY_CLEAR_WIDTH - 1.0, 2.3), material);
  mesh.name = 'projection-glass';
  mesh.position.set(-0.55, 1.4, 0.052);
  return mesh;
}

/* -------------------------------------------------------------------------- */
/* Poster wall (instanced across the whole row)                                */
/* -------------------------------------------------------------------------- */

/** A poster position on a pier face, world-space. */
export interface PosterSlot {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

/**
 * One InstancedMesh holding every poster quad of this era along the row —
 * a single draw call per era for the entire poster wall.
 */
export function buildPosterWall(
  art: SignageTexture,
  variant: EraStorefrontVariant,
  slots: readonly PosterSlot[],
): THREE.InstancedMesh {
  const material = makeSignMaterial(art);
  const mesh = ProceduralGfxLibrary.createInstancedMesh({
    geometry: new THREE.PlaneGeometry(0.72, 1.04),
    material,
    count: Math.max(1, slots.length),
    name: `poster-wall-${variant.year}`,
    castShadow: false,
    receiveShadow: false,
  });
  slots.forEach((slot, index) => {
    ProceduralGfxLibrary.setInstanceTransform(mesh, index, {
      position: [slot.x, slot.y, slot.z],
      rotation: [0, slot.rotationY, 0],
      scale: 1,
    });
  });
  mesh.count = slots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.instanceKind = 'poster-quads';
  return mesh;
}

/* -------------------------------------------------------------------------- */
/* Billboards, kiosk, newsstand, pushcart                                      */
/* -------------------------------------------------------------------------- */

/** Persistent billboard truss/frame that survives every era. */
export function buildBillboardFrame(width: number, height: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'billboard-frame';
  const steel = eraMaterial('metal', 1985, { roughness: 0.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, height + 0.4, 0.18), steel);
  deck.castShadow = true;
  group.add(deck);
  // Lattice legs + horizontal braces read as a real rooftop structure.
  const legGeo = new THREE.BoxGeometry(0.14, height * 0.9, 0.14);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, steel);
    leg.position.set((sx * width) / 2.4, -height * 0.85, -0.35);
    leg.rotation.z = sx * 0.12;
    leg.castShadow = true;
    group.add(leg);
  }
  const braceGeo = new THREE.BoxGeometry(width * 0.9, 0.1, 0.1);
  for (const sy of [-0.45, -1.1]) {
    const brace = new THREE.Mesh(braceGeo, steel);
    brace.position.set(0, sy * height, -0.4);
    group.add(brace);
  }
  // Catwalk along the bottom edge with a kick rail.
  const catwalk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.5), steel);
  catwalk.position.set(0, -height / 2 - 0.25, -0.2);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.05), steel);
  rail.position.set(0, -height / 2 - 0.02, -0.45);
  group.add(catwalk, rail);
  return group;
}

/** Billboard face plane for one era (mounts onto {@link buildBillboardFrame}). */
export function buildBillboardFace(
  art: SignageTexture,
  variant: EraStorefrontVariant,
  width: number,
  height: number,
): THREE.Mesh {
  const material = makeSignMaterial(art);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = `billboard-face-${variant.year}`;
  mesh.position.z = 0.11;
  return mesh;
}

/** Persistent pavement kiosk structure (drum base + post + cap). */
export function buildKioskStructure(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'kiosk-structure';
  const steel = eraMaterial('metal', 1985, { roughness: 0.42 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 20), steel);
  base.position.y = 0.11;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 14), steel);
  post.position.y = 1.4;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.16, 20), steel);
  cap.position.y = 2.78;
  base.castShadow = true;
  post.castShadow = true;
  group.add(base, post, cap);
  return group;
}

/** Curved kiosk ad face for one era (two panels back-to-back). */
export function buildKioskFace(
  art: SignageTexture,
  variant: EraStorefrontVariant,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `kiosk-face-${variant.year}`;
  const material = makeSignMaterial(art);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.9), material);
  panel.position.set(0, 1.5, 0.16);
  const back = panel.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.16;
  group.add(panel, back);
  return group;
}

/** Persistent newsstand rack (awned counter with periodical shelves). */
export function buildNewsstandStructure(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'newsstand-structure';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 1.2),
    eraMaterial('wood', 1945, { roughness: 0.85 }),
  );
  body.position.y = 0.75;
  body.castShadow = true;
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.1, 1.4),
    eraMaterial('metal', 1985, { roughness: 0.4 }),
  );
  counter.position.y = 1.55;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.12, 1.5),
    eraMaterial('metal', 1985, { roughness: 0.5 }),
  );
  roof.position.y = 2.45;
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 10);
  const poleMat = eraMaterial('metal', 1985, { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sx * 1.2, 2.0, sz * 0.65);
      group.add(pole);
    }
  }
  group.add(body, counter, roof);
  return group;
}

/** Front-page card face for one era of newsstand. */
export function buildNewsstandFace(
  art: SignageTexture,
  variant: EraStorefrontVariant,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `newsstand-face-${variant.year}`;
  const material = makeSignMaterial(art);
  // Angled display card + hanging rack cards, instanced as three quads.
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), material);
  card.position.set(-0.5, 1.95, 0.62);
  card.rotation.x = -0.35;
  const hang = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95), material);
  hang.position.set(0.7, 1.3, 0.66);
  hang.rotation.x = -0.12;
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), material);
  side.rotation.y = Math.PI / 2;
  side.position.set(1.24, 1.7, 0.1);
  group.add(card, hang, side);
  return group;
}

/**
 * 1945 street pushcart with striped canopy and produce crates; the whole
 * cart is one era layer so it fades away as the timeline advances.
 */
export function buildPushcart(variant: EraStorefrontVariant): THREE.Group | null {
  if (!variant.pushcart) return null;
  const group = new THREE.Group();
  group.name = `pushcart-${variant.year}`;
  const wood = eraMaterial('wood', variant.year, { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.9), wood);
  body.position.y = 0.72;
  body.castShadow = true;
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18);
  const wheelMat = eraMaterial('metal', variant.year, { roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.62, 0.36, 0.48);
    wheel.castShadow = true;
    group.add(wheel);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), wood);
  handle.position.set(-0.85, 0.9, 0);
  group.add(body, handle);

  // Striped canopy on poles.
  const palette = ProceduralGfxLibrary.getEraPalette(variant.year);
  const canopyMat = eraMaterial('fabric', variant.year, { roughness: 0.88 });
  canopyMat.side = THREE.DoubleSide;
  canopyMat.color = new THREE.Color(palette.accent);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 1.1), canopyMat);
  canopy.position.y = 1.85;
  canopy.rotation.x = -0.12;
  const poleMat = eraMaterial('metal', variant.year, { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), poleMat);
    pole.position.set(sx * 0.7, 1.35, -0.35);
    group.add(pole);
  }
  group.add(canopy);

  // Produce crates: one instanced batch of tinted boxes.
  const crateMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8a5a2b'),
    roughness: 0.8,
    transparent: true,
  });
  crateMat.userData.source = 'gfx-library-procedural';
  const crates = ProceduralGfxLibrary.createInstancedMesh({
    geometry: new THREE.BoxGeometry(0.24, 0.18, 0.24),
    material: crateMat,
    count: 9,
    name: 'pushcart-crates',
    castShadow: false,
    receiveShadow: false,
  });
  const rng = ProceduralGfxLibrary.createPRNG(1945);
  const tints = ['#c0392b', '#e0a92e', '#6a8f3c'];
  for (let i = 0; i < 9; i += 1) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    ProceduralGfxLibrary.setInstanceTransform(crates, i, {
      position: [-0.45 + col * 0.45, 1.08 + row * 0.14, 0],
      rotation: [0, rng.range(-0.3, 0.3), 0],
      scale: rng.range(0.85, 1.15),
    });
    ProceduralGfxLibrary.setInstanceColor(crates, i, rng.pick(tints));
  }
  crates.userData.instanceKind = 'pushcart-crates';
  group.add(crates);
  return group;
}
