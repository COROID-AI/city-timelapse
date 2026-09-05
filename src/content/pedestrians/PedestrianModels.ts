/**
 * src/content/pedestrians/PedestrianModels.ts — procedural pedestrian geometry.
 *
 * Stylised figures with period-correct silhouettes and outfit channels. Every
 * outfit is assembled from primitive BufferGeometry (boxes and capsules
 * approximated by cylinders) and merged per material channel: head/hair, skin,
 * upper garment, lower garment, accent, and shoes.
 *
 * Silhouette conventions (facing +Z, standing on y=0, height ~1.75u):
 *  1945 — wartime workwear (baggy trousers, work cap) and long wool coats;
 *          narrow ration-era shoulders, solid dull palette
 *  1965 — slim suits with narrow lapels and fit-and-flare dresses/skirts;
 *          pastel-to-candy palette, smarter collars, slight gloss
 *  1985 — bold disco (wide jacket, flared trousers), leather punk layers,
 *          neon accents; exaggerated hair and shoulder pads
 *  2005 — casual hoodies/denim/cargo; slightly dropped shoulder, mid wash
 *  2025 — athleisure (fitted top, joggers) and techwear (puffy gilet, cargo
 *          straps); modern clean silhouettes with high-contrast accents
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { PedestrianModelId } from '../../eras';

/** Garment colours and fabric descriptor for one pedestrian. */
export interface OutfitPalette {
  color: string;
  accentColor: string;
  skinColor: string;
  hairColor: string;
  fabric: string;
}

/** Merged geometry channels for one pedestrian rig. */
export interface OutfitGeometrySet {
  head: THREE.BufferGeometry;
  skin: THREE.BufferGeometry;
  upper: THREE.BufferGeometry;
  lower: THREE.BufferGeometry;
  accent: THREE.BufferGeometry;
  shoes: THREE.BufferGeometry;
}

type GeomList = THREE.BufferGeometry[];

/** Box part at local offset. */
function bx(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** Capsule-ish limb aligned with Y. */
function limb(radius: number, length: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, length, 8, 1).translate(x, y, z);
}

/** Head (hair whole cap; skin face brush fills the front). */
function head(parts: GeomList, capsuleR = 0.105): void {
  const h = new THREE.CylinderGeometry(capsuleR * 1.18, capsuleR * 1.18, capsuleR * 2.1, 10, 1).translate(0, 1.62, 0);
  parts.push(h);
  const face = new THREE.CylinderGeometry(capsuleR * 1.13, capsuleR * 1.13, capsuleR * 1.5, 10, 1)
    .translate(0, 1.6, capsuleR * 0.7);
  parts.push(face);
}

/** Whole skull hair cap in the hair channel. */
function hairCap(parts: GeomList, capsuleR = 0.105): void {
  const cap = new THREE.CylinderGeometry(capsuleR * 1.2, capsuleR * 1.24, capsuleR * 1.6, 10, 1)
    .translate(0, 1.66, -capsuleR * 0.15);
  parts.push(cap);
}

/** Simple neck in the skin channel. */
function neck(parts: GeomList): void {
  parts.push(limb(0.045, 0.12, 0, 1.46, 0));
}

/** Torso box, front half-open in the upper channel. */
function torso(parts: GeomList, w = 0.42, h = 0.56, y = 1.15): void {
  parts.push(bx(w, h, 0.24, 0, y, 0));
}

/** Pelvis/hips in the lower channel. */
function hips(parts: GeomList, w = 0.34, h = 0.16, y = 0.86): void {
  parts.push(bx(w, h, 0.2, 0, y, 0));
}

/** Upper arm on one side in the upper channel. */
function arm(parts: GeomList, side: 1 | -1, shoulderY = 1.32, armLen = 0.56, radius = 0.05): void {
  parts.push(limb(radius, armLen, side * 0.24, shoulderY - armLen / 2, 0));
}

/** Upper leg (thigh) in the lower channel. */
function thigh(parts: GeomList, side: 1 | -1, hipY = 0.8, len = 0.46, radius = 0.065): void {
  parts.push(limb(radius, len, side * 0.105, hipY - len / 2, 0));
}

/** Lower leg in the skin channel. */
function calf(parts: GeomList, side: 1 | -1, kneeY = 0.32, len = 0.32, radius = 0.05): void {
  parts.push(limb(radius, len, side * 0.105, kneeY - len / 2, 0));
}

/** Simple shoe in the shoe channel. */
function shoe(parts: GeomList, side: 1 | -1): void {
  parts.push(bx(0.1, 0.06, 0.22, side * 0.105, 0.03, 0.05));
}

// ---------------------------------------------------------------------------
// Walk helpers: add the common figure skeleton, then dress it.
// ---------------------------------------------------------------------------

function baseFigure(
  headP: GeomList,
  skinP: GeomList,
  lowerP: GeomList,
  shoeP: GeomList,
): void {
  head(headP);
  hairCap(headP);
  neck(skinP);
  hips(lowerP);
  for (const side of [-1, 1] as const) {
    thigh(lowerP, side);
    calf(skinP, side);
    shoe(shoeP, side);
  }
}

/** Merge a per-material channel; empty channels become empty geometries. */
function mergeChannel(parts: GeomList): THREE.BufferGeometry {
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }
  const merged = mergeGeometries(parts);
  if (!merged) {
    return new THREE.BufferGeometry();
  }
  return merged;
}

/** Worker cap + coverall on top of the base figure. */
function dressWorker(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.4, 0.54, 1.12);
  // Coverall straps and rolled sleeves.
  accentP.push(bx(0.24, 0.1, 0.22, 0, 1.24, 0));
  accentP.push(bx(0.12, 0.16, 0.22, -0.18, 0.74, 0));
  accentP.push(bx(0.12, 0.16, 0.22, 0.18, 0.74, 0));
  accentP.push(limb(0.042, 0.16, -0.24, 0.62, 0.02));
  accentP.push(limb(0.042, 0.16, 0.24, 0.62, 0.02));
  // Baggy work trousers.
  lowerP.push(bx(0.34, 0.5, 0.22, 0, 0.58, 0));
  lowerP.push(bx(0.14, 0.34, 0.2, -0.105, 0.34, 0));
  lowerP.push(bx(0.14, 0.34, 0.2, 0.105, 0.34, 0));
  for (const side of [-1, 1] as const) {
    thigh(lowerP, side, 0.82, 0.4, 0.068);
    arm(upperP, side, 1.3, 0.5, 0.05);
    calf(skinP, side, 0.32, 0.32, 0.045);
    shoe(shoeP, side);
  }
  // Flat cap + lower face.
  hairP.push(bx(0.3, 0.05, 0.28, 0, 1.68, 0));
  skinP.push(bx(0.2, 0.12, 0.18, 0, 1.56, 0.08));
}

/** Long wool coat with belt, ration-era silhouette. */
function dressCoat(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  // Dolman-ish overcoat: wide shoulder, flaring skirt.
  torso(upperP, 0.46, 0.6, 1.16);
  upperP.push(bx(0.5, 0.44, 0.3, 0, 0.82, 0)); // coat skirt
  accentP.push(bx(0.08, 1.0, 0.08, 0, 0.92, 0.2)); // belt + front placket
  accentP.push(bx(0.44, 0.06, 0.22, 0, 1.0, 0.15));
  accentP.push(bx(0.44, 0.06, 0.22, 0, 0.84, 0.15));
  // Shoulder pads of the era (small, structured).
  accentP.push(bx(0.14, 0.06, 0.18, -0.24, 1.32, 0));
  accentP.push(bx(0.14, 0.06, 0.18, 0.24, 1.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.52, 0.055);
    calf(skinP, side, 0.34, 0.28, 0.05);
    shoe(shoeP, side);
  }
  // Long hem covers the thighs: slim legs peek below.
  lowerP.push(bx(0.34, 0.5, 0.22, 0, 0.6, 0));
  lowerP.push(bx(0.12, 0.3, 0.18, -0.105, 0.3, 0));
  lowerP.push(bx(0.12, 0.3, 0.18, 0.105, 0.3, 0));
}

/** 1945 day dress: fitted bodice, A-line skirt, gloves. */
function dress1945(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.36, 0.42, 1.18);
  // A-line skirt flaring to the ankle.
  lowerP.push(bx(0.34, 0.5, 0.22, 0, 0.64, 0));
  lowerP.push(bx(0.4, 0.28, 0.26, 0, 0.34, 0));
  accentP.push(bx(0.1, 0.34, 0.1, -0.24, 1.12, 0)); // gloves
  accentP.push(bx(0.1, 0.34, 0.1, 0.24, 1.12, 0));
  accentP.push(bx(0.32, 0.05, 0.18, 0, 1.3, 0.1)); // collar
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.48, 0.045);
    calf(skinP, side, 0.34, 0.26, 0.045);
    shoe(shoeP, side);
  }
}

/** 1965 slim suit: narrow lapels, slim trousers, tie. */
function dressSuit65(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.38, 0.56, 1.16);
  accentP.push(bx(0.08, 0.52, 0.06, 0, 1.14, 0.13)); // tie
  accentP.push(bx(0.18, 0.05, 0.1, 0, 1.42, 0.14)); // collar
  // Slim-fit trousers.
  lowerP.push(bx(0.28, 0.52, 0.18, 0, 0.56, 0));
  lowerP.push(bx(0.1, 0.32, 0.16, -0.085, 0.32, 0));
  lowerP.push(bx(0.1, 0.32, 0.16, 0.085, 0.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.32, 0.56, 0.046);
    calf(skinP, side, 0.34, 0.3, 0.045);
    shoe(shoeP, side);
  }
}

/** 1965 dress: slim sheath, knee hem, gloves, pillbox hat. */
function dressDress65(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.34, 0.48, 1.18);
  lowerP.push(bx(0.3, 0.42, 0.18, 0, 0.72, 0)); // sheath skirt
  accentP.push(bx(0.1, 0.26, 0.1, -0.22, 1.22, 0));
  accentP.push(bx(0.1, 0.26, 0.1, 0.22, 1.22, 0));
  accentP.push(bx(0.26, 0.04, 0.2, 0, 1.66, 0)); // pillbox
  accentP.push(bx(0.16, 0.05, 0.12, 0, 1.58, 0.08)); // collar
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.48, 0.042);
    calf(skinP, side, 0.34, 0.28, 0.042);
    shoe(shoeP, side);
  }
}

/** 1965 skirt suit: fitted jacket + pencil skirt. */
function dressSkirt65(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.36, 0.5, 1.2);
  lowerP.push(bx(0.3, 0.52, 0.18, 0, 0.7, 0)); // pencil skirt
  accentP.push(bx(0.3, 0.05, 0.16, 0, 1.28, 0.08)); // jacket hem
  accentP.push(bx(0.16, 0.04, 0.12, 0, 1.56, 0.08)); // collar
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.5, 0.044);
    calf(skinP, side, 0.34, 0.28, 0.042);
    shoe(shoeP, side);
  }
}

/** 1985 disco: wide-shouldered jacket, flared trousers, big hair. */
function dressDisco85(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.44, 0.56, 1.16);
  accentP.push(bx(0.2, 0.09, 0.2, -0.22, 1.32, 0)); // shoulder pads
  accentP.push(bx(0.2, 0.09, 0.2, 0.22, 1.32, 0));
  accentP.push(bx(0.42, 0.1, 0.14, 0, 1.42, 0.14)); // open collar
  // Flared trousers.
  lowerP.push(bx(0.32, 0.56, 0.2, 0, 0.56, 0));
  lowerP.push(bx(0.18, 0.4, 0.2, -0.11, 0.32, 0));
  lowerP.push(bx(0.18, 0.4, 0.2, 0.11, 0.32, 0));
  // Big hair volume.
  hairP.push(limb(0.115, 0.14, 0, 1.78, -0.02));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.34, 0.52, 0.05);
    calf(skinP, side, 0.36, 0.3, 0.046);
    shoe(shoeP, side);
  }
}

/** 1985 leather punk: biker jacket, tight jeans, boots. */
function dressLeather85(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.42, 0.56, 1.16);
  accentP.push(bx(0.32, 0.06, 0.16, 0, 1.12, 0.12)); // jacket hem
  accentP.push(bx(0.08, 0.26, 0.06, 0, 1.32, 0.18)); // zipper
  hairP.push(limb(0.13, 0.1, 0, 1.76, 0)); // mohawk-ish crest
  // Slim jeans with loose flare at ankle.
  lowerP.push(bx(0.26, 0.54, 0.16, 0, 0.56, 0));
  lowerP.push(bx(0.1, 0.36, 0.16, -0.085, 0.32, 0));
  lowerP.push(bx(0.1, 0.36, 0.16, 0.085, 0.32, 0));
  shoeP.push(bx(0.11, 0.1, 0.26, -0.105, 0.06, 0.05)); // biker boots
  shoeP.push(bx(0.11, 0.1, 0.26, 0.105, 0.06, 0.05));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.32, 0.52, 0.05);
    calf(skinP, side, 0.36, 0.3, 0.045);
  }
}

/** 1985 neon: bright windbreaker + cap, acid-wash jeans. */
function dressNeon85(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.4, 0.56, 1.16);
  accentP.push(bx(0.4, 0.08, 0.16, 0, 1.36, 0.12)); // windbreaker stripes
  accentP.push(bx(0.3, 0.05, 0.18, 0, 1.62, 0)); // cap brim
  hairP.push(bx(0.24, 0.07, 0.22, 0, 1.66, 0));
  // Acid-wash jeans.
  lowerP.push(bx(0.28, 0.54, 0.16, 0, 0.56, 0));
  lowerP.push(bx(0.1, 0.36, 0.16, -0.085, 0.32, 0));
  lowerP.push(bx(0.1, 0.36, 0.16, 0.085, 0.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.32, 0.52, 0.048);
    calf(skinP, side, 0.36, 0.3, 0.045);
    shoe(shoeP, side);
  }
}

/** 2005 hoodie: kangaroo pocket, hood, relaxed fit. */
function dressHoodie05(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.42, 0.56, 1.16);
  accentP.push(bx(0.06, 0.16, 0.14, 0, 1.08, 0.17)); // pocket
  accentP.push(bx(0.2, 0.12, 0.2, 0, 1.42, 0)); // hood volume
  hairP.push(bx(0.28, 0.05, 0.26, 0, 1.66, 0));
  // Relaxed jeans.
  lowerP.push(bx(0.3, 0.54, 0.18, 0, 0.56, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, -0.095, 0.32, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, 0.095, 0.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.52, 0.05);
    calf(skinP, side, 0.36, 0.3, 0.045);
    shoe(shoeP, side);
  }
}

/** 2005 denim: jean jacket, tee peeking, jeans. */
function dressDenim05(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.4, 0.56, 1.16);
  accentP.push(bx(0.26, 0.1, 0.12, 0, 1.3, 0.16)); // tee chest
  accentP.push(bx(0.34, 0.06, 0.14, 0, 1.04, 0.15)); // jacket hem
  lowerP.push(bx(0.3, 0.54, 0.18, 0, 0.56, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, -0.095, 0.32, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, 0.095, 0.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.32, 0.52, 0.05);
    calf(skinP, side, 0.36, 0.3, 0.045);
    shoe(shoeP, side);
  }
}

/** 2005 cargo: jacket, cargo pockets. */
function dressCargo05(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.42, 0.56, 1.16);
  accentP.push(bx(0.11, 0.14, 0.14, -0.21, 0.9, 0.14)); // cargo pockets
  accentP.push(bx(0.11, 0.14, 0.14, 0.21, 0.9, 0.14));
  accentP.push(bx(0.34, 0.06, 0.14, 0, 1.02, 0.14)); // jacket hem
  lowerP.push(bx(0.3, 0.54, 0.18, 0, 0.56, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, -0.095, 0.32, 0));
  lowerP.push(bx(0.12, 0.36, 0.17, 0.095, 0.32, 0));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.52, 0.05);
    calf(skinP, side, 0.36, 0.3, 0.045);
    shoe(shoeP, side);
  }
}

/** 2025 athleisure: fitted running shirt, joggers, sneakers. */
function dressAthleisure25(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.36, 0.5, 1.18);
  accentP.push(bx(0.3, 0.18, 0.16, 0, 1.02, 0.14)); // accent panel / shorts line
  accentP.push(bx(0.1, 0.12, 0.1, -0.22, 1.28, 0)); // sleeve accent
  accentP.push(bx(0.1, 0.12, 0.1, 0.22, 1.28, 0));
  lowerP.push(bx(0.26, 0.54, 0.16, 0, 0.56, 0)); // joggers
  lowerP.push(bx(0.1, 0.36, 0.15, -0.085, 0.32, 0));
  lowerP.push(bx(0.1, 0.36, 0.15, 0.085, 0.32, 0));
  shoeP.push(bx(0.1, 0.08, 0.24, -0.105, 0.05, 0.05)); // chunky sneakers
  shoeP.push(bx(0.1, 0.08, 0.24, 0.105, 0.05, 0.05));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.3, 0.5, 0.044);
    calf(skinP, side, 0.36, 0.3, 0.042);
  }
}

/** 2025 techwear: puffy gilet, tactical straps, face-covering hood. */
function dressTechwear25(
  upperP: GeomList,
  lowerP: GeomList,
  accentP: GeomList,
  hairP: GeomList,
  skinP: GeomList,
  shoeP: GeomList,
): void {
  torso(upperP, 0.4, 0.56, 1.16);
  accentP.push(bx(0.16, 0.12, 0.16, 0, 1.42, 0.02)); // gilet collar
  accentP.push(bx(0.06, 0.14, 0.08, -0.2, 1.16, 0.16)); // straps
  accentP.push(bx(0.06, 0.14, 0.08, 0.2, 1.16, 0.16));
  accentP.push(bx(0.08, 0.18, 0.06, 0, 1.26, 0.2)); // zipper
  hairP.push(limb(0.12, 0.16, 0, 1.72, 0.02)); // tech hood
  lowerP.push(bx(0.26, 0.54, 0.16, 0, 0.56, 0)); // tech cargo pants
  accentP.push(bx(0.1, 0.16, 0.12, -0.2, 0.84, 0.12));
  accentP.push(bx(0.1, 0.16, 0.12, 0.2, 0.84, 0.12));
  lowerP.push(bx(0.1, 0.36, 0.15, -0.085, 0.32, 0));
  lowerP.push(bx(0.1, 0.36, 0.15, 0.085, 0.32, 0));
  shoeP.push(bx(0.11, 0.09, 0.26, -0.105, 0.05, 0.05)); // tech boots
  shoeP.push(bx(0.11, 0.09, 0.26, 0.105, 0.05, 0.05));
  for (const side of [-1, 1] as const) {
    arm(upperP, side, 1.32, 0.5, 0.046);
    calf(skinP, side, 0.36, 0.3, 0.04);
  }
}

// ---------------------------------------------------------------------------
// Dispatch: build the per-model outfit channels.
// ---------------------------------------------------------------------------

export function buildOutfitGeometry(
  model: PedestrianModelId,
  _palette: OutfitPalette,
): OutfitGeometrySet {
  const headP: GeomList = [];
  const skinP: GeomList = [];
  const upperP: GeomList = [];
  const lowerP: GeomList = [];
  const accentP: GeomList = [];
  const shoeP: GeomList = [];

  // Every outfit starts from the shared body so silhouettes stay consistent in
  // height and proportion while the garments define the period.
  baseFigure(headP, skinP, lowerP, shoeP);

  switch (model) {
    case 'worker-1945':
      dressWorker(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
    case 'coat-1945':
      dressCoat(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'dress-1945':
      dress1945(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'suit-1965':
      dressSuit65(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'dress-1965':
      dressDress65(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'skirt-1965':
      dressSkirt65(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'disco-1985':
      dressDisco85(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
    case 'leather-1985':
      dressLeather85(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
    case 'neon-1985':
      dressNeon85(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
    case 'hoodie-2005':
      dressHoodie05(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
    case 'denim-2005':
      dressDenim05(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'cargo-2005':
      dressCargo05(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'athleisure-2025':
      dressAthleisure25(upperP, lowerP, accentP, skinP, shoeP);
      break;
    case 'techwear-2025':
      dressTechwear25(upperP, lowerP, accentP, headP, skinP, shoeP);
      break;
  }

  return {
    head: mergeChannel(headP),
    skin: mergeChannel(skinP),
    upper: mergeChannel(upperP),
    lower: mergeChannel(lowerP),
    accent: mergeChannel(accentP),
    shoes: mergeChannel(shoeP),
  };
}