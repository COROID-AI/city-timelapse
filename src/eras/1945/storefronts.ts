import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { Rgb } from './palette';

/**
 * 1945 storefronts.
 *
 * The corner grocer, pharmacy, barber and haberdashery each get a hand-painted
 * wooden fascia sign, a striped awning, a window display with period products,
 * and an open/closed plaque. Built from box primitives for the Three.js WebGL
 * pipeline.
 */

/** A hand-painted wooden fascia sign. */
export interface FasciaSign {
  /** Shop name painted on the sign. */
  name: string;
  /** Text colour (paint). */
  textColor: Rgb;
  /** Background board colour. */
  boardColor: Rgb;
}

/** A striped shop awning. */
export interface Awning {
  /** Awning depth (out from the facade). */
  depth: number;
  /** Base height. */
  y: number;
  /** Stripe colour. */
  stripeColor: Rgb;
}

/** A window display with a few period products. */
export interface WindowDisplay {
  /** Window display width. */
  width: number;
  /** Product colour. */
  productColor: Rgb;
}

/** Open/closed plaque state. */
export type PlaqueState = 'open' | 'closed';

/** A single 1945 storefront. */
export interface EraStorefront {
  /** Storefront name (matches a fascia sign). */
  name: string;
  /** Lot index the storefront sits on. */
  lotIndex: number;
  /** Fascia sign. */
  fascia: FasciaSign;
  /** Awning. */
  awning: Awning;
  /** Window display. */
  windowDisplay: WindowDisplay;
  /** Plaque state. */
  plaque: PlaqueState;
  /** Shop type tag. */
  type: 'grocer' | 'pharmacy' | 'barber' | 'haberdashery';
}

const CREAM = { r: 0.82, g: 0.74, b: 0.6 };
const DARK = { r: 0.16, g: 0.13, b: 0.1 };
const RED = { r: 0.72, g: 0.18, b: 0.14 };
const GREEN = { r: 0.16, g: 0.4, b: 0.2 };
const BLUE = { r: 0.2, g: 0.34, b: 0.5 };
const GOLD = { r: 0.78, g: 0.62, b: 0.28 };

/** The four 1945 storefronts (corner grocer, pharmacy, barber, haberdashery). */
export const era1945Storefronts: readonly EraStorefront[] = Object.freeze([
  {
    name: 'MERCER GROCERY',
    lotIndex: 0,
    type: 'grocer',
    fascia: { name: 'MERCER GROCERY', textColor: GOLD, boardColor: CREAM },
    awning: { depth: 1.6, y: 3.4, stripeColor: RED },
    windowDisplay: { width: 3.4, productColor: { r: 0.55, g: 0.32, b: 0.16 } },
    plaque: 'open',
  },
  {
    name: 'APOTHECARY & PHARMACY',
    lotIndex: 2,
    type: 'pharmacy',
    fascia: { name: 'APOTHECARY & PHARMACY', textColor: DARK, boardColor: GREEN },
    awning: { depth: 1.6, y: 3.4, stripeColor: GREEN },
    windowDisplay: { width: 3.4, productColor: { r: 0.4, g: 0.55, b: 0.4 } },
    plaque: 'open',
  },
  {
    name: "BROOKS BARBER",
    lotIndex: 5,
    type: 'barber',
    fascia: { name: 'BROOKS BARBER', textColor: RED, boardColor: CREAM },
    awning: { depth: 1.5, y: 3.4, stripeColor: RED },
    windowDisplay: { width: 3.0, productColor: { r: 0.5, g: 0.2, b: 0.2 } },
    plaque: 'open',
  },
  {
    name: 'HABERDASHERY CO.',
    lotIndex: 7,
    type: 'haberdashery',
    fascia: { name: 'HABERDASHERY CO.', textColor: GOLD, boardColor: BLUE },
    awning: { depth: 1.5, y: 3.4, stripeColor: BLUE },
    windowDisplay: { width: 3.0, productColor: { r: 0.45, g: 0.3, b: 0.45 } },
    plaque: 'closed',
  },
]);

/** Build a mesh helper. */
function boxMesh(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: Rgb,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial());
  mesh.material.color.setRGB(color.r, color.g, color.b);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

/**
 * Build a storefront on its lot. The storefront sits at the street-facing
 * edge of the lot, just in front of the building facade.
 */
export function buildEraStorefront(
  scene: Scene,
  layout: CityBlockLayout,
  storefront: EraStorefront,
): Mesh[] {
  const meshes: Mesh[] = [];
  const lot = layout.lots[storefront.lotIndex];
  if (!lot) return meshes;

  const rotation = (lot.rotation * Math.PI) / 180;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const facingSouth = lot.rotation === 180;
  const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
  const centerX = lot.origin.x + lot.width / 2;

  // Local coordinate system along the facade (x) and out from it (z).
  const toWorld = (lx: number, _ly: number, lz: number) => {
    // lx along width, lz out from facade.
    const x = centerX + lx * cosR + 0 * sinR;
    const z = facadeZ + (lz * cosR - lx * sinR);
    return { x, z };
  };

  // Fascia sign board above the shopfront.
  const signW = 6.0;
  const signH = 0.9;
  const signY = 3.7;
  const sign = toWorld(0, signY, 0.25);
  const signMesh = boxMesh(
    scene,
    sign.x,
    signY,
    sign.z,
    signW,
    signH,
    0.18,
    storefront.fascia.boardColor,
  );
  signMesh.rotation.y = rotation;
  meshes.push(signMesh);

  // Painted text: a few small coloured bars approximating the letters.
  const textColor = storefront.fascia.textColor;
  const textW = signW * 0.72;
  const nChars = storefront.fascia.name.length;
  const charStep = textW / Math.max(1, nChars);
  const charW = charStep * 0.55;
  const charH = signH * 0.6;
  for (let i = 0; i < nChars; i++) {
    const lx = -textW / 2 + i * charStep + charW / 2 + charStep * 0.1;
    const pos = toWorld(lx, signY, 0.32);
    const charMesh = boxMesh(
      scene,
      pos.x,
      signY,
      pos.z,
      charW,
      charH,
      0.06,
      textColor,
    );
    charMesh.rotation.y = rotation;
    meshes.push(charMesh);
  }

  // Awning.
  const awningDepth = storefront.awning.depth;
  const awningY = storefront.awning.y;
  const awning = toWorld(0, awningY, awningDepth / 2);
  const awningMesh = boxMesh(
    scene,
    awning.x,
    awningY,
    awning.z,
    5.6,
    0.12,
    awningDepth,
    storefront.awning.stripeColor,
  );
  awningMesh.rotation.y = rotation;
  meshes.push(awningMesh);

  // Window display (shopfront window) below the sign.
  const winW = storefront.windowDisplay.width;
  const winH = 2.2;
  const winY = winH / 2 + 0.2;
  const win = toWorld(0, winY, 0.2);
  const winMesh = boxMesh(
    scene,
    win.x,
    winY,
    win.z,
    winW,
    winH,
    0.12,
    { r: 0.3, g: 0.32, b: 0.34 },
  );
  winMesh.rotation.y = rotation;
  meshes.push(winMesh);

  // Period products in the display.
  const productColor = storefront.windowDisplay.productColor;
  const productCount = 3;
  const prodStep = winW / (productCount + 1);
  for (let i = 0; i < productCount; i++) {
    const lx = -winW / 2 + prodStep * (i + 1);
    const pos = toWorld(lx, 0.7, 0.3);
    const prod = boxMesh(scene, pos.x, 0.7, pos.z, 0.5, 0.9, 0.5, productColor);
    prod.rotation.y = rotation;
    meshes.push(prod);
  }

  // Open/closed plaque next to the door.
  const plaqueY = 1.4;
  const plaque = toWorld(-winW / 2 - 0.9, plaqueY, 0.22);
  const plaqueColor =
    storefront.plaque === 'open' ? { r: 0.2, g: 0.5, b: 0.2 } : { r: 0.6, g: 0.2, b: 0.2 };
  const plaqueMesh = boxMesh(
    scene,
    plaque.x,
    plaqueY,
    plaque.z,
    0.5,
    0.5,
    0.1,
    plaqueColor,
  );
  plaqueMesh.rotation.y = rotation;
  meshes.push(plaqueMesh);

  return meshes;
}