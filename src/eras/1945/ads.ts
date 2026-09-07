import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { Rgb } from './palette';

/**
 * 1945 street-level advertising.
 *
 * Hand-painted wall murals, painted cola-style signage, newspaper stands with
 * period headlines, and wartime-echo posters coming down. Built from box
 * primitives for the Three.js WebGL pipeline.
 */

/** A hand-painted wall mural on a building facade. */
export interface WallMural {
  /** Lot index the mural is painted on. */
  lotIndex: number;
  /** Mural width. */
  width: number;
  /** Mural height. */
  height: number;
  /** Mural base height. */
  y: number;
  /** Dominant paint colour. */
  color: Rgb;
  /** Caption text (approximated by painted bars). */
  caption: string;
}

/** Painted cola-style signage. */
export interface ColaSign {
  /** Lot index. */
  lotIndex: number;
  /** Sign width. */
  width: number;
  /** Sign height. */
  height: number;
  /** Sign base height. */
  y: number;
  /** Sign background. */
  background: Rgb;
  /** Brand text colour. */
  textColor: Rgb;
  /** Brand name. */
  brand: string;
}

/** A newspaper stand with period headlines. */
export interface NewspaperStand {
  /** Lot index. */
  lotIndex: number;
  /** Stand width. */
  width: number;
  /** Stand height. */
  height: number;
  /** Stand depth. */
  depth: number;
  /** Headline colour. */
  headlineColor: Rgb;
  /** Headline text. */
  headline: string;
}

/** A wartime-echo poster coming down (partially torn). */
export interface Poster {
  /** Lot index. */
  lotIndex: number;
  /** Poster width. */
  width: number;
  /** Poster height. */
  height: number;
  /** Poster base height. */
  y: number;
  /** Poster colour. */
  color: Rgb;
  /** Poster headline. */
  headline: string;
}

/** All 1945 advertising content. */
export interface EraAds {
  murals: readonly WallMural[];
  colaSigns: readonly ColaSign[];
  newspaperStands: readonly NewspaperStand[];
  posters: readonly Poster[];
}

const RED = { r: 0.72, g: 0.16, b: 0.13 };
const CREAM = { r: 0.84, g: 0.76, b: 0.62 };
const NAVY = { r: 0.16, g: 0.22, b: 0.38 };
const OLIVE = { r: 0.44, g: 0.4, b: 0.28 };
const BLACK = { r: 0.12, g: 0.11, b: 0.1 };

/** The 1945 advertising set. */
export const era1945Ads: EraAds = Object.freeze({
  murals: Object.freeze([
    {
      lotIndex: 1,
      width: 5.0,
      height: 3.6,
      y: 4.4,
      color: RED,
      caption: 'BUY WAR BONDS',
    },
    {
      lotIndex: 6,
      width: 4.6,
      height: 3.2,
      y: 4.6,
      color: NAVY,
      caption: 'VICTORY GARDENS',
    },
  ]),
  colaSigns: Object.freeze([
    {
      lotIndex: 4,
      width: 3.2,
      height: 2.2,
      y: 5.0,
      background: RED,
      textColor: CREAM,
      brand: 'COLA',
    },
    {
      lotIndex: 9,
      width: 3.0,
      height: 2.0,
      y: 5.0,
      background: RED,
      textColor: CREAM,
      brand: 'COLA',
    },
  ]),
  newspaperStands: Object.freeze([
    {
      lotIndex: 3,
      width: 1.6,
      height: 1.4,
      depth: 1.0,
      headlineColor: BLACK,
      headline: 'WAR ENDS',
    },
    {
      lotIndex: 8,
      width: 1.6,
      height: 1.4,
      depth: 1.0,
      headlineColor: BLACK,
      headline: 'PEACE DECLARED',
    },
  ]),
  posters: Object.freeze([
    {
      lotIndex: 1,
      width: 1.4,
      height: 2.0,
      y: 2.4,
      color: OLIVE,
      headline: 'ENLIST',
    },
    {
      lotIndex: 6,
      width: 1.4,
      height: 2.0,
      y: 2.4,
      color: OLIVE,
      headline: 'RATION',
    },
  ]),
});

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

/** Draw an approximate painted-text bar for a caption. Returns the meshes. */
function paintBars(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  rotation: number,
  text: string,
  width: number,
  height: number,
  color: Rgb,
  depth: number,
): Mesh[] {
  const meshes: Mesh[] = [];
  const n = Math.max(1, text.length);
  const step = width / (n + 1);
  const charW = step * 0.5;
  const charH = height * 0.5;
  for (let i = 0; i < n; i++) {
    const lx = x - width / 2 + step * (i + 1);
    const m = boxMesh(scene, lx, y, z, charW, charH, depth, color);
    m.rotation.y = rotation;
    meshes.push(m);
  }
  return meshes;
}

/**
 * Build all 1945 advertising meshes. Returns the meshes created (for disposal).
 */
export function buildEraAds(scene: Scene, layout: CityBlockLayout): Mesh[] {
  const meshes: Mesh[] = [];
  const ads = era1945Ads;

  for (const mural of ads.murals) {
    const lot = layout.lots[mural.lotIndex];
    if (!lot) continue;
    const rotation = (lot.rotation * Math.PI) / 180;
    const facingSouth = lot.rotation === 180;
    const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
    const centerX = lot.origin.x + lot.width / 2;
    const m = boxMesh(
      scene,
      centerX,
      mural.y + mural.height / 2,
      facadeZ + 0.12,
      mural.width,
      mural.height,
      0.1,
      mural.color,
    );
    m.rotation.y = rotation;
    meshes.push(m);
    meshes.push(...paintBars(
      scene,
      centerX,
      mural.y + mural.height * 0.7,
      facadeZ + 0.18,
      rotation,
      mural.caption,
      mural.width * 0.7,
      0.5,
      CREAM,
      0.05,
    ));
  }

  for (const sign of ads.colaSigns) {
    const lot = layout.lots[sign.lotIndex];
    if (!lot) continue;
    const rotation = (lot.rotation * Math.PI) / 180;
    const facingSouth = lot.rotation === 180;
    const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
    const centerX = lot.origin.x + lot.width / 2;
    const m = boxMesh(
      scene,
      centerX,
      sign.y + sign.height / 2,
      facadeZ + 0.14,
      sign.width,
      sign.height,
      0.12,
      sign.background,
    );
    m.rotation.y = rotation;
    meshes.push(m);
    meshes.push(...paintBars(
      scene,
      centerX,
      sign.y + sign.height * 0.62,
      facadeZ + 0.2,
      rotation,
      sign.brand,
      sign.width * 0.6,
      0.6,
      sign.textColor,
      0.06,
    ));
  }

  for (const stand of ads.newspaperStands) {
    const lot = layout.lots[stand.lotIndex];
    if (!lot) continue;
    const rotation = (lot.rotation * Math.PI) / 180;
    const facingSouth = lot.rotation === 180;
    const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
    const centerX = lot.origin.x + lot.width / 2;
    const body = boxMesh(
      scene,
      centerX,
      stand.height / 2,
      facadeZ + stand.depth / 2,
      stand.width,
      stand.height,
      stand.depth,
      { r: 0.4, g: 0.36, b: 0.3 },
    );
    body.rotation.y = rotation;
    meshes.push(body);
    meshes.push(...paintBars(
      scene,
      centerX,
      stand.height - 0.3,
      facadeZ + stand.depth + 0.06,
      rotation,
      stand.headline,
      stand.width * 0.8,
      0.3,
      stand.headlineColor,
      0.04,
    ));
  }

  for (const poster of ads.posters) {
    const lot = layout.lots[poster.lotIndex];
    if (!lot) continue;
    const rotation = (lot.rotation * Math.PI) / 180;
    const facingSouth = lot.rotation === 180;
    const facadeZ = facingSouth ? lot.origin.z + lot.depth : lot.origin.z;
    const centerX = lot.origin.x + lot.width / 2;
    const m = boxMesh(
      scene,
      centerX,
      poster.y + poster.height / 2,
      facadeZ + 0.1,
      poster.width,
      poster.height,
      0.06,
      poster.color,
    );
    m.rotation.y = rotation;
    meshes.push(m);
    meshes.push(...paintBars(
      scene,
      centerX,
      poster.y + poster.height * 0.6,
      facadeZ + 0.14,
      rotation,
      poster.headline,
      poster.width * 0.7,
      0.3,
      CREAM,
      0.04,
    ));
  }

  return meshes;
}